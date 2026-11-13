import cron, { ScheduledTask } from 'node-cron';
import { BrowserWindow } from 'electron';
import { DriveBackupService } from './driveBackup';

export class DriveScheduler {
  private driveService: DriveBackupService;
  private getWindow: () => BrowserWindow | null;
  private tasks: ScheduledTask[] = [];

  constructor(driveService: DriveBackupService, getWindow: () => BrowserWindow | null) {
    this.driveService = driveService;
    this.getWindow = getWindow;
  }

  public init() {
    console.log('[DRIVE-SCHEDULER] Initializing Dual-Schedule Automated Google Drive Backup...');

    // Schedule 1: দুপুর ১:০০ টা (13:00)
    const task1 = cron.schedule('0 13 * * *', async () => {
      console.log('[CRON] Running 1:00 PM (13:00) automated Google Drive backup...');
      await this.runScheduledBackup('13:00');
    });
    this.tasks.push(task1);

    // Schedule 2: সন্ধ্যা ৭:০০ টা (19:00)
    const task2 = cron.schedule('0 19 * * *', async () => {
      console.log('[CRON] Running 7:00 PM (19:00) automated Google Drive backup...');
      await this.runScheduledBackup('19:00');
    });
    this.tasks.push(task2);

    console.log('[DRIVE-SCHEDULER] Schedules active: 13:00 (দুপুর ১:০০) & 19:00 (সন্ধ্যা ৭:০০)');
  }

  private async runScheduledBackup(slotName: string) {
    try {
      const res = await this.driveService.executeUpload();
      console.log(`[CRON ${slotName}] Backup finished:`, res.message);

      const win = this.getWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('drive:backupResult', {
          slot: slotName,
          ...res,
        });
      }
    } catch (err: any) {
      console.error(`[CRON ${slotName}] Error:`, err);
    }
  }

  public stopAll() {
    this.tasks.forEach((t) => t.stop());
    this.tasks = [];
  }
}

