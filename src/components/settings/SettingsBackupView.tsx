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
  Smartphone,
  Send,
  Key,
  Clock,
  MessageSquare,
  Bot,
  Eye,
  EyeOff,
  ExternalLink,
  Cpu,
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

  // =========================================================================
  // SMS Gateway Settings, Test & Logs State
  // =========================================================================
  const [smsEnabled, setSmsEnabled] = useState<boolean>(true);
  const [smsProvider, setSmsProvider] = useState<string>('bulksmsbd');
  const [smsApiKey, setSmsApiKey] = useState<string>('');
  const [smsSenderId, setSmsSenderId] = useState<string>('');
  const [smsCustomUrl, setSmsCustomUrl] = useState<string>('');
  const [smsFormatMode, setSmsFormatMode] = useState<string>('banglish_1sms');
  const [smsSendOnDueCollect, setSmsSendOnDueCollect] = useState<boolean>(true);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isSavingSms, setIsSavingSms] = useState<boolean>(false);
  const [smsSaveMessage, setSmsSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [testPhone, setTestPhone] = useState<string>('');
  const [isSendingTestSms, setIsSendingTestSms] = useState<boolean>(false);
  const [testSmsResult, setTestSmsResult] = useState<{ success: boolean; message: string } | null>(null);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [resendingLogId, setResendingLogId] = useState<number | null>(null);

  const fetchSmsData = async () => {
    try {
      setIsLoadingLogs(true);
      const [settingsRes, logsRes] = await Promise.all([
        dbService.sms.getSettings().catch(() => null),
        dbService.sms.getLogs(30).catch(() => null),
      ]);

      if (settingsRes && settingsRes.success && settingsRes.settings) {
        const s = settingsRes.settings;
        setSmsEnabled(s.sms_enabled === 'true');
        setSmsProvider(s.sms_provider || 'bulksmsbd');
        setSmsSenderId(s.sms_sender_id || '');
        setSmsCustomUrl(s.sms_custom_url || '');
        setSmsFormatMode(s.sms_format_mode || 'banglish_1sms');
        setSmsSendOnDueCollect(s.sms_send_on_due_collect !== 'false');
        setHasApiKey(s.has_api_key);
        if (s.masked_api_key) {
          setSmsApiKey(s.masked_api_key);
        }
      }

      if (logsRes && logsRes.success && logsRes.logs) {
        setSmsLogs(logsRes.logs);
      }
    } catch (err) {
      console.warn('[Fetch SMS Data Error]:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Block 8: Ai Manezar State
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [maskedGeminiKey, setMaskedGeminiKey] = useState('');
  const [showGeminiApiKey, setShowGeminiApiKey] = useState(false);
  const [isSavingAiKey, setIsSavingAiKey] = useState(false);
  const [aiKeySaveMessage, setAiKeySaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isTestingAiConnection, setIsTestingAiConnection] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string; model?: string; reply?: string } | null>(null);
  const [isTestingTgAudit, setIsTestingTgAudit] = useState(false);
  const [tgAuditResult, setTgAuditResult] = useState<{ success: boolean; message: string; report?: string } | null>(null);
  const [aiMemories, setAiMemories] = useState<any[]>([]);
  const [aiOverrides, setAiOverrides] = useState<any[]>([]);
  const [isLoadingAiData, setIsLoadingAiData] = useState(false);

  const fetchAiData = async () => {
    try {
      setIsLoadingAiData(true);
      const [keyRes, memRes, ovRes] = await Promise.all([
        dbService.ai.getApiKeyStatus(),
        dbService.ai.getMemories(),
        dbService.ai.getOverrides(),
      ]);

      if (keyRes.success) {
        setHasGeminiKey(keyRes.hasKey);
        setMaskedGeminiKey(keyRes.maskedKey || '');
      }
      if (memRes.success) {
        setAiMemories(memRes.memories || []);
      }
      if (ovRes.success) {
        setAiOverrides(ovRes.overrides || []);
      }
    } catch (err) {
      console.warn('[Fetch AI Data Error]:', err);
    } finally {
      setIsLoadingAiData(false);
    }
  };

  const handleSaveAiKey = async () => {
    if (!geminiApiKey.trim()) {
      alert('অনুগ্রহ করে একটি বৈধ Google Gemini API Key প্রদান করুন।');
      return;
    }
    try {
      setIsSavingAiKey(true);
      setAiKeySaveMessage(null);
      const res = await dbService.ai.saveApiKey(geminiApiKey.trim());
      if (res.success) {
        setAiKeySaveMessage({ text: 'Gemini API Key সফলভাবে সংরক্ষিত হয়েছে! ✅', type: 'success' });
        setGeminiApiKey('');
        await fetchAiData();
        setTimeout(() => setAiKeySaveMessage(null), 5000);
      } else {
        setAiKeySaveMessage({ text: 'সংরক্ষণ ব্যর্থ হয়েছে', type: 'error' });
      }
    } catch (err: any) {
      setAiKeySaveMessage({ text: `ব্যর্থ: ${err.message || 'অজানা ত্রুটি'}`, type: 'error' });
    } finally {
      setIsSavingAiKey(false);
    }
  };

  const handleTestAiConnection = async () => {
    try {
      setIsTestingAiConnection(true);
      setAiTestResult(null);
      const res = await dbService.ai.testConnection();
      if (res.success) {
        setAiTestResult({
          success: true,
          message: res.message || 'সংযোগ সফল হয়েছে!',
          model: res.model || 'gemini-3-flash-preview',
          reply: res.reply,
        });
      } else {
        setAiTestResult({
          success: false,
          message: res.error || 'Gemini API এর সাথে সংযোগ স্থাপন করা যায়নি।',
        });
      }
    } catch (err: any) {
      setAiTestResult({
        success: false,
        message: err.message || 'সংযোগ ব্যর্থ হয়েছে।',
      });
    } finally {
      setIsTestingAiConnection(false);
    }
  };

  const handleTestTelegramAudit = async () => {
    try {
      setIsTestingTgAudit(true);
      setTgAuditResult(null);
      const res = await dbService.ai.testTelegramAudit();
      if (res.success) {
        setTgAuditResult({
          success: true,
          message: res.message || 'টেলিগ্রাম অডিট রিপোর্ট সফলভাবে পাঠানো হয়েছে!',
          report: res.report,
        });
      } else {
        setTgAuditResult({
          success: false,
          message: res.error || 'টেলিগ্রামে বার্তা পাঠানো ব্যর্থ হয়েছে।',
        });
      }
    } catch (err: any) {
      setTgAuditResult({
        success: false,
        message: err.message || 'টেলিগ্রাম রিপোর্ট ব্যর্থ।',
      });
    } finally {
      setIsTestingTgAudit(false);
    }
  };

  const handleDeleteAiMemory = async (id: string) => {
    if (!window.confirm('এই তথ্যটি মেমরি থেকে মুছে ফেলতে চান?')) return;
    try {
      await dbService.ai.deleteMemory(id);
      setAiMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('[Delete Memory Error]:', err);
    }
  };

  const handleDeleteAiOverride = async (id: string) => {
    if (!window.confirm('এই ডাইনামিক স্টাইল ওভাররাইডটি মুছে ফেলতে চান?')) return;
    try {
      await dbService.ai.deleteOverride(id);
      setAiOverrides((prev) => prev.filter((o) => o.id !== id));
      window.dispatchEvent(new CustomEvent('maha-ai-override-updated'));
    } catch (err) {
      console.error('[Delete Override Error]:', err);
    }
  };

  useEffect(() => {
    fetchSmsData();
    fetchAiData();
  }, []);

  const handleSaveSmsSettings = async () => {
    try {
      setIsSavingSms(true);
      setSmsSaveMessage(null);
      const res = await dbService.sms.saveSettings({
        sms_enabled: smsEnabled ? 'true' : 'false',
        sms_provider: smsProvider,
        sms_api_key: smsApiKey,
        sms_sender_id: smsSenderId.trim(),
        sms_custom_url: smsCustomUrl.trim(),
        sms_format_mode: smsFormatMode,
        sms_send_on_due_collect: smsSendOnDueCollect ? 'true' : 'false',
      });
      if (res && res.success) {
        setSmsSaveMessage({ text: 'SMS গেটওয়ে সেটিংস সফলভাবে সংরক্ষিত হয়েছে! ✅', type: 'success' });
        await fetchSmsData();
        setTimeout(() => setSmsSaveMessage(null), 5000);
      } else {
        setSmsSaveMessage({ text: 'সংরক্ষণ ব্যর্থ হয়েছে', type: 'error' });
      }
    } catch (err: any) {
      setSmsSaveMessage({ text: `ত্রুটি: ${err.message}`, type: 'error' });
    } finally {
      setIsSavingSms(false);
    }
  };

  const handleSendTestSms = async () => {
    if (!testPhone.trim()) {
      setTestSmsResult({ success: false, message: 'অনুগ্রহ করে টেস্ট মোবাইল নম্বর লিখুন (যেমন: 017XXXXXXXX)' });
      return;
    }
    try {
      setIsSendingTestSms(true);
      setTestSmsResult(null);
      const res = await dbService.sms.sendTest(testPhone.trim());
      if (res.success) {
        setTestSmsResult({
          success: true,
          message: `টেস্ট SMS সফলভাবে পাঠানো হয়েছে! (${res.phone}) • গেটওয়ে রেসপন্স: ${res.gatewayResponse || 'OK'}`,
        });
        await fetchSmsData();
      } else {
        setTestSmsResult({
          success: false,
          message: `SMS পাঠাতে ব্যর্থ: ${res.error || res.gatewayResponse || 'অজানা ত্রুটি'}`,
        });
      }
    } catch (err: any) {
      setTestSmsResult({ success: false, message: `ত্রুটি: ${err.message}` });
    } finally {
      setIsSendingTestSms(false);
    }
  };

  const handleResendSms = async (logId: number) => {
    try {
      setResendingLogId(logId);
      const res = await dbService.sms.resend(logId);
      if (res.success) {
        alert('SMS সফলভাবে পুনরায় পাঠানো হয়েছে!');
        await fetchSmsData();
      } else {
        alert(`পুনরায় পাঠাতে ব্যর্থ: ${res.error || res.gatewayResponse || 'অজানা সমস্যা'}`);
      }
    } catch (err: any) {
      alert(`ত্রুটি: ${err.message}`);
    } finally {
      setResendingLogId(null);
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
              title="সম্পূর্ণ ডাটাবেজ সহ রয়্যাল এক্সেল (.xlsx) ব্যাকআপ ডাউনলোড করুন"
            >
              <Download className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />
              <span>{isBackingUp ? 'তৈরি হচ্ছে...' : '↓ 💾 ম্যানুয়াল ব্যাকআপ নিন'}</span>
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

      {/* ========================================================================= */}
      {/* ব্লক ৭: অটোমেটিক ক্রেতা SMS গেটওয়ে (Bangladeshi Bulk SMS API)                  */}
      {/* ========================================================================= */}
      <div className="bg-[var(--surface)] rounded-2xl border-2 border-amber-500/40 shadow-xl p-5 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl border border-amber-500/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  📲 অটোমেটিক ক্রেতা SMS গেটওয়ে (Bangladeshi Bulk SMS API)
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    smsEnabled
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-500/20 text-slate-500 border border-slate-500/30'
                  }`}
                >
                  {smsEnabled ? 'সক্রিয় (Active)' : 'বন্ধ (Disabled)'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                পাইকারি বিক্রয় ও বকেয়া আদায়ের পর ক্রেতার মোবাইলে স্বয়ংক্রিয় ১-SMS চালান ও রসিদ নোটিফিকেশন
              </p>
            </div>
          </div>
        </div>

        {/* Master Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-[var(--border-color)]">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={smsEnabled}
              onChange={(e) => setSmsEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
            />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                বিক্রয়ের পর অটো SMS চালু রাখুন
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                চালান সম্পন্ন হলে বৈধ মোবাইল নম্বরে সাথে সাথে SMS নোটিফিকেশন পাঠানো হবে
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={smsSendOnDueCollect}
              onChange={(e) => setSmsSendOnDueCollect(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
            />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                বকেয়া আদায়ের পর রসিদ SMS পাঠান
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                বাকি খাতা থেকে টাকা জমা নিলে জমা ও অবশিষ্ট বকেয়া ব্যালেন্সের রসিদ SMS যাবে
              </div>
            </div>
          </label>
        </div>

        {/* Gateway Configuration Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Provider Select */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
              SMS গেটওয়ে প্রোভাইডার:
            </label>
            <select
              value={smsProvider}
              onChange={(e) => setSmsProvider(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-amber-500 font-semibold cursor-pointer"
            >
              <option value="bulksmsbd">BulkSMSBD (bulksmsbd.net)</option>
              <option value="alphasms">Alpha SMS (sms.net.bd)</option>
              <option value="greenweb">GreenWeb BD (api.greenweb.com.bd)</option>
              <option value="mimsms">MimSMS (mimsms.com)</option>
              <option value="custom">কাস্টম গেটওয়ে API URL</option>
            </select>
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-700 dark:text-slate-300 font-bold">
                API Key / Secret Token:
              </label>
              {hasApiKey && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  ✓ সেভকৃত চাবি আছে
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                placeholder={hasApiKey ? 'সংরক্ষিত কী বিদ্যমান (পরিবর্তনে নতুন দিন)' : 'আপনার SMS API Key পেস্ট করুন'}
                value={smsApiKey}
                onChange={(e) => setSmsApiKey(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 pr-9 text-slate-900 dark:text-white outline-none focus:border-amber-500 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title={showApiKey ? 'হাইড করুন' : 'দেখান'}
              >
                <Key className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sender ID */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
              Sender ID / মাস্কিং নাম:
            </label>
            <input
              type="text"
              placeholder="যেমন: 88096176... বা MAHA ENT"
              value={smsSenderId}
              onChange={(e) => setSmsSenderId(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-amber-500 font-mono text-xs"
            />
            <div className="text-[10px] text-[var(--text-muted)] mt-1">
              প্রোভাইডার কর্তৃক অনুমোদিত নন-মাস্কিং বা আলফানিউমেরিক আইডি
            </div>
          </div>
        </div>

        {/* Custom URL Template input (if provider === 'custom') */}
        {smsProvider === 'custom' && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-xs">
            <label className="block font-bold text-amber-700 dark:text-amber-300">
              কাস্টম SMS API URL টেমপ্লেট:
            </label>
            <input
              type="text"
              placeholder="https://example-sms.com/api/send?key={api_key}&sender={sender_id}&to={to}&msg={message}"
              value={smsCustomUrl}
              onChange={(e) => setSmsCustomUrl(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-amber-500 font-mono text-xs"
            />
            <div className="text-[11px] text-[var(--text-muted)]">
              প্লেসহোল্ডারসমূহ: <code>&#123;api_key&#125;</code>, <code>&#123;sender_id&#125;</code>, <code>&#123;to&#125;</code>, <code>&#123;message&#125;</code> স্বয়ংক্রিয়ভাবে রিপ্লেস হবে।
            </div>
          </div>
        )}

        {/* SMS Format Mode Selector */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-[var(--border-color)] space-y-2 text-xs">
          <label className="block text-slate-700 dark:text-slate-300 font-bold">
            মেসেজ ফরম্যাট মোড (খরচ ও ভাষা নিয়ন্ত্রণ):
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                smsFormatMode === 'banglish_1sms'
                  ? 'bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-200'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <input
                type="radio"
                name="smsFormatMode"
                value="banglish_1sms"
                checked={smsFormatMode === 'banglish_1sms'}
                onChange={() => setSmsFormatMode('banglish_1sms')}
                className="mt-0.5 text-amber-500 cursor-pointer"
              />
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <span>১ SMS সাশ্রয়ী Banglish (১৬০ অক্ষর — ডিফল্ট)</span>
                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded text-[9px] font-bold">সর্বনিম্ন খরচ</span>
                </div>
                <div className="text-[10.5px] opacity-80 mt-1 font-mono">
                  Maha Enterprise: Inv #123 | Sorisha 50m (25b) | Bill: 140000 Tk | Paid: 100000 Tk | Total Due: 40000 Tk. Dhonnobad!
                </div>
              </div>
            </label>

            <label
              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                smsFormatMode === 'bengali_unicode'
                  ? 'bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-200'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <input
                type="radio"
                name="smsFormatMode"
                value="bengali_unicode"
                checked={smsFormatMode === 'bengali_unicode'}
                onChange={() => setSmsFormatMode('bengali_unicode')}
                className="mt-0.5 text-amber-500 cursor-pointer"
              />
              <div>
                <div className="font-bold">বাংলা ইউনিকোড (৭০ অক্ষর/SMS)</div>
                <div className="text-[10.5px] opacity-80 mt-1">
                  মাহা এন্টারপ্রাইজ: চালান #123, সরিষা (৫০.০ মণ), মোট বিল ৳১৪০,০০০, জমা ৳১০০,০০০, বর্তমান মোট বকেয়া ৳৪০,০০০। ধন্যবাদ।
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Save SMS Settings Button */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleSaveSmsSettings}
            disabled={isSavingSms}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingSms ? 'সংরক্ষণ হচ্ছে...' : '💾 SMS সেটিংস সংরক্ষণ করুন'}</span>
          </button>

          {smsSaveMessage && (
            <div
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                smsSaveMessage.type === 'success'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              }`}
            >
              {smsSaveMessage.text}
            </div>
          )}
        </div>

        {/* Test SMS Box (হাতে-কলমে গেটওয়ে পরীক্ষা) */}
        <div className="p-4 bg-sky-500/10 border border-sky-500/30 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300 font-bold text-xs">
            <Send className="w-4 h-4" />
            <span>📤 টেস্ট SMS ভেরিফিকেশন (গেটওয়ে পরীক্ষা):</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              placeholder="পরীক্ষামূলক মোবাইল নম্বর (যেমন: 01712345678)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-sky-500 font-mono text-xs"
            />
            <button
              type="button"
              onClick={handleSendTestSms}
              disabled={isSendingTestSms}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingTestSms ? 'পাঠানো হচ্ছে...' : '📤 টেস্ট SMS পাঠান'}</span>
            </button>
          </div>

          {testSmsResult && (
            <div
              className={`p-2.5 rounded-lg text-xs font-mono break-all ${
                testSmsResult.success
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300'
              }`}
            >
              {testSmsResult.message}
            </div>
          )}
        </div>

        {/* SMS ডেলিভারি ইতিহাস (Recent Delivery Logs) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between pb-1 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>সাম্প্রতিক SMS ডেলিভারি ইতিহাস (সর্বশেষ ৩০টি)</span>
            </div>
            <button
              type="button"
              onClick={fetchSmsData}
              disabled={isLoadingLogs}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-b border-[var(--border-color)] font-bold">
                <tr>
                  <th className="p-2.5">সময়</th>
                  <th className="p-2.5">চালান / পার্টি</th>
                  <th className="p-2.5">মোবাইল নম্বর</th>
                  <th className="p-2.5 text-center">স্ট্যাটাস</th>
                  <th className="p-2.5">মেসেজ</th>
                  <th className="p-2.5 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] bg-white dark:bg-slate-950/40">
                {smsLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400 font-semibold">
                      কোনো SMS লগ রেকর্ড পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  smsLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="p-2.5 font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                        {log.created_at || '—'}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        <div>{log.party_name || '—'}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono">{log.invoice_no}</div>
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {log.phone}
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                            log.status === 'SENT'
                              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                              : log.status === 'FAILED'
                              ? 'bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400'
                              : 'bg-slate-500/15 border border-slate-500/30 text-slate-500'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 max-w-[280px] truncate" title={log.message}>
                        {log.message}
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleResendSms(log.id)}
                          disabled={resendingLogId === log.id}
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          {resendingLogId === log.id ? 'পাঠানো হচ্ছে...' : 'পুনরায় পাঠান'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BLOCK 8: AI MANEZAR — GOOGLE GEMINI 3 FLASH কনফিগারেশন                  */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-purple-500/30 rounded-2xl p-5 shadow-sm space-y-5 relative overflow-hidden">
        {/* Subtle top ambient glowing border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-rose-500" />

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  🤖 Ai Manezar — Google Gemini 3 Flash কনফিগারেশন
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300">
                  v1.5.0 PRO AI
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                লাইভ শপ ইন্টেলিজেন্স, OCR মেমো স্ক্যানিং, পূর্ণ D1 CRUD এক্সিকিউশন ও ৬০-দিনের রিসাইকেল বিন স্ন্যাপশট
              </p>
            </div>
          </div>

          {/* Quick Open Ai Manezar Button */}
          <button
            id="btn-open-ai-from-settings"
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-ai-manezar'))}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer self-start sm:self-center"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>✨ Ai Manezar খুলুন</span>
          </button>
        </div>

        {/* Model & Architecture Info Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-purple-500/10 border border-purple-500/25 rounded-xl">
            <span className="text-[11px] text-purple-800 dark:text-purple-300 font-bold block">
              প্রধান এআই মডেল:
            </span>
            <div className="font-mono font-bold text-xs text-purple-900 dark:text-purple-200 mt-1 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-purple-500" />
              <span>gemini-3-flash-preview</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              (Google DeepMind-এর আল্ট্রা-ফাস্ট নেক্সট-জেন মডেল)
            </span>
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/25 rounded-xl">
            <span className="text-[11px] text-blue-800 dark:text-blue-300 font-bold block">
              অটো-ফলব্যাক ক্যাসকেড:
            </span>
            <div className="font-mono font-bold text-xs text-blue-900 dark:text-blue-200 mt-1">
              3-flash ➔ 2.5-flash ➔ 2.0-flash
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              (জিরো ডাউনটাইম নিশ্চিতকরণ অ্যালগরিদম)
            </span>
          </div>

          <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
            <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold block">
              ডাটাবেজ ও ডিজাইন সুরক্ষা:
            </span>
            <div className="font-bold text-xs text-emerald-900 dark:text-emerald-200 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>৬০ দিনের স্ন্যাপশট ও ১-ক্লিক রিস্টোর</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              (যেকোনো মিউটেশন বা থিম পরিবর্তনের আগে অটো-ব্যাকআপ)
            </span>
          </div>
        </div>

        {/* Gemini API Key Configuration Section */}
        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-500" />
              <label className="text-xs font-bold text-slate-900 dark:text-white">
                Google Gemini API Key:
              </label>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  hasGeminiKey
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                }`}
              >
                {hasGeminiKey ? '● API Key সক্রিয়' : '○ কোনো Key সেট করা নেই'}
              </span>
            </div>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>ফ্রি Gemini API Key নিন (Google AI Studio)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {hasGeminiKey && maskedGeminiKey && (
            <div className="text-[11px] text-slate-500 font-mono">
              বর্তমান সংরক্ষিত কি: <span className="text-slate-700 dark:text-slate-300 font-bold">{maskedGeminiKey}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <input
                type={showGeminiApiKey ? 'text' : 'password'}
                placeholder="AIzaSy... (নতুন API Key দিন বা পরিবর্তন করুন)"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-slate-900 dark:text-white outline-none focus:border-purple-500 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowGeminiApiKey(!showGeminiApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title={showGeminiApiKey ? 'লুকান' : 'দেখুন'}
              >
                {showGeminiApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveAiKey}
              disabled={isSavingAiKey || !geminiApiKey.trim()}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingAiKey ? 'সংরক্ষণ হচ্ছে...' : '💾 API কি সংরক্ষণ করুন'}</span>
            </button>
          </div>

          {aiKeySaveMessage && (
            <div
              className={`p-2.5 rounded-lg text-xs font-bold ${
                aiKeySaveMessage.type === 'success'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400'
              }`}
            >
              {aiKeySaveMessage.text}
            </div>
          )}
        </div>

        {/* Live Diagnostics: Test Connection & Telegram Audit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Test 1: API Connection Test */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>Gemini API সংযোগ পরীক্ষা:</span>
              </span>
              <button
                type="button"
                onClick={handleTestAiConnection}
                disabled={isTestingAiConnection}
                className="px-3.5 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-700 dark:text-purple-300 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isTestingAiConnection ? 'animate-spin' : ''}`} />
                <span>{isTestingAiConnection ? 'পরীক্ষা চলছে...' : '🔌 সংযোগ পরীক্ষা করুন'}</span>
              </button>
            </div>

            {aiTestResult && (
              <div
                className={`p-3 rounded-lg text-xs space-y-1 ${
                  aiTestResult.success
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  {aiTestResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span>{aiTestResult.message}</span>
                </div>
                {aiTestResult.model && (
                  <div className="text-[11px] font-mono opacity-90">
                    ব্যবহৃত মডেল: <strong>{aiTestResult.model}</strong>
                  </div>
                )}
                {aiTestResult.reply && (
                  <div className="text-[11px] italic mt-1 pt-1 border-t border-emerald-500/20">
                    "{aiTestResult.reply}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test 2: Telegram Audit Report Sender */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Send className="w-4 h-4 text-sky-500" />
                <span>টেলিগ্রাম অডিট রিপোর্ট টেস্ট:</span>
              </span>
              <button
                type="button"
                onClick={handleTestTelegramAudit}
                disabled={isTestingTgAudit}
                className="px-3.5 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-700 dark:text-sky-300 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Send className={`w-3.5 h-3.5 ${isTestingTgAudit ? 'animate-pulse' : ''}`} />
                <span>{isTestingTgAudit ? 'পাঠানো হচ্ছে...' : '📱 অডিট রিপোর্ট পাঠান'}</span>
              </button>
            </div>

            {tgAuditResult && (
              <div
                className={`p-3 rounded-lg text-xs space-y-1 ${
                  tgAuditResult.success
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  {tgAuditResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span>{tgAuditResult.message}</span>
                </div>
                {tgAuditResult.report && (
                  <div className="text-[10px] font-mono max-h-24 overflow-y-auto mt-1 pt-1 border-t border-emerald-500/20 whitespace-pre-wrap">
                    {tgAuditResult.report}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* AI Memories & Dynamic Overrides Management (Collapsible or Grids) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          {/* 1. AI Memory Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>🧠 Ai Manezar দীর্ঘমেয়াদী স্মৃতি (Memory)</span>
                <span className="text-[10px] font-mono text-slate-500">({aiMemories.length})</span>
              </span>
              <span className="text-[10px] text-slate-500">স্বয়ংক্রিয়ভাবে সংরক্ষিত তথ্য</span>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {aiMemories.length === 0 ? (
                <div className="text-xs text-slate-500 italic text-center py-4">
                  কোনো মেমরি তথ্য সংরক্ষিত নেই
                </div>
              ) : (
                aiMemories.map((mem) => (
                  <div
                    key={mem.id}
                    className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs gap-2"
                  >
                    <span className="text-slate-800 dark:text-slate-200 font-medium truncate flex-1">
                      {mem.fact}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteAiMemory(mem.id)}
                      className="text-rose-500 hover:text-rose-700 p-1 shrink-0"
                      title="মেমরি মুছুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Dynamic UI & CSS Overrides */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>🎨 ডাইনামিক ডিজাইন ওভাররাইড (Dynamic CSS)</span>
                <span className="text-[10px] font-mono text-slate-500">({aiOverrides.length})</span>
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                🛡️ ৬০-দিন স্ন্যাপশট সক্রিয়
              </span>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {aiOverrides.length === 0 ? (
                <div className="text-xs text-slate-500 italic text-center py-4">
                  কোনো সক্রিয় ডাইনামিক স্টাইল নেই (ডিফল্ট থিম চলছে)
                </div>
              ) : (
                aiOverrides.map((ov) => (
                  <div
                    key={ov.id}
                    className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs gap-2"
                  >
                    <div className="flex-1 truncate">
                      <div className="font-mono font-bold text-[11px] text-purple-600 dark:text-purple-400">
                        {ov.targetKey} ({ov.overrideType})
                      </div>
                      <div className="text-[10px] text-slate-500 truncate font-mono">
                        {ov.content}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAiOverride(ov.id)}
                      className="text-rose-500 hover:text-rose-700 p-1 shrink-0"
                      title="ওভাররাইড মুছুন ও ডিফল্ট থিমে ফিরুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
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
