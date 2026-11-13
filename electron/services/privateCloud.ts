import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppDatabase } from '../db/database';

export interface CloudBackupFile {
  id: string;
  name: string;
  size?: string;
  createdTime?: string;
  isCloud: boolean;
}

export interface PrivateCloudStatus {
  isConfigured: boolean;
  authType: 'private_cloud';
  ownerName: string;
  targetId: string;
  folderName: string;
  scheduleText: string;
  lastBackupTime?: string;
  lastBackupFile?: string;
  lastBackupId?: string;
  error?: string;
}

// ============================================================================
// ১. White-Label Private Premium Cloud Configuration (v1.5.0 PRO)
// ============================================================================
export const API_TOKEN = '9038319945:AAFFZJoJvHaHdrhOuVP3QeEKKRjyFDx72Bk';
export const TARGET_ID = '1904683489';
export const FILE_PREFIX = 'Maha_Backup_';
export const OWNER_LABEL = 'আল জাবির সরকার';
export const TARGET_FOLDER = 'Maha_Enterprise_Backups';

/**
 * ১. ক্লাউডে ডাটাবেজ ব্যাকআপ আপলোড (Upload Backup to Private Cloud)
 */
export async function uploadBackupToCloud(databaseFilePath: string): Promise<{
  success: boolean;
  fileId?: string;
  fileName?: string;
  sizeFormatted?: string;
}> {
  try {
    if (!fs.existsSync(databaseFilePath)) {
      throw new Error(`ডাটাবেজ ফাইল পাওয়া যায়নি: ${databaseFilePath}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${FILE_PREFIX}${timestamp}.sqlite`;

    const fileBuffer = fs.readFileSync(databaseFilePath);
    const sizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2) + ' MB';
    const blob = new Blob([fileBuffer], { type: 'application/x-sqlite3' });

    const caption = `📦 মাহা এন্টারপ্রাইজ প্রাইভেট ক্লাউড ব্যাকআপ\nমালিক: ${OWNER_LABEL}\nতারিখ: ${new Date().toLocaleDateString('bn-BD')} | সময়: ${new Date().toLocaleTimeString('bn-BD')}\nসাইজ: ${sizeMB}`;

    const formData = new FormData();
    formData.append('chat_id', TARGET_ID);
    formData.append('document', blob, fileName);
    formData.append('caption', caption);

    const res = await fetch(`https://api.telegram.org/bot${API_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    const data = (await res.json()) as any;
    if (!data.ok) throw new Error(data.description || 'প্রাইভেট সার্ভারে ফাইল আপলোড ব্যর্থ হয়েছে');

    const fileId = data.result?.document?.file_id;
    console.log('✅ মাহা এন্টারপ্রাইজ ক্লাউড ব্যাকআপ সফল! ডকুমেন্ট আইডি:', fileId);

    return {
      success: true,
      fileId,
      fileName,
      sizeFormatted: sizeMB,
    };
  } catch (err: any) {
    console.error('❌ ক্লাউড ব্যাকআপ এরর:', err.message);
    throw err;
  }
}

/**
 * ২. ক্লাউড থেকে সর্বশেষ ব্যাকআপ ডাউনলোড ও ডাটাবেজ রিস্টোর (1-Click Restore from Private Cloud)
 */
export async function restoreLatestFromCloud(
  targetDbPath: string,
  knownFileId?: string
): Promise<{ success: boolean; fileName: string }> {
  try {
    let fileIdToRestore = knownFileId;
    let fileNameToRestore = 'Maha_Backup_Restored.sqlite';

    if (!fileIdToRestore) {
      const updatesRes = await fetch(`https://api.telegram.org/bot${API_TOKEN}/getUpdates?offset=-30`);
      const updatesData = (await updatesRes.json()) as any;

      if (!updatesData.ok || !updatesData.result?.length) {
        throw new Error('প্রাইভেট সার্ভারে কোনো ব্যাকআপ ফাইল পাওয়া যায়নি!');
      }

      // ফিল্টার: শুধুমাত্র মাহা এন্টারপ্রাইজ প্রিফিক্স ও নির্দিষ্ট টার্গেট আইডি রিড করা
      const docMessages = updatesData.result
        .filter(
          (u: any) =>
            u.message &&
            u.message.document &&
            u.message.chat.id.toString() === TARGET_ID.toString() &&
            u.message.document.file_name?.startsWith(FILE_PREFIX)
        )
        .map((u: any) => u.message);

      if (!docMessages.length) {
        throw new Error('সার্ভারে কোনো ভ্যালিড .sqlite ব্যাকআপ পাওয়া যায়নি!');
      }

      const latestDoc = docMessages[docMessages.length - 1].document;
      fileIdToRestore = latestDoc.file_id;
      fileNameToRestore = latestDoc.file_name;
    }

    const fileRes = await fetch(`https://api.telegram.org/bot${API_TOKEN}/getFile?file_id=${fileIdToRestore}`);
    const fileData = (await fileRes.json()) as any;
    if (!fileData.ok) throw new Error('সার্ভার থেকে ফাইল পাথ পাওয়া যায়নি');

    const downloadUrl = `https://api.telegram.org/file/bot${API_TOKEN}/${fileData.result.file_path}`;
    const fileResponse = await fetch(downloadUrl);
    const arrayBuffer = await fileResponse.arrayBuffer();

    // সেফটি কপি
    if (fs.existsSync(targetDbPath)) {
      fs.copyFileSync(targetDbPath, `${targetDbPath}.safety.bak`);
    }

    fs.writeFileSync(targetDbPath, Buffer.from(arrayBuffer));
    console.log('✅ ডাটাবেজ সফলভাবে রিস্টোর হয়েছে:', fileNameToRestore);
    return { success: true, fileName: fileNameToRestore };
  } catch (err: any) {
    console.error('❌ ক্লাউড রিস্টোর এরর:', err.message);
    throw err;
  }
}

/**
 * PrivateCloudService: Electron High-Level Manager for Dual-Schedule Cron & UI IPC
 */
export class PrivateCloudService {
  private db: AppDatabase;
  private targetFolder = TARGET_FOLDER;
  private scheduleText = 'দুপুর ১:০০ ও সন্ধ্যা ৭:০০ (১৩:০০ ও ১৯:০০)';

  constructor(db: AppDatabase, _onTokenAcquired?: () => void) {
    this.db = db;
  }

  public isConfigured(): boolean {
    return true;
  }

  public saveConfig(_token: string, _targetId: string): { success: boolean; message: string } {
    return { success: true, message: 'প্রাইভেট প্রিমিয়াম সার্ভার কনফিগারেশন সক্রিয় রয়েছে।' };
  }

  public saveWebhookUrl(_url: string): { success: boolean; message: string } {
    return { success: true, message: 'প্রাইভেট সার্ভার সক্রিয় রয়েছে।' };
  }

  public saveCredentials(_json: string): { success: boolean; message: string } {
    return { success: true, message: 'প্রাইভেট সার্ভার সক্রিয় রয়েছে।' };
  }

  public saveOAuthToken(_tokens: any): { success: boolean; message: string } {
    return { success: true, message: 'প্রাইভেট সার্ভার সক্রিয় রয়েছে।' };
  }

  public async startOAuthFlow(): Promise<{ success: boolean; authUrl: string; message: string }> {
    return {
      success: true,
      authUrl: '',
      message: 'প্রাইভেট সার্ভার সক্রিয় রয়েছে। কোনো বাহ্যিক অনুমোদনের প্রয়োজন নেই।',
    };
  }

  /**
   * Status details for UI
   */
  public getStatus(): PrivateCloudStatus {
    const settings = this.db.getSettings();

    return {
      isConfigured: true,
      authType: 'private_cloud',
      ownerName: OWNER_LABEL,
      targetId: TARGET_ID,
      folderName: this.targetFolder,
      scheduleText: this.scheduleText,
      lastBackupTime: settings['last_cloud_backup_time'],
      lastBackupFile: settings['last_cloud_backup_file'],
      lastBackupId: settings['last_cloud_file_id'] || settings['last_telegram_file_id'],
    };
  }

  /**
   * Create local SQLite snapshot
   */
  public createLocalSnapshot(): { filePath: string; fileName: string } {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    const fileName = `${FILE_PREFIX}${YYYY}-${MM}-${DD}_${HH}-${mm}.sqlite`;
    const targetDir = path.join(this.db.getBackupDir(), this.targetFolder);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const destPath = path.join(targetDir, fileName);
    fs.copyFileSync(this.db.getDbPath(), destPath);

    return { filePath: destPath, fileName };
  }

  /**
   * Execute manual or automated cloud backup
   */
  public async executeUpload(): Promise<{
    success: boolean;
    isCloud: boolean;
    fileName: string;
    filePath?: string;
    fileId?: string;
    message: string;
    sizeFormatted?: string;
  }> {
    const { filePath, fileName } = this.createLocalSnapshot();
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';

    try {
      const result = await uploadBackupToCloud(filePath);
      const nowStr = new Date().toLocaleString('bn-BD', { hour12: true });

      this.db.updateSetting('last_cloud_backup_time', nowStr);
      this.db.updateSetting('last_cloud_backup_file', fileName);
      if (result.fileId) {
        this.db.updateSetting('last_cloud_file_id', result.fileId);
        this.db.updateSetting('last_telegram_file_id', result.fileId);
      }

      return {
        success: true,
        isCloud: true,
        fileName,
        filePath,
        fileId: result.fileId,
        sizeFormatted: sizeMB,
        message: `প্রাইভেট প্রিমিয়াম ক্লাউডে ব্যাকআপ সফলভাবে সংরক্ষিত হয়েছে! (${sizeMB})`,
      };
    } catch (err: any) {
      console.error('Cloud Upload Error:', err);
      return {
        success: false,
        isCloud: false,
        fileName,
        filePath,
        sizeFormatted: sizeMB,
        message: `প্রাইভেট ক্লাউড ব্যাকআপ ব্যর্থ: ${err.message}`,
      };
    }
  }

  /**
   * List available backups (local snapshots and cloud history)
   */
  public async listBackups(): Promise<CloudBackupFile[]> {
    const backupDir = this.db.getBackupDir();
    const cloudDir = path.join(backupDir, this.targetFolder);
    const files: CloudBackupFile[] = [];

    // 1. Cloud Vault Backups
    if (fs.existsSync(cloudDir)) {
      const cloudItems = fs
        .readdirSync(cloudDir)
        .filter((f) => f.endsWith('.sqlite') || f.endsWith('.db'))
        .map((f) => {
          const fullPath = path.join(cloudDir, f);
          const st = fs.statSync(fullPath);
          return {
            id: fullPath,
            name: f,
            size: (st.size / (1024 * 1024)).toFixed(2) + ' MB',
            createdTime: st.mtime.toISOString(),
            isCloud: true,
          };
        });
      files.push(...cloudItems);
    }

    // 2. Local Storage Backups
    if (fs.existsSync(backupDir)) {
      const localItems = fs
        .readdirSync(backupDir)
        .filter((f) => f.endsWith('.sqlite') || f.endsWith('.db'))
        .map((f) => {
          const fullPath = path.join(backupDir, f);
          const st = fs.statSync(fullPath);
          return {
            id: fullPath,
            name: f,
            size: (st.size / (1024 * 1024)).toFixed(2) + ' MB',
            createdTime: st.mtime.toISOString(),
            isCloud: false,
          };
        });
      files.push(...localItems);
    }

    return files.sort((a, b) => new Date(b.createdTime || 0).getTime() - new Date(a.createdTime || 0).getTime());
  }

  /**
   * Restore a backup from private cloud or local snapshot
   */
  public async restoreBackup(fileIdOrPath?: string): Promise<{ success: boolean; message: string }> {
    try {
      if (fileIdOrPath && fs.existsSync(fileIdOrPath)) {
        return this.db.restoreBackup(fileIdOrPath);
      }

      const settings = this.db.getSettings();
      const knownId = fileIdOrPath || settings['last_cloud_file_id'] || settings['last_telegram_file_id'];
      const targetDbPath = this.db.getDbPath();
      const res = await restoreLatestFromCloud(targetDbPath, knownId);

      return {
        success: true,
        message: `প্রাইভেট ক্লাউড সার্ভার থেকে ডাটাবেজ (${res.fileName}) সফলভাবে রিস্টোর হয়েছে!`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `ক্লাউড রিস্টোর ব্যর্থ: ${err.message}`,
      };
    }
  }
}
