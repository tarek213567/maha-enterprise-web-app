import React from 'react';
import { toBnDigits } from '../../utils/bengaliNumbers';

interface Props {
  cashAmount: number;
  dueAmount: number;
}

export const SalesBarChart: React.FC<Props> = ({ cashAmount, dueAmount }) => {
  const maxVal = Math.max(40000, cashAmount, dueAmount, 1000);
  const height = 140;
  
  // 5 Y-ticks
  const step = Math.ceil(maxVal / 4 / 500) * 500;
  const yTicks = [step * 4, step * 3, step * 2, step * 1, 0];

  const cashHeight = Math.min(height, Math.max(8, Math.round((cashAmount / (step * 4 || 1)) * height)));
  const dueHeight = Math.min(height, Math.max(8, Math.round((dueAmount / (step * 4 || 1)) * height)));

  return (
    <div className="w-full h-44 flex flex-col justify-end pt-2 pb-1 select-none">
      {/* Chart Canvas Area */}
      <div className="flex-1 flex items-stretch gap-3 relative">
        {/* Y Axis Grid & Labels */}
        <div className="w-14 flex flex-col justify-between text-[11px] text-[var(--text-muted)] font-mono text-right pr-2">
          {yTicks.map((val) => (
            <span key={val}>{toBnDigits(val)}</span>
          ))}
        </div>

        {/* Grid lines and Bars */}
        <div className="flex-1 relative flex items-end justify-around border-b border-[var(--border-color)] px-4">
          {/* Horizontal Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {yTicks.map((val) => (
              <div key={val} className="w-full border-b border-[var(--border-color)]/40 h-0"></div>
            ))}
          </div>

          {/* Bar 1: নগদ (Blue) */}
          <div className="relative z-10 flex flex-col items-center group w-14">
            <span className="text-[11px] font-black text-[var(--text-primary)] font-sans mb-1 transition-transform group-hover:scale-110">
              {toBnDigits(cashAmount)}
            </span>
            <div
              className="w-12 bg-[#0080ff] hover:bg-blue-600 rounded-t-sm shadow-2xs transition-all duration-500"
              style={{ height: `${cashHeight}px` }}
              title={`নগদ: ৳ ${toBnDigits(cashAmount)}`}
            ></div>
          </div>

          {/* Bar 2: বাকি (Orange) */}
          <div className="relative z-10 flex flex-col items-center group w-14">
            <span className="text-[11px] font-black text-[var(--text-primary)] font-sans mb-1 transition-transform group-hover:scale-110">
              {toBnDigits(dueAmount)}
            </span>
            <div
              className="w-12 bg-[#ff8400] hover:bg-orange-600 rounded-t-sm shadow-2xs transition-all duration-500"
              style={{ height: `${dueHeight}px` }}
              title={`বাকি: ৳ ${toBnDigits(dueAmount)}`}
            ></div>
          </div>
        </div>
      </div>

      {/* X Axis Labels */}
      <div className="flex pl-16 pr-4 justify-around text-xs font-bold text-[var(--text-secondary)] mt-1.5">
        <span className="w-14 text-center">নগদ</span>
        <span className="w-14 text-center">বাকি</span>
      </div>
    </div>
  );
};

