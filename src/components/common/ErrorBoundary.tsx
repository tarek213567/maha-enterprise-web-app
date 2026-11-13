import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Copy, Check, Terminal } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);

    // Forward to electron diagnostics log if available
    try {
      const fullError = `[React-Crash] ${error.name}: ${error.message}\nStack: ${error.stack}\nComponent Stack: ${errorInfo.componentStack}`;
      if (typeof window !== 'undefined' && (window as any).api?.system?.logError) {
        (window as any).api.system.logError(fullError);
      }
    } catch (e) {
      console.warn('Failed to forward error to main logger:', e);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearAndReload = () => {
    try {
      sessionStorage.clear();
      // Keep license or critical keys if any, clear UI states
      localStorage.removeItem('maha_active_tab');
      localStorage.removeItem('maha_zoom_factor');
    } catch (e) {}
    window.location.reload();
  };

  private handleRelaunch = () => {
    if (typeof window !== 'undefined' && (window as any).api?.system?.relaunch) {
      (window as any).api.system.relaunch();
    } else {
      window.location.reload();
    }
  };

  private handleCopyError = () => {
    const errorText = `Maha Enterprise (v1.5.0 PRO) Crash Report
Time: ${new Date().toISOString()}
Error: ${this.state.error?.name || 'Error'}: ${this.state.error?.message || 'Unknown'}
Stack:
${this.state.error?.stack || 'No stack trace'}

Component Stack:
${this.state.errorInfo?.componentStack || 'No component stack'}
`;
    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#0B0F19] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-8 select-none font-sans">
          <div className="max-w-2xl w-full bg-slate-900/90 border border-rose-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {this.props.fallbackTitle || 'সফটওয়্যার রেন্ডারার রিকভারি মোড'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  একটি অপ্রত্যাশিত ত্রুটির কারণে ইন্টারফেসটি রিকভারি স্ক্রিনে চলে এসেছে। আপনার ব্যবসায়িক ডাটাবেজ সম্পূর্ণ নিরাপদ আছে।
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 mb-6 text-left">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  ত্রুটি বিবরণ (Error Details)
                </span>
                <button
                  onClick={this.handleCopyError}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-[11px]"
                  title="লগ কপি করুন"
                >
                  {this.state.copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">কপি হয়েছে</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>রিপোর্ট কপি করুন</span>
                    </>
                  )}
                </button>
              </div>
              <div className="font-mono text-xs text-rose-300 break-words max-h-36 overflow-y-auto pr-1">
                {this.state.error?.name}: {this.state.error?.message || 'অজানা ত্রুটি'}
              </div>
              {this.state.error?.stack && (
                <details className="mt-2 text-[11px] font-mono text-slate-500">
                  <summary className="cursor-pointer hover:text-slate-400 transition-colors">
                    স্ট্যাক ট্রেস দেখুন (Stack Trace)
                  </summary>
                  <pre className="mt-2 p-2 bg-slate-900/90 rounded border border-slate-800/80 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto text-slate-400">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-950/40 active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>পুনরায় ইন্টারফেস চালু করুন</span>
              </button>

              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all border border-slate-700 active:scale-[0.98]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>উইন্ডো রিলোড করুন (F5)</span>
              </button>

              <button
                onClick={this.handleClearAndReload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-amber-300/90 font-medium text-xs transition-all border border-slate-700/80 active:scale-[0.98]"
              >
                <span>ক্যাশ রিসেট করে রিলোড</span>
              </button>

              <button
                onClick={this.handleRelaunch}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 font-medium text-xs transition-all border border-slate-700/80 active:scale-[0.98]"
              >
                <span>অ্যাপ্লিকেশন রিস্টার্ট দিন</span>
              </button>
            </div>

            {/* Footer Notice */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-slate-500 text-xs">
              মাহা এন্টারপ্রাইজ ইআরপি • সংস্করণ ১.৫.০ প্রো • আল জাবি সরকার
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
