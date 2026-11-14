import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { AppDatabase } from './db/database';
import { DriveBackupService } from './services/driveBackup';
import { DriveScheduler } from './services/driveScheduler';
import { startLocalServer, getLocalIps } from './server';

// Set App User Model ID for Windows Taskbar Icon & Grouping
if (process.platform === 'win32') {
  app.setAppUserModelId('com.mahaenterprise.pos');
}

// Persistent Diagnostics File Logger
const logsDir = path.join(app.getPath('userData'), 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (e) {
  console.error('Failed to create logs directory:', e);
}
const logFilePath = path.join(logsDir, 'maha-diagnostics.log');

export function logToFile(level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | string, msg: string) {
  const time = new Date().toISOString();
  const line = `[${time}] [${level}] ${msg}\n`;
  try {
    fs.appendFileSync(logFilePath, line, 'utf8');
  } catch (e) {
    // fallback
  }
  if (level === 'ERROR' || level === 'CRITICAL') {
    console.error(line.trim());
  } else {
    console.log(line.trim());
  }
}

logToFile('INFO', `=== Maha Enterprise v1.5.0 PRO Startup (Node: ${process.version}, Electron: ${process.versions.electron}) ===`);

// লো-এন্ড GPU ও রেন্ডারার ব্ল্যাংক স্ক্রিন স্থায়ী সমাধান
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-2d-canvas-image-chromium');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('no-sandbox');

// লো-র‍্যাম সেফটি: মেমোরি সীমা মাত্র ৫১২ এমবি এবং সাইজ অপ্টিমাইজড
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512 --optimize-for-size');

// ব্যাকগ্রাউন্ড থ্রটলিং বন্ধ যেন উইন্ডো ইন-অ্যাক্টিভ হলে ফ্রিজ না হয়
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

let mainWindow: BrowserWindow | null = null;
let db: AppDatabase | null = null;
let driveBackupService: DriveBackupService | null = null;
let driveScheduler: DriveScheduler | null = null;

function createWindow() {
  const icoCandidate = path.join(__dirname, '../assets/icon.ico');
  const pngCandidate = path.join(__dirname, '../assets/icon.png');
  const iconPath = fs.existsSync(icoCandidate) ? icoCandidate : pngCandidate;

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    title: 'মাহা এন্টারপ্রাইজ - শস্য আড়ত ও পাইকারি ব্যবসা ব্যবস্থাপনা',
    icon: iconPath,
    backgroundColor: '#0B0F19',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  // 1.5s fallback safety net for showing window
  const showTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      logToFile('WARN', 'Window ready-to-show timeout: Forcing mainWindow.show()');
      mainWindow.show();
    }
  }, 1500);

  mainWindow.once('ready-to-show', () => {
    clearTimeout(showTimeout);
    logToFile('INFO', 'Window ready-to-show fired: Showing mainWindow');
    mainWindow?.show();
  });

  // Renderer Console Message Interceptor -> Logs all warnings and errors to diagnostics file
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelStr = level === 3 ? 'ERROR' : level === 2 ? 'WARN' : 'INFO';
    const cleanSource = sourceId ? path.basename(sourceId) : 'renderer';
    if (level >= 2) {
      logToFile(`RENDERER-${levelStr}`, `${message} (${cleanSource}:${line})`);
    }
  });

  // Page Load Failure Interceptor -> Fallback Recovery UI instead of Blank Screen
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logToFile('ERROR', `did-fail-load: ${errorCode} ${errorDescription} on ${validatedURL}`);
    const emergencyHtml = `
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8">
        <title>মাহা এন্টারপ্রাইজ - লোড ব্যর্থ</title>
        <style>
          body { background: #0B0F19; color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; user-select: none; }
          .card { background: #111827; border: 1px solid #DC2626; border-radius: 16px; padding: 32px; max-width: 520px; width: 90%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); }
          h2 { color: #F87171; margin-top: 0; font-size: 20px; }
          p { color: #9CA3AF; font-size: 13px; line-height: 1.6; }
          .error-box { background: #030712; color: #FCA5A5; font-family: monospace; font-size: 12px; padding: 12px; border-radius: 8px; margin: 16px 0; text-align: left; word-break: break-all; }
          .btn-group { display: flex; gap: 10px; justify-content: center; margin-top: 20px; }
          .btn { background: #059669; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; }
          .btn:hover { background: #047857; }
          .btn-sec { background: #374151; color: #D1D5DB; }
          .btn-sec:hover { background: #4B5563; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>⚠️ অ্যাপ্লিকেশন উইন্ডো লোড হতে পারেনি</h2>
          <p>সফটওয়্যার রেন্ডারার ফাইল লোড করতে সমস্যা দেখা দিয়েছে (${errorDescription})। অনুগ্রহ করে নিচের বাটনে ক্লিক করে পুনরায় চেষ্টা করুন।</p>
          <div class="error-box">ত্রুটি কোড: ${errorCode}<br>URL: ${validatedURL}</div>
          <div class="btn-group">
            <button class="btn" onclick="location.reload()">পুনরায় চেষ্টা করুন</button>
            <button class="btn btn-sec" onclick="window.location.href='http://localhost:5173'">Dev Server (5173)</button>
          </div>
        </div>
      </body>
      </html>
    `;
    mainWindow?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(emergencyHtml)}`);
  });

  // Renderer Process Crash & Blank Screen Auto-Recovery (Self-Healing Handler)
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logToFile('CRITICAL', `Renderer process crashed: ${details.reason} (exitCode: ${details.exitCode})`);
    if (details.reason !== 'clean-exit') {
      logToFile('WARN', 'Auto-recovering: Reloading mainWindow after crash...');
      try {
        mainWindow?.reload(); // ব্ল্যাংক স্ক্রিন না রেখে সাথে সাথে অটো-রিলোড
      } catch (err) {
        logToFile('ERROR', `Failed to reload after render-process-gone: ${err}`);
      }
    }
  });

  mainWindow.on('unresponsive', () => {
    logToFile('WARN', 'Window unresponsive, attempting soft reload recovery...');
    try {
      mainWindow?.reload();
    } catch (err) {
      logToFile('ERROR', `Failed to reload on unresponsive: ${err}`);
    }
  });

  mainWindow.webContents.on('responsive', () => {
    logToFile('INFO', 'Renderer is responsive.');
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximized-change', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximized-change', false);
  });

  // Open external links safely or fullscreen toggle
  mainWindow.removeMenu(); // Clean desktop ERP UI without default chromium menu

  // In development, load from Vite dev server. In production, load built index.html
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    logToFile('INFO', `Loading Vite Dev Server: ${process.env.VITE_DEV_SERVER_URL}`);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    logToFile('INFO', `Loading index.html: ${indexPath} (exists: ${fs.existsSync(indexPath)})`);
    mainWindow.loadFile(indexPath).catch((err) => {
      logToFile('WARN', `loadFile failed (${err.message}), attempting fallback to http://localhost:5173`);
      mainWindow?.loadURL('http://localhost:5173').catch((devErr) => {
        logToFile('ERROR', `All window page loads failed: ${devErr.message}`);
      });
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

process.on('uncaughtException', (error) => {
  logToFile('CRITICAL', `UNCAUGHT EXCEPTION: ${error?.stack || error}`);
});

process.on('unhandledRejection', (reason) => {
  logToFile('CRITICAL', `UNHANDLED REJECTION: ${reason}`);
});

// Initialize Database & IPC handlers
function initApp() {
  try {
    db = new AppDatabase();
    driveBackupService = new DriveBackupService(db, () => {
      mainWindow?.webContents.send('drive:tokenUpdated');
    });
    driveScheduler = new DriveScheduler(driveBackupService, () => mainWindow);
    driveScheduler.init();

    // Start Background HTTP Server on Port 3030 for iPhone & Cloudflare Tunnel
    try {
      startLocalServer(db, 3030);
      const ips = getLocalIps();
      logToFile('INFO', `Background Local Server started on http://localhost:3030 (IPs: ${ips.join(', ')})`);
    } catch (serverErr: any) {
      logToFile('WARN', `Could not start local HTTP server on port 3030: ${serverErr.message}`);
    }
  } catch (err: any) {
    console.error('Failed to initialize database:', err);
    dialog.showErrorBox(
      'ডাটাবেস লোড ত্রুটি (Database Error)',
      `ডাটাবেস চালু করা সম্ভব হয়নি: ${err.message}\nদয়া করে npm run rebuild চালান।`
    );
    app.quit();
    return;
  }

  // Commodities
  ipcMain.handle('commodities:getAll', () => db!.getAllCommodities());
  ipcMain.handle('commodities:getById', (_, id) => db!.getCommodityById(id));
  ipcMain.handle('commodities:create', (_, data) => db!.createCommodity(data));
  ipcMain.handle('commodities:update', (_, id, data) => db!.updateCommodity(id, data));
  ipcMain.handle('commodities:delete', (_, id, force) => db!.deleteCommodity(id, force));

  // Parties
  ipcMain.handle('parties:getAll', (_, type) => db!.getAllParties(type));
  ipcMain.handle('parties:getById', (_, id) => db!.getPartyById(id));
  ipcMain.handle('parties:create', (_, data) => db!.createParty(data));
  ipcMain.handle('parties:update', (_, id, data) => db!.updateParty(id, data));
  ipcMain.handle('parties:delete', (_, id) => db!.deleteParty(id));
  ipcMain.handle('parties:adjustDue', (_, data) => db!.recordPartyDueAdjustment(data));
  ipcMain.handle('parties:togglePin', (_, id) => db!.togglePartyPin(id));
  ipcMain.handle('parties:getDetailedStatement', (_, id) => db!.getPartyDetailedStatement(id));
  ipcMain.handle('parties:deleteVoucher', (_, id) => db!.deletePartyPaymentVoucher(id));
  ipcMain.handle('parties:updateLedgerNote', (_, id, desc) => db!.updatePartyLedgerNote(id, desc));

  // Purchases
  ipcMain.handle('purchases:getAll', (_, limit) => db!.getAllPurchases(limit));
  ipcMain.handle('purchases:getById', (_, id) => db!.getPurchaseById(id));
  ipcMain.handle('purchases:create', (_, data) => db!.createPurchase(data));
  ipcMain.handle('purchases:delete', (_, id) => db!.deletePurchase(id));

  // Sales
  ipcMain.handle('sales:getAll', (_, limit) => db!.getAllSales(limit));
  ipcMain.handle('sales:getById', (_, id) => db!.getSaleById(id));
  ipcMain.handle('sales:create', (_, data) => db!.createSale(data));
  ipcMain.handle('sales:createBatch', (_, data) => db!.createSaleBatch(data));
  ipcMain.handle('sales:delete', (_, id) => db!.deleteSale(id));

  // Stock Adjustments
  ipcMain.handle('stockAdjustments:getAll', (_, limit) => db!.getAllStockAdjustments(limit));
  ipcMain.handle('stockAdjustments:create', (_, data) => db!.createStockAdjustment(data));
  ipcMain.handle('stockAdjustments:delete', (_, id) => db!.deleteStockAdjustment(id));

  // Ledgers
  ipcMain.handle('ledgers:getByParty', (_, partyId) => db!.getPartyLedger(partyId));
  ipcMain.handle('ledgers:recordVoucher', (_, data) => db!.recordPartyPaymentVoucher(data));

  // Cashbook
  ipcMain.handle('cashbook:getDaily', (_, date) => db!.getDailyCashbook(date));
  ipcMain.handle('cashbook:addEntry', (_, data) => db!.addCashbookEntry(data));
  ipcMain.handle('cashbook:delete', (_, id) => db!.deleteCashbook(id));

  // Expenses
  ipcMain.handle('expenses:getAll', (_, limit) => db!.getAllExpenses(limit));
  ipcMain.handle('expenses:create', (_, data) => db!.addExpense(data));
  ipcMain.handle('expenses:delete', (_, id) => db!.deleteExpense(id));

  // Dedicated Notebook
  ipcMain.handle('notes:getAll', (_, category, search) => db!.getAllNotes(category, search));
  ipcMain.handle('notes:getById', (_, id) => db!.getNoteById(id));
  ipcMain.handle('notes:create', (_, data) => db!.createNote(data));
  ipcMain.handle('notes:update', (_, id, data) => db!.updateNote(id, data));
  ipcMain.handle('notes:togglePin', (_, id) => db!.toggleNotePin(id));
  ipcMain.handle('notes:delete', (_, id) => db!.deleteNote(id));

  // Reports
  ipcMain.handle('reports:getDashboardStats', () => db!.getDashboardStats());
  ipcMain.handle('reports:getPnL', (_, startDate, endDate) => db!.getProfitAndLossReport(startDate, endDate));
  ipcMain.handle('reports:verifyStockIntegrity', (_, commId) => db!.verifyStockIntegrity(commId));

  // System & Backup
  ipcMain.handle('system:backup', (_, destDir) => db!.createBackup(destDir));
  ipcMain.handle('system:restoreBackup', (_, sourcePath) => db!.restoreBackup(sourcePath));
  ipcMain.handle('system:checkIntegrity', () => db!.runIntegrityCheck());
  ipcMain.handle('system:getSettings', () => db!.getSettings());
  ipcMain.handle('system:updateSetting', (_, key, value) => db!.updateSetting(key, value));
  ipcMain.handle('system:getVersion', () => db!.getAppVersion());
  ipcMain.handle('system:purgeTestDrafts', () => db!.purgeTestDrafts());
  ipcMain.handle('system:hasTestDrafts', () => db!.hasTestDrafts());
  ipcMain.handle('system:logError', (_, message: string) => {
    logToFile('RENDERER-ERROR', message);
    return true;
  });
  ipcMain.handle('system:getDiagnosticLogs', async () => {
    try {
      if (fs.existsSync(logFilePath)) {
        const content = fs.readFileSync(logFilePath, 'utf8');
        const lines = content.trim().split('\n');
        return lines.slice(-200).join('\n');
      }
    } catch (e) {}
    return 'No diagnostic logs found.';
  });
  ipcMain.handle('system:getLogPath', () => logFilePath);
  ipcMain.handle('system:getNetworkInfo', () => {
    const ips = getLocalIps();
    return {
      port: 3030,
      localIps: ips,
      accessUrl: ips.length > 0 ? `http://${ips[0]}:3030` : `http://localhost:3030`,
      tunnelCommand: `cloudflared tunnel --url http://localhost:3030`,
      permanentDomain: 'https://maha.nexobd.pro',
    };
  });
  ipcMain.handle('system:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });
  ipcMain.handle('system:getPaths', () => ({
    dbPath: db!.getDbPath(),
    backupDir: db!.getBackupDir(),
  }));

  ipcMain.handle('system:selectBackupDirectory', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'ব্যাকআপ রাখার ফোল্ডার বা পেনড্রাইভ নির্বাচন করুন',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('system:selectBackupFile', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'রিস্টোর করার ব্যাকআপ ডাটাবেজ ফাইল (.db, .sqlite, .bak) নির্বাচন করুন',
      properties: ['openFile'],
      filters: [
        { name: 'SQLite Database Backups (*.db, *.sqlite, *.bak)', extensions: ['db', 'sqlite', 'bak'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('system:print', async () => {
    if (!mainWindow) return false;
    mainWindow.webContents.print({
      silent: false,
      printBackground: true,
      color: true,
    });
    return true;
  });

  // Google Drive Cloud Vault IPC Handlers
  ipcMain.handle('drive:getStatus', () => driveBackupService!.getStatus());
  ipcMain.handle('drive:upload', () => driveBackupService!.executeUpload());
  ipcMain.handle('drive:listBackups', () => driveBackupService!.listBackups());
  ipcMain.handle('drive:restoreBackup', (_, fileIdOrPath: string) => driveBackupService!.restoreBackup(fileIdOrPath));
  ipcMain.handle('drive:saveCredentials', (_, jsonContent: string) => driveBackupService!.saveCredentials(jsonContent));
  ipcMain.handle('drive:saveWebhookUrl', (_, url: string) => driveBackupService!.saveWebhookUrl(url));
  ipcMain.handle('drive:startOAuth', () => driveBackupService!.startOAuthFlow());
  ipcMain.handle('drive:saveToken', (_, tokens: any) => driveBackupService!.saveOAuthToken(tokens));
  ipcMain.handle('drive:selectCredentialsFile', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Google Drive credentials.json ফাইল নির্বাচন করুন',
      properties: ['openFile'],
      filters: [{ name: 'JSON Credentials (*.json)', extensions: ['json'] }],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath, 'utf8');
      return driveBackupService!.saveCredentials(content);
    }
    return null;
  });

  // Native Desktop Window Controls
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });
  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });
  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });
  ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  createWindow();
}

app.whenReady().then(initApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (driveScheduler) {
      driveScheduler.stopAll();
    }
    if (db) {
      db.close(); // Automatically triggers safety backup on application exit
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

