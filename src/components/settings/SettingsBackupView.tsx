import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Database,
  Download,
  RotateCcw,
  RefreshCw,
  Store,
  Wheat,
  Plus,
  Edit2,
  Save,
  CheckCircle2,
  HardDrive,
  FolderOpen,
  ShieldCheck,
  Lock,
  Palette,
  Check,
  Sparkles,
  AlertTriangle,
  X,
  Cloud,
  UploadCloud,
  DownloadCloud,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Settings2,
  Trash2,
} from 'lucide-react';
import { dbService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useSecurity } from '../../context/SecurityContext';
import { APP_CONFIG } from '../../config/appConfig';
import { Commodity } from '../../types';
import { toBnDigits, parseSmartNumber, toBengaliDigits, toEnglishDigits } from '../../utils/bengaliNumbers';

export const SettingsBackupView: React.FC = () => {
  const { theme, setTheme, themes, isDark } = useTheme();
  const { lockApp, changePin, getActivePin } = useSecurity();

  // Settings State
  const [paths, setPaths] = useState<{ dbPath: string; backupDir: string }>({ dbPath: '', backupDir: '' });
  const [appVersion, setAppVersion] = useState<string>(APP_CONFIG.version);

  // Shop Info State
  const [shopName, setShopName] = useState(APP_CONFIG.name);
  const [subTitle, setSubTitle] = useState(APP_CONFIG.subtitle);
  const [phone, setPhone] = useState(APP_CONFIG.contacts);
  const [address, setAddress] = useState(APP_CONFIG.location);
  const [savingShop, setSavingShop] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Backup & Restore State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string>('');

  // Private Premium Cloud Vault State (v1.5.0 PRO)
  const ownerName = 'আল জাবির সরকার';
  const targetId = '1904683489';
  const [cloudFolder, setCloudFolder] = useState('Maha_Enterprise_Backups');
  const [isCloudBackingUp, setIsCloudBackingUp] = useState(false);
  const [cloudBackupMessage, setCloudBackupMessage] = useState<string>('');
  const [isCloudRestoreModalOpen, setIsCloudRestoreModalOpen] = useState(false);
  const [isCloudFilesModalOpen, setIsCloudFilesModalOpen] = useState(false);
  const [isPrivateConfigOpen, setIsPrivateConfigOpen] = useState(false);
  const [activeBackupTab, setActiveBackupTab] = useState<'cloud' | 'local'>('cloud');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [cloudBackups, setCloudBackups] = useState<Array<{ id: string; name: string; size?: string; createdTime?: string; isCloud: boolean }>>([]);
  const [selectedCloudBackupId, setSelectedCloudBackupId] = useState<string>('');
  const [isLoadingCloudBackups, setIsLoadingCloudBackups] = useState(false);

  // Display Zoom & Scaling State
  const [zoomFactor, setZoomFactor] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('maha_zoom_factor');
      return saved ? parseFloat(saved) : 1.0;
    }
    return 1.0;
  });

  const applyZoom = (factor: number) => {
    const clamped = Math.min(1.5, Math.max(0.7, Math.round(factor * 100) / 100));
    setZoomFactor(clamped);
    if (typeof window !== 'undefined') {
      if ((window as any).desktopAPI?.setZoom) {
        (window as any).desktopAPI.setZoom(clamped);
      }
      (document.documentElement.style as any).zoom = `${clamped}`;
      localStorage.setItem('maha_zoom_factor', clamped.toString());
      window.dispatchEvent(new CustomEvent('maha-zoom-changed', { detail: clamped }));
    }
  };

  // Commodities List State (শস্যের জাত)
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [editingCommId, setEditingCommId] = useState<number | null>(null);
  const [editCommName, setEditCommName] = useState('');
  const [showAddCommModal, setShowAddCommModal] = useState(false);
  const [newCommNameBn, setNewCommNameBn] = useState('');
  const [newCommNameEn, setNewCommNameEn] = useState('');
  const [newCommBagKg, setNewCommBagKg] = useState('80');
  const [newCommNotes, setNewCommNotes] = useState('');
  const [addingComm, setAddingComm] = useState(false);

  // PIN Security State
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinFeedback, setPinFeedback] = useState<{ isSuccess: boolean; text: string } | null>(null);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  useEffect(() => {
    loadAllData();

    const handleZoomSync = (e: any) => {
      if (e.detail) setZoomFactor(e.detail);
    };
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('maha-zoom-changed', handleZoomSync);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubDrive = dbService.drive.onBackupResult((data) => {
      setCloudBackupMessage(`✅ [অটো-ব্যাকআপ শিডিউল ${data.slot}] ${data.message}`);
    });

    const unsubToken = dbService.drive.onTokenUpdated?.(() => {
      setCloudBackupMessage('✅ প্রাইভেট ক্লাউড সার্ভার সংযোগ সফলভাবে সম্পন্ন হয়েছে!');
      loadAllData();
    });

    return () => {
      window.removeEventListener('maha-zoom-changed', handleZoomSync);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (typeof unsubDrive === 'function') unsubDrive();
      if (typeof unsubToken === 'function') unsubToken();
    };
  }, []);

  // Test Drafts State
  const [hasDrafts, setHasDrafts] = useState(false);
  const [isPurgingDrafts, setIsPurgingDrafts] = useState(false);

  useEffect(() => {
    const checkDrafts = async () => {
      try {
        const d = await dbService.system.hasTestDrafts();
        setHasDrafts(d);
      } catch {}
    };
    checkDrafts();
  }, []);

  const handlePurgeTestDrafts = async () => {
    if (!confirm('আপনি কি নিশ্চিত যে সকল টেস্ট ড্রাফট লেনদেন মুছে ফেলে স্টক ও খতিয়ান ব্যালেন্স পূর্বের অবস্থায় ফিরিয়ে নিতে চান?\n\n(শুধুমাত্র is_test_draft = 1 চিহ্নিত ডাটা মুছে ফেলা হবে)')) {
      return;
    }
    try {
      setIsPurgingDrafts(true);
      const res = await dbService.system.purgeTestDrafts();
      alert(res.message || 'সকল টেস্ট ড্রাফট ডাটা সফলভাবে মুছে ফেলা হয়েছে।');
      setHasDrafts(false);
      window.location.reload();
    } catch (err: any) {
      alert('ত্রুটি: ' + (err.message || 'মুছে ফেলতে ব্যর্থ হয়েছে'));
    } finally {
      setIsPurgingDrafts(false);
    }
  };

  // Private Premium Cloud Vault Handlers
  const loadCloudBackupsList = async () => {
    setIsLoadingCloudBackups(true);
    try {
      const list = await dbService.drive.listBackups();
      setCloudBackups(list);
      if (list.length > 0) {
        setSelectedCloudBackupId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to list cloud backups:', err);
    } finally {
      setIsLoadingCloudBackups(false);
    }
  };

  const handleCloudUpload = async () => {
    setIsCloudBackingUp(true);
    setCloudBackupMessage('');
    try {
      if (!navigator.onLine) {
        setCloudBackupMessage('⚠️ ইন্টারনেট সংযোগ বিচ্ছিন্ন। ইন্টারনেট ফিরে এলে স্বয়ংক্রিয় ব্যাকআপ নেওয়া হবে।');
        return;
      }
      const res = await dbService.drive.upload();
      if (res.success) {
        setCloudBackupMessage(`✅ ${res.message}`);
        await loadCloudBackupsList();
      } else {
        setCloudBackupMessage(`❌ ${res.message}`);
      }
    } catch (err: any) {
      setCloudBackupMessage(`❌ ক্লাউড ব্যাকআপ ত্রুটি: ${err.message}`);
    } finally {
      setIsCloudBackingUp(false);
    }
  };

  const handleOpenCloudRestore = async () => {
    setIsCloudRestoreModalOpen(true);
    await loadCloudBackupsList();
  };

  const handleOpenCloudFiles = async () => {
    setIsCloudFilesModalOpen(true);
    await loadCloudBackupsList();
  };

  const handleExecuteCloudRestore = async (backupId?: string) => {
    const fileIdToRestore = backupId || selectedCloudBackupId;
    if (!fileIdToRestore && cloudBackups.length > 0) {
      // Pick first available
    }
    if (!confirm('আপনি কি ক্লাউড ব্যাকআপটি রিস্টোর করতে চান? বর্তমান ডাটাবেজের একটি স্বয়ংক্রিয় সেফটি ব্যাকআপ লোকাল ড্রাইভে তৈরি করে রাখা হবে।')) {
      return;
    }
    setIsRestoring(true);
    try {
      const res = await dbService.drive.restoreBackup(fileIdToRestore || '');
      if (res.success) {
        alert(res.message + '\n\nসফটওয়্যারটি এখন নতুন ডাটা নিয়ে পুনরায় চালু হচ্ছে...');
        dbService.system.relaunch();
      } else {
        alert('রিস্টোর ব্যর্থ: ' + res.message);
      }
    } catch (err: any) {
      alert('রিস্টোর ত্রুটি: ' + err.message);
    } finally {
      setIsRestoring(false);
      setIsCloudRestoreModalOpen(false);
      setIsCloudFilesModalOpen(false);
    }
  };

  const loadAllData = async () => {
    try {
      const [s, p, ver, comms, driveStat] = await Promise.all([
        dbService.system.getSettings(),
        dbService.system.getPaths(),
        dbService.system.getVersion(),
        dbService.commodities.getAll(),
        dbService.drive.getStatus(),
      ]);

      if (s.org_name) setShopName(s.org_name);
      if (s.sub_title) setSubTitle(s.sub_title);
      if (s.contacts) setPhone(s.contacts);
      if (s.location) setAddress(s.location);

      setPaths(p);
      setAppVersion(ver || APP_CONFIG.version);
      setCommodities(comms);

      if (driveStat) {
        if (driveStat.folderName) setCloudFolder(driveStat.folderName);
        if (driveStat.lastBackupTime && driveStat.lastBackupFile) {
          setCloudBackupMessage(`সর্বশেষ ব্যাকআপ: ${driveStat.lastBackupFile} (${driveStat.lastBackupTime})`);
        }
      }
      // Cloud backup files are loaded strictly on user demand (modal open or manual refresh) to prevent background loops
    } catch (e) {
      console.error(e);
    }
  };

  // Block 1: Backup & Restore Handlers
  const handleChangeBackupDirectory = async () => {
    try {
      const selectedDir = await dbService.system.selectBackupDirectory();
      if (!selectedDir) return;

      await dbService.system.updateSetting('backup_dir', selectedDir);
      setPaths((prev) => ({ ...prev, backupDir: selectedDir }));
      setBackupMessage(`✅ ব্যাকআপ ডিরেক্টরি সফলভাবে পরিবর্তিত হয়েছে: ${selectedDir}`);
    } catch (err: any) {
      setBackupMessage(`❌ ডিরেক্টরি নির্বাচন ত্রুটি: ${err.message}`);
    }
  };

  const handleManualBackup = async () => {
    try {
      setIsBackingUp(true);
      setBackupMessage('');
      const res = await dbService.system.backup();
      if (res.success) {
        setBackupMessage(`✅ ব্যাকআপ সফলভাবে সংরক্ষিত হয়েছে: ${res.filePath}`);
      } else {
        setBackupMessage(`❌ ${res.message}`);
      }
    } catch (err: any) {
      setBackupMessage(`❌ ব্যাকআপ ত্রুটি: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSnapshotRestore = async () => {
    try {
      const selectedFile = await dbService.system.selectBackupFile();
      if (!selectedFile) return;

      if (!confirm(`আপনি কি এই ব্যাকআপ ফাইলটি থেকে ডাটাবেজ রিস্টোর করতে চান?\n\nফাইল: ${selectedFile}\n\nবর্তমান ডাটাবেজের একটি স্বয়ংক্রিয় সেফটি কপি রাখা হবে।`)) {
        return;
      }

      setIsRestoring(true);
      setRestoreMessage('');
      const res = await dbService.system.restoreBackup(selectedFile);
      if (res.success) {
        setRestoreMessage(`✅ ${res.message}`);
        alert('ডাটাবেজ রিস্টোর সফল হয়েছে! সফটওয়্যারটি পুনরায় চালু হচ্ছে...');
        dbService.system.relaunch();
      } else {
        setRestoreMessage(`❌ ${res.message}`);
      }
    } catch (err: any) {
      setRestoreMessage(`❌ রিস্টোর ব্যর্থ: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Block 2: Shop Info Save Handler
  const handleSaveShopInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      alert('দোকান বা প্রতিষ্ঠানের নাম আবশ্যক');
      return;
    }
    setSavingShop(true);
    setSavedSuccess(false);
    try {
      await Promise.all([
        dbService.system.updateSetting('org_name', shopName.trim()),
        dbService.system.updateSetting('sub_title', subTitle.trim()),
        dbService.system.updateSetting('contacts', phone.trim()),
        dbService.system.updateSetting('location', address.trim()),
      ]);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      alert(`তথ্য সংরক্ষণ ব্যর্থ: ${err.message}`);
    } finally {
      setSavingShop(false);
    }
  };

  // Block 3: Commodity Name Edit & Add Handlers
  const handleUpdateCommodityName = async (commId: number) => {
    if (!editCommName.trim()) return;
    try {
      await dbService.commodities.update(commId, { name_bn: editCommName.trim() });
      setEditingCommId(null);
      const updated = await dbService.commodities.getAll();
      setCommodities(updated);
    } catch (err: any) {
      alert(`শস্যের নাম আপডেট ব্যর্থ: ${err.message}`);
    }
  };

  const handleDeleteCommodityFromSettings = async (c: Commodity) => {
    if (!confirm(`আপনি কি "${c.name_bn}" শস্যের জাতটি মুছে ফেলতে চান?`)) {
      return;
    }

    try {
      const res = await dbService.commodities.delete(c.id, false);
      if (!res.success) {
        alert(`⚠️ সতর্কবার্তা: ${res.message || 'এই শস্যের অধীনে সক্রিয় লেনদেন বা গুদামে মজুত স্টক রয়েছে। মুছে ফেলা সম্ভব নয়।'}`);
        return;
      }
      alert(`✅ "${c.name_bn}" সফলভাবে মুছে ফেলা হয়েছে!`);
      const updated = await dbService.commodities.getAll();
      setCommodities(updated);
    } catch (err: any) {
      alert(`মুছতে ব্যর্থ হয়েছে: ${err.message}`);
    }
  };

  const handleCreateCommodity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommNameBn.trim()) {
      alert('শস্যের নাম আবশ্যক');
      return;
    }
    setAddingComm(true);
    try {
      await dbService.commodities.create({
        name_bn: newCommNameBn.trim(),
        name_en: newCommNameEn.trim() || newCommNameBn.trim(),
        default_bag_weight_kg: parseSmartNumber(newCommBagKg) || 80,
        notes: newCommNotes.trim() || undefined,
      });

      setShowAddCommModal(false);
      setNewCommNameBn('');
      setNewCommNameEn('');
      setNewCommBagKg('80');
      setNewCommNotes('');
      const updated = await dbService.commodities.getAll();
      setCommodities(updated);
      alert('নতুন শস্যের জাত সফলভাবে তৈরি হয়েছে!');
    } catch (err: any) {
      alert(`ত্রুটি: ${err.message}`);
    } finally {
      setAddingComm(false);
    }
  };

  // Block 4: PIN Security Handler
  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPinInput) {
      setPinFeedback({ isSuccess: false, text: 'বর্তমান পিন লিখুন' });
      return;
    }
    setPinFeedback(null);
    const enCurrentPin = toEnglishDigits(currentPinInput);
    const enNewPin = toEnglishDigits(newPinInput);
    const enConfirmPin = toEnglishDigits(confirmPinInput);

    if (enNewPin.length !== 4 || !/^\d{4}$/.test(enNewPin)) {
      setPinFeedback({ isSuccess: false, text: 'নতুন পিন অবশ্যই ৪ সংখ্যার হতে হবে!' });
      return;
    }
    if (enNewPin !== enConfirmPin) {
      setPinFeedback({ isSuccess: false, text: 'নতুন পিন কোড দুটি মেলেনি!' });
      return;
    }

    setIsUpdatingPin(true);
    try {
      const res = await changePin(enCurrentPin, enNewPin);
      setPinFeedback({ isSuccess: res.success, text: res.message });
      if (res.success) {
        try {
          localStorage.setItem('maha_pin', enNewPin);
          localStorage.setItem('maha_app_pin', enNewPin);
          localStorage.setItem('pin', enNewPin);
          sessionStorage.setItem('maha_pin', enNewPin);
          sessionStorage.setItem('maha_app_pin', enNewPin);
        } catch (_) {}
        setCurrentPinInput('');
        setNewPinInput('');
        setConfirmPinInput('');
      }
    } catch (err: any) {
      setPinFeedback({ isSuccess: false, text: err.message || 'ত্রুটি ঘটেছে' });
    } finally {
      setIsUpdatingPin(false);
    }
  };

  return (
    <div className="p-2 sm:p-4 space-y-6 max-w-[1550px] mx-auto w-full text-[var(--text-primary)]">
      {/* ========================================================================= */}
      {/* ব্লক ১: স্বয়ংক্রিয় ও ম্যানুয়াল ডাটাবেজ ব্যাকআপ (Auto Backup & Restore)       */}
      {/* ========================================================================= */}
      <div className="bg-[var(--surface)] rounded-2xl border-2 border-amber-500/40 shadow-xl p-5 space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/30">
              <Database className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  স্বয়ংক্রিয় ও ম্যানুয়াল ডাটাবেজ ব্যাকআপ (Auto Backup & Restore)
                </h2>
                <span className="px-2.5 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold rounded-full">
                  সন্ধ্যা ৭:০০ টায় নির্ধারিত (১৯:০০)
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                ডিরেক্টরি: <strong className="text-slate-200 font-mono">{paths.backupDir || 'D:\\Maha Enterprise\\backups'}</strong> • রিটেনশন: <strong className="text-emerald-400 font-mono">সর্বশেষ ৩০ দিনের স্ন্যাপশট সংরক্ষিত</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleChangeBackupDirectory}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 shadow-sm transition-all cursor-pointer"
              title="কম্পিউটার বা পেনড্রাইভের যেকোনো ফোল্ডার নির্বাচন করুন"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>📁 ডিরেক্টরি পরিবর্তন</span>
            </button>
            <button
              onClick={handleManualBackup}
              disabled={isBackingUp}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Download className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />
              <span>{isBackingUp ? 'তৈরি হচ্ছে...' : '📥 ম্যানুয়াল ব্যাকআপ নিন'}</span>
            </button>
            <button
              onClick={handleSnapshotRestore}
              disabled={isRestoring}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl border border-emerald-600 shadow-sm transition-all cursor-pointer"
              title="পিসির যেকোনো ফোল্ডার থেকে ব্যাকআপ ফাইল নির্বাচন করে লোকাল ডাটাবেজে রিস্টোর করুন"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
              <span>🔄 ফাইল থেকে রিস্টোর</span>
            </button>
          </div>
        </div>

        {/* 4 Info Boxes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">অটো-ব্যাকআপ শিডিউল:</span>
            <span className="font-bold text-amber-700 dark:text-amber-300 mt-0.5 block">প্রতিদিন সন্ধ্যা ৭:০০ টায় (১৯:০০)</span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">মিসড ব্যাকআপ ক্যাচ-আপ:</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 block">পিসি বন্ধ থাকলে রিস্টার্টে অটো-ক্যাচআপ</span>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 block">সংরক্ষণ ফোল্ডার (D: ড্রাইভ):</span>
              <button
                type="button"
                onClick={handleChangeBackupDirectory}
                className="text-[11px] text-amber-500 hover:underline font-bold"
              >
                [পরিবর্তন]
              </button>
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5 block truncate" title={paths.backupDir}>
              {paths.backupDir || 'D:\\Maha Enterprise\\backups'}
            </span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">লোকাল পারফরম্যান্স মোড:</span>
            <span className="font-bold text-cyan-700 dark:text-cyan-400 font-mono mt-0.5 block">
              Offline SQLite WAL (জিরো ল্যাটেন্সি)
            </span>
          </div>
        </div>

        {backupMessage && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-300">
            {backupMessage}
          </div>
        )}
        {restoreMessage && (
          <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300">
            {restoreMessage}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* প্রাইভেট প্রিমিয়াম সার্ভার ক্লাউড ব্যাকআপ ও রিস্টোর (Private Premium Server Vault) */}
      {/* ========================================================================= */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-color)] shadow-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-sky-500/10 text-sky-400 rounded-2xl border border-sky-500/30">
              <Cloud className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  প্রাইভেট প্রিমিয়াম সার্ভার ক্লাউড ব্যাকআপ ও রিস্টোর (Private Premium Server Vault)
                </h2>
                <span className="px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  ● প্রাইভেট সার্ভার সক্রিয় (টার্গেট আইডি: {targetId})
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                মালিক / গ্রাহক: <strong className="text-slate-900 dark:text-slate-200">{ownerName}</strong> • <strong className="text-sky-600 dark:text-sky-400 font-mono">টার্গেট আইডি: {targetId}</strong> • প্ল্যাটফর্ম: <strong className="text-emerald-600 dark:text-emerald-400">প্রাইভেট ক্লাউড</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCloudUpload}
              disabled={isCloudBackingUp}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              title="প্রাইভেট ক্লাউডে সরাসরি ব্যাকআপ ফাইল পাঠান"
            >
              <UploadCloud className={`w-3.5 h-3.5 ${isCloudBackingUp ? 'animate-spin' : ''}`} />
              <span>{isCloudBackingUp ? 'আপলোড হচ্ছে...' : 'ক্লাউডে এখনই ব্যাকআপ দিন (Upload to Cloud)'}</span>
            </button>
            <button
              onClick={handleOpenCloudRestore}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ক্লাউড থেকে রিস্টোর (1-Click Restore)</span>
            </button>
            <button
              onClick={handleOpenCloudFiles}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm transition-all cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-sky-500" />
              <span>ক্লাউড ফাইল তালিকা (View Cloud Files)</span>
            </button>
            <button
              onClick={() => setIsPrivateConfigOpen(true)}
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
              title="সার্ভার স্ট্যাটাস ও বিবরণ"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cloud Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">অটো-ব্যাকআপ সময়সূচি:</span>
            <span className="font-bold text-sky-700 dark:text-sky-300 mt-0.5 block">দুপুর ১:০০ ও সন্ধ্যা ৭:০০ (১৩:০০ ও ১৯:০০)</span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">ক্লাউড প্ল্যাটফর্ম:</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 block">প্রাইভেট ক্লাউড</span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">মালিক / গ্রাহক:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
              {ownerName}
            </span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-400 block">আইডি লেবেল:</span>
            <span className="font-bold font-mono text-sky-600 dark:text-sky-400 mt-0.5 block truncate">
              টার্গেট আইডি: {targetId}
            </span>
          </div>
        </div>

        {/* Interactive Backup Wizard Panel */}
        <div className="bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">ব্যাকআপ উইজার্ড:</span>
              <button
                type="button"
                onClick={() => setActiveBackupTab('local')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeBackupTab === 'local'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-500'
                }`}
              >
                [ স্থানীয় ব্যাকআপসমূহ ]
              </button>
              <button
                type="button"
                onClick={() => setActiveBackupTab('cloud')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeBackupTab === 'cloud'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-500'
                }`}
              >
                [ ক্লাউড ব্যাকআপসমূহ ]
              </button>
            </div>
            <button
              onClick={loadCloudBackupsList}
              disabled={isLoadingCloudBackups}
              className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 self-end sm:self-auto cursor-pointer"
            >
              <RotateCw className={`w-3 h-3 ${isLoadingCloudBackups ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ তালিকা</span>
            </button>
          </div>

          {/* Backup Files Table */}
          {isLoadingCloudBackups ? (
            <div className="py-6 text-center text-slate-500 flex items-center justify-center gap-2 text-xs">
              <RotateCw className="w-4 h-4 animate-spin text-sky-500" />
              <span>ফাইল তালিকা লোড হচ্ছে...</span>
            </div>
          ) : cloudBackups.filter((b) => (activeBackupTab === 'cloud' ? b.isCloud : !b.isCloud)).length === 0 ? (
            <div className="py-6 text-center text-slate-500 dark:text-slate-400 text-xs">
              {activeBackupTab === 'cloud'
                ? 'কোনো ক্লাউড ব্যাকআপ পাওয়া যায়নি। "ক্লাউডে এখনই ব্যাকআপ দিন" বাটনে চাপ দিন।'
                : 'কোনো স্থানীয় ব্যাকআপ পাওয়া যায়নি।'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px]">
                    <th className="py-2 px-3 font-semibold">ফাইল নাম</th>
                    <th className="py-2 px-3 font-semibold">প্ল্যাটফর্ম</th>
                    <th className="py-2 px-3 font-semibold">আকার</th>
                    <th className="py-2 px-3 font-semibold">তারিখ ও সময়</th>
                    <th className="py-2 px-3 font-semibold text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {cloudBackups
                    .filter((b) => (activeBackupTab === 'cloud' ? b.isCloud : !b.isCloud))
                    .slice(0, 5)
                    .map((b) => (
                      <tr key={b.id} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2 px-3 font-mono font-medium text-slate-800 dark:text-slate-200 truncate max-w-[260px]" title={b.name}>
                          {b.name}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              b.isCloud
                                ? 'bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400'
                                : 'bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {b.isCloud ? 'প্রাইভেট ক্লাউড' : 'স্থানীয়'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {b.size}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-500 dark:text-slate-400">
                          {b.createdTime ? new Date(b.createdTime).toLocaleString('bn-BD', { hour12: true }) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleExecuteCloudRestore(b.id)}
                            disabled={isRestoring}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] shadow-sm transition-all cursor-pointer"
                          >
                            ১-ক্লিক রিস্টোর
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {cloudBackupMessage && (
          <div className="p-3 bg-sky-500/15 border border-sky-500/40 rounded-xl text-xs font-bold text-sky-800 dark:text-sky-300">
            {cloudBackupMessage}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ডিসপ্লে জুম ও আকার (Display Zoom & Scaling)                                */}
      {/* ========================================================================= */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-color)] shadow-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/30">
              <ZoomIn className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  ডিসপ্লে জুম ও আকার (Display Zoom & Scaling)
                </h2>
                <span className="px-2.5 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-full font-mono">
                  {toBnDigits(Math.round(zoomFactor * 100))}%
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">৭০% - ১৫০%</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                স্ক্রিনের রেজোলিউশন ও চোখের আরামের জন্য সফটওয়্যারের ফন্ট ও ভিউ বড় বা ছোট করুন
              </p>
            </div>
          </div>

          {/* Stepper Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => applyZoom(zoomFactor - 0.05)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer transition-colors"
              title="Ctrl + -"
            >
              <ZoomOut className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>🔍 জুম কমান (-) [Ctrl + -]</span>
            </button>
            <button
              onClick={() => applyZoom(1.0)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer transition-colors"
              title="Ctrl + 0"
            >
              <RotateCw className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>🔄 রিসেট (১০০%) [Ctrl + 0]</span>
            </button>
            <button
              onClick={() => applyZoom(zoomFactor + 0.05)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer transition-colors"
              title="Ctrl + +"
            >
              <ZoomIn className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>🔍 জুম বাড়ান (+) [Ctrl + +]</span>
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-[var(--text-muted)] font-semibold mr-1">কুইক প্রিসেট:</span>
          {[
            { label: '৭৫%', value: 0.75 },
            { label: '৮০%', value: 0.8 },
            { label: '৯০%', value: 0.9 },
            { label: '১০০% (স্বাভাবিক)', value: 1.0 },
            { label: '১১০%', value: 1.1 },
            { label: '১২০%', value: 1.2 },
            { label: '১৩০%', value: 1.3 },
          ].map((preset) => {
            const isSelected = Math.abs(zoomFactor - preset.value) < 0.02;
            return (
              <button
                key={preset.label}
                onClick={() => applyZoom(preset.value)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md ring-2 ring-amber-500/30'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-amber-500/50 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                [ {preset.label} ]
              </button>
            );
          })}
        </div>
      </div>

      {/* 2-Column Administrative Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ========================================================================= */}
        {/* ব্লক ২: প্রতিষ্ঠানের বিবরণ ও যোগাযোগের তথ্য (মালিকের প্রোফাইল)               */}
        {/* ========================================================================= */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-color)] shadow-xl p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white pb-2 border-b border-[var(--border-color)] flex items-center gap-2">
            <Store className="w-5 h-5 text-amber-400" />
            <span>প্রতিষ্ঠানের বিবরণ ও যোগাযোগের তথ্য</span>
          </h2>

          <form onSubmit={handleSaveShopInfo} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">দোকান / প্রতিষ্ঠানের নাম</label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold text-sm outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">স্লোগান / ট্যাগলাইন</label>
              <input
                type="text"
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-200 outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">মোবাইল নম্বর</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(toBengaliDigits(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-200 outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">ঠিকানা / মোকাম</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-200 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={savingShop}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all text-xs disabled:opacity-50 cursor-pointer"
              >
                {savingShop ? 'সংরক্ষণ হচ্ছে...' : 'তথ্য আপডেট করুন'}
              </button>
              {savedSuccess && (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-xs animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" /> ডাটাবেসে স্থায়ীভাবে সংরক্ষিত হয়েছে
                </span>
              )}
            </div>
          </form>
        </div>

        {/* ========================================================================= */}
        {/* ব্লক ৩: শস্যের জাতের নাম পরিবর্তন ও নতুন জাত যুক্তকরণ (মালিকের সম্পাদন)         */}
        {/* ========================================================================= */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-color)] shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Wheat className="w-5 h-5 text-amber-500 dark:text-amber-400" />
              <span>শস্যের জাতের নাম পরিবর্তন (মালিকের সম্পাদন)</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--text-muted)]">অতীত ইতিহাস অপরিবর্তিত থাকবে</span>
              <button
                type="button"
                onClick={() => setShowAddCommModal(true)}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ নতুন জাত</span>
              </button>
            </div>
          </div>

          {/* Commodities List */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {commodities.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
              >
                {editingCommId === c.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={editCommName}
                      onChange={(e) => setEditCommName(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 border border-amber-500 rounded-lg bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none"
                    />
                    <button
                      onClick={() => handleUpdateCommodityName(c.id)}
                      className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 cursor-pointer"
                      title="সংরক্ষণ"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingCommId(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                      title="বাতিল"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs">{c.name_bn}</span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] ml-2">({c.name_en || 'Grain'})</span>
                      <span className="text-cyan-400 text-[10px] ml-2 font-mono">
                        [স্টক: {toBnDigits((c.current_stock_kg / 40).toFixed(1))} মণ / {toBnDigits(c.current_stock_bags)} বস্তা]
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingCommId(c.id);
                          setEditCommName(c.name_bn);
                        }}
                        className="px-2 py-1 text-cyan-400 hover:bg-cyan-500/10 rounded-lg flex items-center gap-1 font-bold text-xs cursor-pointer border border-cyan-500/20"
                        title="শস্যের নাম সম্পাদনা করুন"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>সম্পাদনা</span>
                      </button>
                      <button
                        onClick={() => handleDeleteCommodityFromSettings(c)}
                        className="px-2 py-1 text-rose-500 hover:bg-rose-500/10 rounded-lg flex items-center gap-1 font-bold text-xs cursor-pointer border border-rose-500/20"
                        title="শস্য মুছে ফেলুন (সক্রিয় লেনদেন/স্টক থাকলে সতর্কবার্তা দেবে)"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>মুছুন</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ব্লক ৪: নিরাপত্তা ও ৪-ডিজিটের সিকিউরিটি পিন সেটিংস (Security PIN Settings)     */}
      {/* ========================================================================= */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-color)] shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">নিরাপত্তা ও পিন কোড সেটিংস (Startup PIN Lock)</h3>
              <p className="text-xs text-[var(--text-muted)]">
                অননুমোদিত ব্যবহার রোধে ৪ ডিজিটের সিকিউরিটি পিন ও ৩০ মিনিট নিষ্ক্রিয়তায় অটো-লক
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={lockApp}
            className="py-1.5 px-3 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold rounded-lg text-xs border border-rose-500/40 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>স্ক্রিন লক করুন</span>
          </button>
        </div>

        <form onSubmit={handleUpdatePin} className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                বর্তমান পিন (Current)
              </label>
              <input
                type="password"
                maxLength={4}
                placeholder="যেমন: 5555"
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(toBengaliDigits(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-center font-mono font-bold tracking-widest text-sm text-slate-900 dark:text-white focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                নতুন ৪ ডিজিট পিন
              </label>
              <input
                type="password"
                maxLength={4}
                placeholder="৪ সংখ্যা"
                value={newPinInput}
                onChange={(e) => setNewPinInput(toBengaliDigits(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-center font-mono font-bold tracking-widest text-sm text-slate-900 dark:text-white focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                নতুন পিন নিশ্চিতকরণ
              </label>
              <input
                type="password"
                maxLength={4}
                placeholder="পুনরায় টাইপ"
                value={confirmPinInput}
                onChange={(e) => setConfirmPinInput(toBengaliDigits(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-center font-mono font-bold tracking-widest text-sm text-slate-900 dark:text-white focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {pinFeedback ? (
              <span className={`text-xs font-bold flex items-center gap-1.5 ${pinFeedback.isSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pinFeedback.isSuccess ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>{pinFeedback.text}</span>
              </span>
            ) : <span />}

            <button
              type="submit"
              disabled={isUpdatingPin}
              className="py-2.5 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isUpdatingPin ? 'আপডেট হচ্ছে...' : 'পিন কোড পরিবর্তন করুন'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* ব্লক ৫: অ্যাপের থিম ও ডিজাইন সিলেক্টর (App Themes)                           */}
      {/* ========================================================================= */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-color)] shadow-xl p-5 space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-[var(--border-color)]">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/30">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">অ্যাপের থিম ও ডিজাইন (App Themes)</h2>
            <p className="text-xs text-[var(--text-muted)]">
              আপনার পছন্দ অনুযায়ী কালার স্কিম নির্বাচন করুন (তাত্ক্ষণিক কার্যকর ও স্থায়ী)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {themes.map((t) => {
            const isCurrent = theme === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                  isCurrent
                    ? 'border-amber-500 bg-amber-50/60 dark:bg-[#162231] shadow-lg ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-[var(--border-color)] bg-white dark:bg-[#111827] hover:border-slate-400 dark:hover:border-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-300 font-mono">
                      {t.badge}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> সক্রিয়
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">{t.name}</h3>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">{t.description}</p>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-2 border-t border-[var(--border-color)]">
                  <div className="w-5 h-5 rounded-md" style={{ backgroundColor: t.colors.sidebar }} title="Sidebar" />
                  <div className="w-5 h-5 rounded-md" style={{ backgroundColor: t.colors.primary }} title="Primary" />
                  <div className="w-5 h-5 rounded-md" style={{ backgroundColor: t.colors.success }} title="Success" />
                  <div className="w-5 h-5 rounded-md" style={{ backgroundColor: t.colors.goldAccent || t.colors.cardBg }} title="Accent" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ব্লক ৬: টেস্ট ড্রাফট ডাটা রিসেট ও পার্জ (Test Drafts Management)              */}
      {/* ========================================================================= */}
      <div className="bg-[var(--surface)] rounded-2xl border-2 border-rose-500/40 shadow-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/30">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  টেস্ট ড্রাফট ও পরীক্ষামূলক ডাটা রিসেট (Audit & Drafts Management)
                </h2>
                {hasDrafts && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                    ড্রাফট ডাটা বিদ্যমান
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                অডিটের জন্য ব্যবহৃত সকল পরীক্ষামূলক ড্রাফট লেনদেন মুছে ফেলে স্টক ও খতিয়ান ব্যালেন্স রিসেট করুন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePurgeTestDrafts}
            disabled={isPurgingDrafts}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isPurgingDrafts ? 'মুছে ফেলা হচ্ছে...' : '🗑️ সকল টেস্ট ড্রাফট ডাটা মুছুন'}</span>
          </button>
        </div>

        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
          ℹ️ <strong>অডিট সতর্কতা:</strong> এই বোতামে চাপ দিলে শুধুমাত্র <code>is_test_draft = 1</code> চিহ্নিত পরীক্ষামূলক ক্রয়, বিক্রয়, ক্যাশ ও খতিয়ান লেনদেনগুলো মুছে ফেলে মূল মজুত এবং পার্টির পূর্বের সঠিক ব্যালেন্স স্বয়ংক্রিয়ভাবে পুনঃগণনা করে রিস্টোর করা হবে। নিয়মিত ব্যবসার কোনো হিসাব ক্ষতিগ্রস্ত হবে না।
        </div>
      </div>

      {/* ADD COMMODITY MODAL */}
      {showAddCommModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Wheat className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>+ নতুন শস্যের জাত যোগ করুন</span>
              </h3>
              <button onClick={() => setShowAddCommModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCommodity} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">শস্যের বাংলা নাম *</label>
                <input
                  type="text"
                  placeholder="যেমন: মসুর ডাল (উন্নত জাত)"
                  value={newCommNameBn}
                  onChange={(e) => setNewCommNameBn(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-amber-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">ইংরেজি নাম / ভ্যারাইটি কোড</label>
                <input
                  type="text"
                  placeholder="Lentil (Special)"
                  value={newCommNameEn}
                  onChange={(e) => setNewCommNameEn(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">ডিফল্ট প্রতি বস্তার ওজন (কেজি)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newCommBagKg}
                  onChange={(e) => setNewCommBagKg(toBengaliDigits(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-amber-500 font-mono text-center"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">বিবরণ / নোট</label>
                <input
                  type="text"
                  placeholder="মোকামের স্থানীয় মান..."
                  value={newCommNotes}
                  onChange={(e) => setNewCommNotes(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCommModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={addingComm}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-md disabled:opacity-50"
                >
                  {addingComm ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRIVATE SERVER CONFIG MODAL */}
      {isPrivateConfigOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-sky-500" />
                <span>প্রাইভেট প্রিমিয়াম সার্ভার ক্লাউড ভল্ট কনফিগারেশন</span>
              </h3>
              <button
                onClick={() => setIsPrivateConfigOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <div className="font-bold text-[11px]">
                  ● প্রাইভেট সার্ভার সক্রিয় (টার্গেট আইডি: {targetId})
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  মালিক / গ্রাহক:
                </label>
                <input
                  type="text"
                  readOnly
                  value={ownerName}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  আইডি লেবেল:
                </label>
                <input
                  type="text"
                  readOnly
                  value={`টার্গেট আইডি: ${targetId}`}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sky-600 dark:text-sky-400 font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  ক্লাউড ব্যাকআপ ফোল্ডার:
                </label>
                <input
                  type="text"
                  readOnly
                  value={cloudFolder}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPrivateConfigOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold cursor-pointer"
                >
                  ঠিক আছে
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRIVATE CLOUD RESTORE & FILE LIST MODAL */}
      {(isCloudRestoreModalOpen || isCloudFilesModalOpen) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <DownloadCloud className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>প্রাইভেট ক্লাউড ব্যাকআপ তালিকা ও রিস্টোর</span>
              </h3>
              <button
                onClick={() => {
                  setIsCloudRestoreModalOpen(false);
                  setIsCloudFilesModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Wizard Tabs: [ স্থানীয় ব্যাকআপসমূহ ] & [ ক্লাউড ব্যাকআপসমূহ ] */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveBackupTab('local')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeBackupTab === 'local'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                [ স্থানীয় ব্যাকআপসমূহ ]
              </button>
              <button
                type="button"
                onClick={() => setActiveBackupTab('cloud')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeBackupTab === 'cloud'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                [ ক্লাউড ব্যাকআপসমূহ ]
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-700 dark:text-slate-300">
                {activeBackupTab === 'cloud'
                  ? 'প্রাইভেট প্রিমিয়াম সার্ভার থেকে রিস্টোর করতে ব্যাকআপ নির্বাচন করুন:'
                  : 'স্থানীয় স্টোরেজ থেকে রিস্টোর করতে ব্যাকআপ নির্বাচন করুন:'}
              </p>

              {/* Backups List */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {isLoadingCloudBackups ? (
                  <div className="p-6 text-center text-slate-500 flex items-center justify-center gap-2">
                    <RotateCw className="w-4 h-4 animate-spin text-sky-500" />
                    <span>ব্যাকআপ তালিকা লোড হচ্ছে...</span>
                  </div>
                ) : cloudBackups.filter((b) => (activeBackupTab === 'cloud' ? b.isCloud : !b.isCloud)).length === 0 ? (
                  <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-slate-500">
                    {activeBackupTab === 'cloud'
                      ? 'কোনো ক্লাউড ব্যাকআপ পাওয়া যায়নি। "ক্লাউডে এখনই ব্যাকআপ দিন" বাটনে চাপ দিন।'
                      : 'কোনো স্থানীয় ব্যাকআপ পাওয়া যায়নি।'}
                  </div>
                ) : (
                  cloudBackups
                    .filter((b) => (activeBackupTab === 'cloud' ? b.isCloud : !b.isCloud))
                    .map((b) => {
                      const isSelected = selectedCloudBackupId === b.id;
                      const dateFormatted = b.createdTime ? new Date(b.createdTime).toLocaleString('bn-BD', { hour12: true }) : '';
                      return (
                        <div
                          key={b.id}
                          onClick={() => setSelectedCloudBackupId(b.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500 shadow-sm ring-1 ring-amber-500/30'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-900 dark:text-white truncate" title={b.name}>
                              {b.name}
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold ml-2 shrink-0">
                              {b.size}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1.5">
                            <span>তারিখ: {dateFormatted}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                b.isCloud
                                  ? 'bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 font-mono'
                                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono'
                              }`}
                            >
                              {b.isCloud ? 'প্রাইভেট ক্লাউড' : 'স্থানীয়'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs">
                ⚠️ সতর্কতা: ক্লাউড রিস্টোর কার্যকর করার আগে বর্তমান ডাটাবেজের একটি স্বয়ংক্রিয় ব্যাকআপ লোকাল ড্রাইভে তৈরি করে রাখা হবে।
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCloudRestoreModalOpen(false);
                    setIsCloudFilesModalOpen(false);
                  }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={!selectedCloudBackupId || isRestoring}
                  onClick={() => handleExecuteCloudRestore(selectedCloudBackupId)}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-lg shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                  <span>{isRestoring ? 'রিস্টোর হচ্ছে...' : 'ক্লাউড থেকে রিস্টোর (1-Click Restore)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
