import React, { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, Calculator, Delete } from 'lucide-react';
import { toBnDigits, formatTakaBn } from '../../utils/bengaliNumbers';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CalculatorModal: React.FC<CalculatorModalProps> = ({ isOpen, onClose }) => {
  const [display, setDisplay] = useState<string>('0');
  const [history, setHistory] = useState<string>('');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const inputDigit = useCallback((digit: string) => {
    setDisplay((prev) => {
      if (waitingForOperand) {
        setWaitingForOperand(false);
        return digit === '00' ? '0' : digit;
      }
      if (prev === '0' || prev === 'Error') {
        return digit === '00' ? '0' : digit;
      }
      if (prev.length >= 15) return prev;
      return prev + digit;
    });
  }, [waitingForOperand]);

  const inputDot = useCallback(() => {
    setDisplay((prev) => {
      if (waitingForOperand) {
        setWaitingForOperand(false);
        return '0.';
      }
      if (!prev.includes('.')) {
        return prev + '.';
      }
      return prev;
    });
  }, [waitingForOperand]);

  const executeOp = (a: number, b: number, op: string): number | 'Error' => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×':
      case '*': return a * b;
      case '÷':
      case '/': return b === 0 ? 'Error' : a / b;
      default: return b;
    }
  };

  const performOperation = useCallback((nextOp: string) => {
    const currentVal = parseFloat(display) || 0;

    if (prevValue === null) {
      setPrevValue(currentVal);
    } else if (operator && !waitingForOperand) {
      const result = executeOp(prevValue, currentVal, operator);
      if (result === 'Error') {
        setDisplay('Error');
        setHistory('');
        setPrevValue(null);
        setOperator(null);
        setWaitingForOperand(true);
        return;
      }
      const rounded = Math.round(result * 10000) / 10000;
      setDisplay(String(rounded));
      setPrevValue(rounded);
    }

    setOperator(nextOp);
    setHistory(`${prevValue === null ? currentVal : prevValue} ${nextOp}`);
    setWaitingForOperand(true);
  }, [display, prevValue, operator, waitingForOperand]);

  const calculateEquals = useCallback(() => {
    if (!operator || prevValue === null) return;
    const currentVal = parseFloat(display) || 0;
    const result = executeOp(prevValue, currentVal, operator);

    if (result === 'Error') {
      setDisplay('Error');
      setHistory('');
      setPrevValue(null);
    } else {
      const rounded = Math.round(result * 10000) / 10000;
      setHistory(`${prevValue} ${operator} ${currentVal} =`);
      setDisplay(String(rounded));
      setPrevValue(rounded);
    }
    setOperator(null);
    setWaitingForOperand(true);
  }, [display, operator, prevValue]);

  const inputPercent = useCallback(() => {
    const currentVal = parseFloat(display) || 0;
    if (operator && prevValue !== null) {
      if (operator === '+' || operator === '-') {
        const percentVal = (prevValue * currentVal) / 100;
        const rounded = Math.round(percentVal * 10000) / 10000;
        setDisplay(String(rounded));
      } else {
        const percentVal = currentVal / 100;
        setDisplay(String(percentVal));
      }
    } else {
      setDisplay(String(currentVal / 100));
    }
  }, [display, operator, prevValue]);

  const inputBackspace = useCallback(() => {
    if (waitingForOperand) return;
    setDisplay((prev) => {
      if (prev.length > 1 && prev !== 'Error') {
        return prev.slice(0, -1);
      }
      return '0';
    });
  }, [waitingForOperand]);

  const clearAll = useCallback(() => {
    setDisplay('0');
    setHistory('');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  }, []);

  const handleCopyResult = async () => {
    if (display === 'Error') return;
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = display;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Keyboard Event Listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Map Bengali digits to English
      const bnMap: Record<string, string> = {
        '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
        '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
      };

      const key = bnMap[e.key] || e.key;

      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        e.stopPropagation();
        inputDigit(key);
      } else if (key === '.' || key === ',') {
        e.preventDefault();
        e.stopPropagation();
        inputDot();
      } else if (key === '+') {
        e.preventDefault();
        e.stopPropagation();
        performOperation('+');
      } else if (key === '-') {
        e.preventDefault();
        e.stopPropagation();
        performOperation('-');
      } else if (key === '*' || key.toLowerCase() === 'x') {
        e.preventDefault();
        e.stopPropagation();
        performOperation('×');
      } else if (key === '/') {
        e.preventDefault();
        e.stopPropagation();
        performOperation('÷');
      } else if (key === '%') {
        e.preventDefault();
        e.stopPropagation();
        inputPercent();
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        e.stopPropagation();
        calculateEquals();
      } else if (key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        inputBackspace();
      } else if (key === 'Delete' || key.toLowerCase() === 'c') {
        e.preventDefault();
        e.stopPropagation();
        clearAll();
      } else if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, inputDigit, inputDot, performOperation, calculateEquals, inputPercent, inputBackspace, clearAll, onClose]);

  if (!isOpen) return null;

  // Format Bengali Display
  const numVal = parseFloat(display);
  const formattedBn = !isNaN(numVal) && isFinite(numVal) && display !== 'Error'
    ? (display.includes('.')
        ? toBnDigits(display)
        : formatTakaBn(numVal, false))
    : (display === 'Error' ? 'ত্রুটি' : toBnDigits(display));

  const historyBn = toBnDigits(
    history
      .replace(/\*/g, '×')
      .replace(/\//g, '÷')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 select-none animate-in fade-in duration-150">
      {/* Semi-transparent Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
      />

      {/* Floating Calculator Window */}
      <div className="relative w-full max-w-[340px] sm:max-w-[360px] bg-[#071929] text-white border-2 border-amber-500/40 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-10 overflow-hidden flex flex-col p-4 animate-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-teal-900/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300">
              <Calculator className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-wide flex items-center gap-1.5">
                <span>ডিজিটাল ক্যালকুলেটর</span>
              </h3>
              <p className="text-[10px] text-amber-300/80 font-medium">শস্য ক্রয়-বিক্রয় ও নগদ হিসাব</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-slate-800 text-slate-400 border border-slate-700">
              F8
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="বন্ধ করুন (Esc)"
              aria-label="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Display Screen */}
        <div className="bg-[#030d17] border border-slate-700/80 rounded-2xl p-3.5 shadow-inner mb-3.5 flex flex-col justify-between min-h-[95px]">
          {/* Top Line: Running History */}
          <div className="text-right text-xs font-mono text-slate-400 h-5 overflow-hidden text-ellipsis whitespace-nowrap">
            {historyBn || <span className="opacity-0">0</span>}
          </div>

          {/* Main Line: Current Value / Result */}
          <div className="text-right text-3xl sm:text-4xl font-black text-amber-300 font-mono tracking-tight leading-tight truncate">
            {formattedBn}
          </div>

          {/* Bottom sub-line: English Raw Number + Copy Button */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 mt-1">
            <span className="text-[11px] font-mono text-slate-500 truncate max-w-[170px]">
              {display !== 'Error' ? display : ''}
            </span>

            <button
              type="button"
              onClick={handleCopyResult}
              disabled={display === 'Error'}
              className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
              title="ফলাফল কপি করুন"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">কপি হয়েছে!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-amber-300" />
                  <span>কপি</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Buttons Grid (Touch & Click Friendly) */}
        <div className="grid grid-cols-4 gap-2">
          {/* Row 1: C, ⌫, %, ÷ */}
          <button
            type="button"
            onClick={clearAll}
            className="h-11 sm:h-12 rounded-xl text-sm font-black bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 active:scale-95 transition-all cursor-pointer shadow-xs"
            title="সব মুছুন (C / Delete)"
          >
            C
          </button>
          <button
            type="button"
            onClick={inputBackspace}
            className="h-11 sm:h-12 rounded-xl text-sm font-bold bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-xs"
            title="মুছুন (Backspace)"
          >
            <Delete className="w-4 h-4 text-slate-300" />
          </button>
          <button
            type="button"
            onClick={inputPercent}
            className="h-11 sm:h-12 rounded-xl text-sm font-black bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-amber-300 active:scale-95 transition-all cursor-pointer shadow-xs"
            title="শতকরা (%)"
          >
            %
          </button>
          <button
            type="button"
            onClick={() => performOperation('÷')}
            className={`h-11 sm:h-12 rounded-xl text-lg font-black border active:scale-95 transition-all cursor-pointer shadow-xs ${
              operator === '÷'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/40 text-amber-300'
            }`}
            title="ভাগ (/)"
          >
            ÷
          </button>

          {/* Row 2: 7, 8, 9, × */}
          <button
            type="button"
            onClick={() => inputDigit('7')}
            className="h-11 sm:h-12 rounded-xl text-base font-bold bg-[#0d223a] hover:bg-[#122e4e] border border-slate-700/70 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            ৭ <span className="text-[10px] text-slate-400 font-mono">(7)</span>
          </button>
          <button
            type="button"
            onClick={() => inputDigit('8')}
            className="h-11 sm:h-12 rounded-xl text-base font-bold bg-[#0d223a] hover:bg-[#122e4e] border border-slate-700/70 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            ৮ <span className="text-[10px] text-slate-400 font-mono">(8)</span>
          </button>
          <button
            type="button"
            onClick={() => inputDigit('9')}
            className="h-11 sm:h-12 rounded-xl text-base font-bold bg-[#0d223a] hover:bg-[#122e4e] border border-slate-700/70 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            ৯ <span className="text-[10px] text-slate-400 font-mono">(9)</span>
          </button>
          <button
            type="button"
            onClick={() => performOperation('×')}
            className={`h-11 sm:h-12 rounded-xl text-lg font-black border active:scale-95 transition-all cursor-pointer shadow-xs ${
              operator === '×'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/40 text-amber-300'
            }`}
            title="গুণ (*)"
          >
            ×
          </button>

          {/* Row 3: 4, 5, 6, - */}
          <button
            type="button"
            onClick={() => inputDigit('4')}
            className="h-11 sm:h-12 rounded-xl text-base font-bold bg-[#0d223a] hover:bg-[#122e4e] border border-slate-700/70 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            ৪ <span className="text-[10px] text-slate-400 font-mono">(4)</span>
          </button>
          <button
            type="button"
            onClick={() => inputDigit('5')}
            className="h-11 sm:h-12 rounded-xl text-base font-bold bg-[#0d223a] hover:bg-[#122e4e] border border-slate-700/70 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            ৫ <span className="text-[10px] text-slate-400 font-mono">(5)</span>
          </button>
          <button
            type="button"
            onClick={() => inputDigit('6')}
            className="h-11 sm:h-12 rounded-xl text-base font-bold bg-[#0d223a] hover:bg-[#122e4e] border border-slate-700/70 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            ৬ <span className="text-[10px] text-slate-400 font-mono">(6)</span>
          </button>
          <button
            type="button"
            onClick={() => performOperation('-')}
            className={`h-11 sm:h-12 rounded-xl text-lg font-black border active:scale-95 transition-all cursor-pointer shadow-xs ${
              operator === '-'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/40 text-amber-300'
            }`}
            title="বিয়োগ (-)"
          >
            -
          </button>

          {/* Row 4: 1, 2, 3, + */}
          <button
            type="button"
            onClick={() => inputDigit('1')}
            className="h-11 sm:h-12 rounded-xl text-base font-bold bg-[#0d223a] hover:bg-[#122e4e] border border-slate-700/70 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            ১ <span className="text-[10px] text-slate-400 font-mono">(1)</span>
          </button>
          <button
            type="button"
            onClick={() => inputDigit('2')}
            className="h-11 sm:h-12 rounded-xl text-base font-bold bg-[#0d223a] hover:bg-[#122e4e] border border-slate-700/70 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            ২ <span className="text-[10px] text-slate-400 font-mono">(2)</span>
          </button>
          <button
            type="button"
            onClick={() => inputDigit('3')}
            className="h-11 sm:h-12 rounded-xl text-base font-bold bg-[#0d223a] hover:bg-[#122e4e] border border-slate-700/70 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            ৩ <span className="text-[10px] text-slate-400 font-mono">(3)</span>
          </button>
          <button
            type="button"
            onClick={() => performOperation('+')}
            className={`h-11 sm:h-12 rounded-xl text-lg font-black border active:scale-95 transition-all cursor-pointer shadow-xs ${
              operator === '+'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/40 text-amber-300'
            }`}
            title="যোগ (+)"
          >
            +
          </button>

          {/* Row 5: 00, 0, ., = */}
          <button
            type="button"
            onClick={() => inputDigit('00')}
            className="h-11 sm:h-12 rounded-xl text-sm font-bold bg-[#0d223a] hover:bg-[#122e4e] border border-slate-700/70 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
            title="ডাবল শূন্য (00)"
          >
            ০০
          </button>
          <button
            type="button"
            onClick={() => inputDigit('0')}
            className="h-11 sm:h-12 rounded-xl text-base font-bold bg-[#0d223a] hover:bg-[#122e4e] border border-slate-700/70 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            ০ <span className="text-[10px] text-slate-400 font-mono">(0)</span>
          </button>
          <button
            type="button"
            onClick={inputDot}
            className="h-11 sm:h-12 rounded-xl text-lg font-black bg-[#0d223a] hover:bg-[#122e4e] border border-slate-700/70 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
            title="দশমিক (.)"
          >
            .
          </button>
          <button
            type="button"
            onClick={calculateEquals}
            className="h-11 sm:h-12 rounded-xl text-xl font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/60 shadow-[0_0_15px_rgba(16,185,129,0.35)] active:scale-95 transition-all cursor-pointer flex items-center justify-center"
            title="ফলাফল হিসাব করুন (= / Enter)"
          >
            =
          </button>
        </div>
      </div>
    </div>
  );
};
