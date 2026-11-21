import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { SecurityProvider } from './context/SecurityContext';
import { PinLockOverlay } from './components/security/PinLockOverlay';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { BottomStatusBar } from './components/layout/BottomStatusBar';
import { MobileNav } from './components/layout/MobileNav';
import { MobileSidebarDrawer } from './components/layout/MobileSidebarDrawer';
import { CalculatorModal } from './components/calculator/CalculatorModal';
import { DashboardView } from './components/dashboard/DashboardView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { SalesView } from './components/sales/SalesView';
import { StockView } from './components/stock/StockView';
import { PartyLedgerView } from './components/ledgers/PartyLedgerView';
import { CreditorLedgerView } from './components/creditors/CreditorLedgerView';
import { DailyCashbookView } from './components/cashbook/DailyCashbookView';
import { ExpenseView } from './components/expenses/ExpenseView';
import { PnLView } from './components/reports/PnLView';
import { SettingsBackupView } from './components/settings/SettingsBackupView';
import { NotebookView } from './components/notebook/NotebookView';
import { RecycleBinView } from './components/recycle-bin/RecycleBinView';
import { AiDynamicOverrideInjector } from './components/ai/AiDynamicOverrideInjector';
import { AiFloatingOrb } from './components/ai/AiFloatingOrb';
import { AiManezarModal } from './components/ai/AiManezarModal';
import { dbService } from './services/api';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { CheckCircle2, AlertCircle, MoreVertical } from 'lucide-react';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Listen to open-ai-manezar events from buttons across the app
  useEffect(() => {
    const handleOpenAi = () => setIsAiModalOpen(true);
    window.addEventListener('open-ai-manezar', handleOpenAi);
    return () => window.removeEventListener('open-ai-manezar', handleOpenAi);
  }, []);

  // Load initial zoom factor & listen to changes
  useEffect(() => {
    const saved = localStorage.getItem('maha_zoom_factor');
    const factor = saved ? parseFloat(saved) : 1.0;
    if (!isNaN(factor)) {
      if ((window as any).desktopAPI?.setZoom) {
        (window as any).desktopAPI.setZoom(factor);
      }
      (document.documentElement.style as any).zoom = `${factor}`;
    }
  }, []);

  // Google Drive & Local Auto-Backup Scheduler: 13:00 & 19:00 with offline catch-up
  useEffect(() => {
    const checkAndTriggerBackup = async () => {
      const now = new Date();
      const currentHour = now.getHours();
      const todayDateStr = now.toISOString().split('T')[0];

      // Slot 1: 13:00 (1:00 PM)
      const slot1Key = `maha_backup_slot1_${todayDateStr}`;
      if (currentHour >= 13 && !localStorage.getItem(slot1Key)) {
        try {
          await dbService.system.backup();
          localStorage.setItem(slot1Key, new Date().toISOString());
        } catch (e) {
          console.warn('[AutoBackup] 13:00 backup skipped:', e);
        }
      }

      // Slot 2: 19:00 (7:00 PM)
      const slot2Key = `maha_backup_slot2_${todayDateStr}`;
      if (currentHour >= 19 && !localStorage.getItem(slot2Key)) {
        try {
          await dbService.system.backup();
          localStorage.setItem(slot2Key, new Date().toISOString());
        } catch (e) {
          console.warn('[AutoBackup] 19:00 backup skipped:', e);
        }
      }
    };

    checkAndTriggerBackup();

    const handleOnline = () => {
      checkAndTriggerBackup();
    };
    window.addEventListener('online', handleOnline);
    const interval = setInterval(checkAndTriggerBackup, 60000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, []);

  // Global Keyboard Shortcuts (F1: Dashboard, F2: Purchases, F3: Sales, F4: Cashbook, Ctrl +/-/0: Zoom)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Zoom shortcuts: Ctrl + +, Ctrl + -, Ctrl + 0
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          const cur = parseFloat(localStorage.getItem('maha_zoom_factor') || '1.0');
          const next = Math.min(1.5, Math.round((cur + 0.05) * 100) / 100);
          if ((window as any).desktopAPI?.setZoom) (window as any).desktopAPI.setZoom(next);
          (document.documentElement.style as any).zoom = `${next}`;
          localStorage.setItem('maha_zoom_factor', next.toString());
          window.dispatchEvent(new CustomEvent('maha-zoom-changed', { detail: next }));
          return;
        } else if (e.key === '-') {
          e.preventDefault();
          const cur = parseFloat(localStorage.getItem('maha_zoom_factor') || '1.0');
          const next = Math.max(0.7, Math.round((cur - 0.05) * 100) / 100);
          if ((window as any).desktopAPI?.setZoom) (window as any).desktopAPI.setZoom(next);
          (document.documentElement.style as any).zoom = `${next}`;
          localStorage.setItem('maha_zoom_factor', next.toString());
          window.dispatchEvent(new CustomEvent('maha-zoom-changed', { detail: next }));
          return;
        } else if (e.key === '0') {
          e.preventDefault();
          const next = 1.0;
          if ((window as any).desktopAPI?.setZoom) (window as any).desktopAPI.setZoom(next);
          (document.documentElement.style as any).zoom = `${next}`;
          localStorage.setItem('maha_zoom_factor', next.toString());
          window.dispatchEvent(new CustomEvent('maha-zoom-changed', { detail: next }));
          return;
        }
      }

      if (e.key === 'F8') {
        e.preventDefault();
        setIsCalculatorOpen((prev) => !prev);
        return;
      }

      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      if (e.key === 'F1') {
        e.preventDefault();
        setCurrentTab('dashboard');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setCurrentTab('purchases');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setCurrentTab('sales');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setCurrentTab('cashbook');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const handleQuickBackup = async () => {
    try {
      const res = await dbService.system.backup();
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (e: any) {
      showToast(`ব্যর্থ: ${e.message}`, 'error');
    }
  };

  return (
    <div className="h-screen w-screen bg-[var(--app-bg)] text-[var(--text-primary)] flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950 transition-colors duration-200 overflow-hidden select-none">
      {/* Main Application Workspace: Sidebar (Left) + Viewport (Right) - Flush with Top Edge */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Vertical Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          onQuickBackup={handleQuickBackup}
          onOpenCalculator={() => setIsCalculatorOpen(true)}
        />

        {/* Right Scrollable Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#f1f5f9] transition-colors duration-200">
          {/* Top Header Action Bar (Hidden on Dashboard for Design #2 Clean Shell) */}
          {currentTab !== 'dashboard' && (
            <TopHeader
              currentTab={currentTab}
              onOpenQuickPurchase={() => setCurrentTab('purchases')}
              onOpenQuickSale={() => setCurrentTab('sales')}
            />
          )}

          {/* Module Content */}
          <ErrorBoundary fallbackTitle="মডিউল রেন্ডারার রিকভারি">
            <main className="flex-1 max-w-[1550px] w-full mx-auto p-3 sm:p-4">
              {currentTab === 'dashboard' && (
                <DashboardView
                  onNavigate={setCurrentTab}
                  onOpenQuickPurchase={() => setCurrentTab('purchases')}
                  onOpenQuickSale={() => setCurrentTab('sales')}
                />
              )}

              {currentTab === 'purchases' && <PurchasesView initialMode="FORM" />}

              {currentTab === 'sales' && <SalesView initialMode="FORM" />}

              {currentTab === 'stock' && <StockView />}

              {currentTab === 'ledgers' && <PartyLedgerView />}

              {currentTab === 'creditors' && <CreditorLedgerView />}

              {currentTab === 'cashbook' && <DailyCashbookView />}

              {currentTab === 'expenses' && <ExpenseView />}

              {currentTab === 'reports' && <PnLView />}

              {currentTab === 'settings' && <SettingsBackupView />}

              {currentTab === 'notebook' && <NotebookView />}

              {currentTab === 'recycle_bin' && <RecycleBinView />}
            </main>
          </ErrorBoundary>
        </div>
      </div>

      {/* 3. Bottom Desktop Status Bar */}
      <BottomStatusBar />

      {/* 4. Mobile Bottom Navigation Bar (iPhone / Smartphone Safari & Chrome) */}
      <MobileNav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onOpenMenu={() => setIsMobileDrawerOpen(true)}
      />

      {/* Mobile Floating Three-Dot (⋮) Menu Button on Left Side */}
      <button
        type="button"
        onClick={() => setIsMobileDrawerOpen(true)}
        className="fixed top-3 left-3 z-40 md:hidden flex items-center justify-center w-9 h-9 rounded-full border border-amber-400/50 bg-slate-950/80 backdrop-blur-md text-amber-300 hover:text-amber-200 shadow-lg active:scale-95 transition-all cursor-pointer"
        title="মেনু ড্রয়ার খুলুন"
        aria-label="মেনু ড্রয়ার খুলুন"
      >
        <MoreVertical className="w-5 h-5 text-amber-300" />
      </button>

      {/* Slide-over Full Mobile Sidebar Drawer */}
      <MobileSidebarDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onQuickBackup={handleQuickBackup}
        onOpenCalculator={() => setIsCalculatorOpen(true)}
      />

      {/* Interactive Business Calculator Modal (F8) */}
      <CalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-10 right-6 z-50 animate-in slide-in-from-bottom duration-200">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-bold ${
              toast.type === 'success'
                ? 'bg-emerald-950 text-white border-emerald-700'
                : 'bg-rose-950 text-white border-rose-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* 4. Fullscreen Security PIN Code Startup Lock Overlay */}
      <PinLockOverlay />

      {/* 5. Dynamic Overrides Injector (CSS & UI configs backed by 60-day snapshots) */}
      <AiDynamicOverrideInjector />

      {/* 6. Cosmic Gemini Floating Sparkle Orb (46px x 46px) */}
      <AiFloatingOrb onClick={() => setIsAiModalOpen(true)} />

      {/* 7. Ai Manezar (Gemini 3 Flash) Cosmic-Dark Workspace Modal */}
      <AiManezarModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onNavigate={setCurrentTab}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary fallbackTitle="মাহা এন্টারপ্রাইজ - ইন্টারফেস রিকভারি">
      <ThemeProvider>
        <SecurityProvider>
          <AppContent />
        </SecurityProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};
