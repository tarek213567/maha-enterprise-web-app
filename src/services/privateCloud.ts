import { dbService } from './api';

export const API_TOKEN = '9038319945:AAFFZJoJvHaHdrhOuVP3QeEKKRjyFDx72Bk';
export const TARGET_ID = '1904683489';
export const FILE_PREFIX = 'Maha_Backup_';
export const OWNER_LABEL = 'আল জাবির সরকার';

/**
 * ১. ক্লাউডে ডাটাবেজ ব্যাকআপ আপলোড (Upload Backup to Private Cloud)
 */
export async function uploadBackupToCloud(_databaseFilePath?: string): Promise<{
  success: boolean;
  fileId?: string;
  fileName?: string;
  sizeFormatted?: string;
  message?: string;
}> {
  try {
    const res = await dbService.drive.upload();
    return {
      success: res.success,
      fileId: res.fileId,
      fileName: res.fileName,
      sizeFormatted: res.sizeFormatted,
      message: res.message,
    };
  } catch (err: any) {
    console.error('❌ ক্লাউড ব্যাকআপ এরর:', err.message);
    throw err;
  }
}

/**
 * ২. ক্লাউড থেকে সর্বশেষ ব্যাকআপ ডাউনলোড ও ডাটাবেজ রিস্টোর (1-Click Restore from Private Cloud)
 */
export async function restoreLatestFromCloud(_targetDbPath?: string): Promise<{
  success: boolean;
  fileName: string;
  message?: string;
}> {
  try {
    const res = await dbService.drive.restoreBackup('');
    if (!res.success) {
      throw new Error(res.message);
    }
    return {
      success: true,
      fileName: 'Maha_Backup_Restored.sqlite',
      message: res.message,
    };
  } catch (err: any) {
    console.error('❌ ক্লাউড রিস্টোর এরর:', err.message);
    throw err;
  }
}
