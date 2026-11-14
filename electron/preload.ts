import { contextBridge, ipcRenderer, webFrame } from 'electron';

export const api = {
  commodities: {
    getAll: () => ipcRenderer.invoke('commodities:getAll'),
    getById: (id: number) => ipcRenderer.invoke('commodities:getById', id),
    create: (data: any) => ipcRenderer.invoke('commodities:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('commodities:update', id, data),
    delete: (id: number, force?: boolean) => ipcRenderer.invoke('commodities:delete', id, force),
  },
  parties: {
    getAll: (type?: string) => ipcRenderer.invoke('parties:getAll', type),
    getById: (id: number) => ipcRenderer.invoke('parties:getById', id),
    create: (data: any) => ipcRenderer.invoke('parties:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('parties:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('parties:delete', id),
    adjustDue: (data: any) => ipcRenderer.invoke('parties:adjustDue', data),
    togglePin: (id: number) => ipcRenderer.invoke('parties:togglePin', id),
    getDetailedStatement: (id: number) => ipcRenderer.invoke('parties:getDetailedStatement', id),
    deleteVoucher: (id: number) => ipcRenderer.invoke('parties:deleteVoucher', id),
    updateLedgerNote: (id: number, desc: string) => ipcRenderer.invoke('parties:updateLedgerNote', id, desc),
  },
  purchases: {
    getAll: (limit?: number) => ipcRenderer.invoke('purchases:getAll', limit),
    getById: (id: number) => ipcRenderer.invoke('purchases:getById', id),
    create: (data: any) => ipcRenderer.invoke('purchases:create', data),
    delete: (id: number) => ipcRenderer.invoke('purchases:delete', id),
  },
  sales: {
    getAll: (limit?: number) => ipcRenderer.invoke('sales:getAll', limit),
    getById: (id: number) => ipcRenderer.invoke('sales:getById', id),
    create: (data: any) => ipcRenderer.invoke('sales:create', data),
    createBatch: (data: any) => ipcRenderer.invoke('sales:createBatch', data),
    delete: (id: number) => ipcRenderer.invoke('sales:delete', id),
  },
  stockAdjustments: {
    getAll: (limit?: number) => ipcRenderer.invoke('stockAdjustments:getAll', limit),
    create: (data: any) => ipcRenderer.invoke('stockAdjustments:create', data),
    delete: (id: number) => ipcRenderer.invoke('stockAdjustments:delete', id),
  },
  ledgers: {
    getByParty: (partyId: number) => ipcRenderer.invoke('ledgers:getByParty', partyId),
    recordVoucher: (data: any) => ipcRenderer.invoke('ledgers:recordVoucher', data),
  },
  cashbook: {
    getDaily: (date: string) => ipcRenderer.invoke('cashbook:getDaily', date),
    addEntry: (data: any) => ipcRenderer.invoke('cashbook:addEntry', data),
    delete: (id: number) => ipcRenderer.invoke('cashbook:delete', id),
  },
  expenses: {
    getAll: (limit?: number) => ipcRenderer.invoke('expenses:getAll', limit),
    create: (data: any) => ipcRenderer.invoke('expenses:create', data),
    delete: (id: number) => ipcRenderer.invoke('expenses:delete', id),
  },
  notes: {
    getAll: (category?: string, search?: string) => ipcRenderer.invoke('notes:getAll', category, search),
    getById: (id: number) => ipcRenderer.invoke('notes:getById', id),
    create: (data: any) => ipcRenderer.invoke('notes:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('notes:update', id, data),
    togglePin: (id: number) => ipcRenderer.invoke('notes:togglePin', id),
    delete: (id: number) => ipcRenderer.invoke('notes:delete', id),
  },
  reports: {
    getDashboardStats: () => ipcRenderer.invoke('reports:getDashboardStats'),
    getPnL: (startDate: string, endDate: string) => ipcRenderer.invoke('reports:getPnL', startDate, endDate),
    verifyStockIntegrity: (commodityId?: number) => ipcRenderer.invoke('reports:verifyStockIntegrity', commodityId),
  },
  system: {
    backup: (destDir?: string) => ipcRenderer.invoke('system:backup', destDir),
    restoreBackup: (sourcePath: string) => ipcRenderer.invoke('system:restoreBackup', sourcePath),
    selectBackupDirectory: () => ipcRenderer.invoke('system:selectBackupDirectory'),
    selectBackupFile: () => ipcRenderer.invoke('system:selectBackupFile'),
    relaunch: () => ipcRenderer.invoke('system:relaunch'),
    checkIntegrity: () => ipcRenderer.invoke('system:checkIntegrity'),
    getSettings: () => ipcRenderer.invoke('system:getSettings'),
    updateSetting: (key: string, value: string) => ipcRenderer.invoke('system:updateSetting', key, value),
    print: () => ipcRenderer.invoke('system:print'),
    getPaths: () => ipcRenderer.invoke('system:getPaths'),
    getVersion: () => ipcRenderer.invoke('system:getVersion'),
    purgeTestDrafts: () => ipcRenderer.invoke('system:purgeTestDrafts'),
    hasTestDrafts: () => ipcRenderer.invoke('system:hasTestDrafts'),
    logError: (message: string) => ipcRenderer.invoke('system:logError', message),
    getDiagnosticLogs: () => ipcRenderer.invoke('system:getDiagnosticLogs'),
    getLogPath: () => ipcRenderer.invoke('system:getLogPath'),
    getNetworkInfo: () => ipcRenderer.invoke('system:getNetworkInfo'),
  },
  drive: {
    getStatus: () => ipcRenderer.invoke('drive:getStatus'),
    upload: () => ipcRenderer.invoke('drive:upload'),
    listBackups: () => ipcRenderer.invoke('drive:listBackups'),
    restoreBackup: (fileIdOrPath: string) => ipcRenderer.invoke('drive:restoreBackup', fileIdOrPath),
    saveCredentials: (jsonContent: string) => ipcRenderer.invoke('drive:saveCredentials', jsonContent),
    saveWebhookUrl: (url: string) => ipcRenderer.invoke('drive:saveWebhookUrl', url),
    selectCredentialsFile: () => ipcRenderer.invoke('drive:selectCredentialsFile'),
    startOAuth: () => ipcRenderer.invoke('drive:startOAuth'),
    saveToken: (tokens: any) => ipcRenderer.invoke('drive:saveToken', tokens),
    onBackupResult: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('drive:backupResult', handler);
      return () => ipcRenderer.removeListener('drive:backupResult', handler);
    },
    onTokenUpdated: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('drive:tokenUpdated', handler);
      return () => ipcRenderer.removeListener('drive:tokenUpdated', handler);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);

contextBridge.exposeInMainWorld('desktopAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizedChange: (callback: (isMax: boolean) => void) => {
    const handler = (_: any, isMax: boolean) => callback(isMax);
    ipcRenderer.on('window-maximized-change', handler);
    return () => ipcRenderer.removeListener('window-maximized-change', handler);
  },
  getZoom: () => webFrame.getZoomFactor(),
  setZoom: (factor: number) => webFrame.setZoomFactor(factor),
});
