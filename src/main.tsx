import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

// Emergency DOM Screen in case React fails to mount or crashes outside ErrorBoundary
function showEmergencyScreen(title: string, message: string, stack?: string) {
  const root = document.getElementById('root');
  if (!root) return;

  // If root already has rich content rendered and isn't empty/loader, avoid clobbering active UI
  if (root.children.length > 0 && !root.querySelector('.pre-mount-loader')) {
    const textLen = (root.textContent || '').trim().length;
    if (textLen > 10) return;
  }

  root.innerHTML = `
    <div style="min-height: 100vh; width: 100%; background: #0B0F19; color: #F1F5F9; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px; box-sizing: border-box; user-select: none;">
      <div style="max-width: 600px; width: 100%; background: #111827; border: 1px solid #DC2626; border-radius: 16px; padding: 28px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);">
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 20px;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid #EF4444; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #EF4444;">⚠️</div>
          <div>
            <h2 style="margin: 0; font-size: 19px; color: #F87171; font-weight: 700;">${title}</h2>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #9CA3AF;">অ্যাপ্লিকেশন রেন্ডারার সুরক্ষিত মোডে চালু হয়েছে। ডাটাবেজ নিরাপদ রয়েছে।</p>
          </div>
        </div>
        <div style="background: #030712; border: 1px solid #1F2937; border-radius: 10px; padding: 14px; margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 600; color: #EF4444; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">ত্রুটি বিবরণ (Error Details)</div>
          <div style="font-family: monospace; font-size: 12px; color: #FCA5A5; word-break: break-all; max-height: 120px; overflow-y: auto;">${message}</div>
          ${stack ? `<pre style="margin: 8px 0 0 0; font-family: monospace; font-size: 10px; color: #6B7280; max-height: 100px; overflow-y: auto; white-space: pre-wrap;">${stack}</pre>` : ''}
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
          <button onclick="window.location.reload()" style="flex: 1; min-width: 140px; background: #059669; color: #fff; border: none; padding: 12px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;">উইন্ডো রিলোড</button>
          <button onclick="sessionStorage.clear(); localStorage.removeItem('maha_zoom_factor'); window.location.reload()" style="flex: 1; min-width: 140px; background: #374151; color: #E5E7EB; border: 1px solid #4B5563; padding: 12px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;">ক্যাশ রিসেট ও রিলোড</button>
          <button onclick="if(window.api?.system?.relaunch){window.api.system.relaunch();}else{window.location.reload();}" style="flex: 1; min-width: 140px; background: #1F2937; color: #9CA3AF; border: 1px solid #374151; padding: 12px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;">অ্যাপ্লিকেশন রিস্টার্ট</button>
        </div>
        <div style="margin-top: 18px; text-align: center; font-size: 11px; color: #4B5563;">মাহা এন্টারপ্রাইজ ইআরপি • সংস্করণ ১.৫.০ প্রো • আল জাবি সরকার</div>
      </div>
    </div>
  `;
}

// Global Exception and Unhandled Rejection Listeners
window.addEventListener('error', (e) => {
  const errMsg = e.error?.message || e.message || 'অজানা গ্লোবাল এরর';
  const errStack = e.error?.stack || '';
  console.error('Global Renderer Error:', e.error || e.message);

  if ((window as any).api?.system?.logError) {
    (window as any).api.system.logError(`[Renderer-Error] ${errMsg}\nStack: ${errStack}`);
  }

  showEmergencyScreen('গ্লোবাল রেন্ডারার ত্রুটি (Global Error)', errMsg, errStack);
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason?.message || e.reason?.stack || String(e.reason);
  console.error('Unhandled Promise Rejection:', e.reason);

  if ((window as any).api?.system?.logError) {
    (window as any).api.system.logError(`[Renderer-UnhandledRejection] ${reason}`);
  }

  // If root is still empty or shows pre-mount loader, unhandled rejection blocked startup
  const root = document.getElementById('root');
  if (root && (root.children.length === 0 || root.querySelector('.pre-mount-loader'))) {
    showEmergencyScreen('স্টার্টআপ লোডিং ব্যর্থ (Startup Rejection)', reason);
  }
});

const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary fallbackTitle="মাহা এন্টারপ্রাইজ - সিস্টেম রিকভারি">
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (err: any) {
    console.error('Failed to mount React application:', err);
    showEmergencyScreen('অ্যাপ্লিকেশন মাউন্ট ব্যর্থ (Mount Failed)', err.message, err.stack);
  }
} else {
  console.error('Fatal: #root element not found in DOM');
}
