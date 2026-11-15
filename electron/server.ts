import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import os from 'os';
import { AppDatabase } from './db/database';

export interface ServerInfo {
  port: number;
  localIps: string[];
  tunnelCommand: string;
  permanentDomain: string;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export function getLocalIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (iface) {
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          ips.push(alias.address);
        }
      }
    }
  }
  return ips;
}

function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        return resolve({});
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-app-pin',
  });
  res.end(JSON.stringify(data));
}

export function startLocalServer(db: AppDatabase, port: number = 3030): http.Server {
  const distDir = path.join(__dirname, '../dist');

  const server = http.createServer(async (req, res) => {
    // Enable CORS Pre-flight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-app-pin',
      });
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url || '/', true);
    const pathname = parsedUrl.pathname || '/';

    // Health check endpoint (for Cloudflare Tunnel & Worker Health Probes)
    if (pathname === '/api/health' || pathname === '/health') {
      return sendJson(res, 200, {
        status: 'ok',
        app: 'Maha Enterprise',
        version: '1.5.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    }

    // 1. API Route Handling
    if (pathname.startsWith('/api/')) {
      // Security Check: PIN Verification (except for info and verify)
      const configuredPin = db.getSetting('app_security_pin') || '5555';
      const providedPin = (req.headers['x-app-pin'] as string) || (parsedUrl.query.pin as string);

      if (pathname === '/api/auth/verify-pin') {
        try {
          const body = await parseJsonBody(req);
          const valid = (body.pin || providedPin) === configuredPin;
          return sendJson(res, 200, { success: valid, valid });
        } catch {
          return sendJson(res, 400, { success: false, error: 'Invalid payload' });
        }
      }

      if (pathname === '/api/system/network-info') {
        const ips = getLocalIps();
        return sendJson(res, 200, {
          port,
          localIps: ips,
          tunnelCommand: `cloudflared tunnel --url http://localhost:${port}`,
          accessUrl: ips.length > 0 ? `http://${ips[0]}:${port}` : `http://localhost:${port}`,
          permanentDomain: 'https://maha.nexobd.pro',
        });
      }

      // Validate PIN for all data operations
      if (!providedPin || providedPin !== configuredPin) {
        return sendJson(res, 401, {
          success: false,
          error: 'অননুমোদিত এক্সেস: সঠিক পিন কোড প্রদান করুন (Invalid x-app-pin)',
        });
      }

      try {
        // --- COMMODITIES ---
        if (pathname === '/api/commodities' || pathname === '/api/stock') {
          if (req.method === 'GET') {
            const data = db.getAllCommodities();
            return sendJson(res, 200, data);
          }
          if (req.method === 'POST') {
            const body = await parseJsonBody(req);
            const data = db.createCommodity(body);
            return sendJson(res, 201, data);
          }
        }
        const commMatch = pathname.match(/^\/api\/commodities\/(\d+)$/);
        if (commMatch) {
          const id = parseInt(commMatch[1], 10);
          if (req.method === 'PUT') {
            const body = await parseJsonBody(req);
            const data = db.updateCommodity(id, body);
            return sendJson(res, 200, data);
          }
          if (req.method === 'DELETE') {
            const force = parsedUrl.query.force === 'true';
            const data = db.deleteCommodity(id, force);
            return sendJson(res, 200, data);
          }
        }

        // --- PARTIES & DUES ---
        if (pathname === '/api/parties' || pathname === '/api/dues') {
          if (req.method === 'GET') {
            const type = parsedUrl.query.type as any;
            const data = db.getAllParties(type);
            return sendJson(res, 200, data);
          }
          if (req.method === 'POST') {
            const body = await parseJsonBody(req);
            const data = db.createParty(body);
            return sendJson(res, 201, data);
          }
        }
        if (pathname === '/api/parties/import-legacy-excel' && req.method === 'POST') {
          const body = await parseJsonBody(req);
          const data = db.importLegacyExcel(body.parties || []);
          return sendJson(res, 201, data);
        }
        if (pathname === '/api/parties/adjust-due' && req.method === 'POST') {
          const body = await parseJsonBody(req);
          const data = db.recordPartyDueAdjustment(body);
          return sendJson(res, 200, data);
        }
        const partyStmtMatch = pathname.match(/^\/api\/parties\/(\d+)\/statement$/);
        if (partyStmtMatch && req.method === 'GET') {
          const id = parseInt(partyStmtMatch[1], 10);
          const data = db.getPartyDetailedStatement(id);
          return sendJson(res, 200, data);
        }
        const partyMatch = pathname.match(/^\/api\/parties\/(\d+)$/);
        if (partyMatch) {
          const id = parseInt(partyMatch[1], 10);
          if (req.method === 'GET') {
            const data = db.getPartyById(id);
            return sendJson(res, 200, data);
          }
          if (req.method === 'PUT') {
            const body = await parseJsonBody(req);
            const data = db.updateParty(id, body);
            return sendJson(res, 200, data);
          }
          if (req.method === 'DELETE') {
            const data = db.deleteParty(id);
            return sendJson(res, 200, data);
          }
        }

        // --- PURCHASES ---
        if (pathname === '/api/purchases') {
          if (req.method === 'GET') {
            const limit = parsedUrl.query.limit ? parseInt(parsedUrl.query.limit as string, 10) : undefined;
            const data = db.getAllPurchases(limit);
            return sendJson(res, 200, data);
          }
          if (req.method === 'POST') {
            const body = await parseJsonBody(req);
            const data = db.createPurchase(body);
            return sendJson(res, 201, data);
          }
        }
        const purchaseMatch = pathname.match(/^\/api\/purchases\/(\d+)$/);
        if (purchaseMatch && req.method === 'DELETE') {
          const id = parseInt(purchaseMatch[1], 10);
          const data = db.deletePurchase(id);
          return sendJson(res, 200, data);
        }

        // --- SALES ---
        if (pathname === '/api/sales') {
          if (req.method === 'GET') {
            const limit = parsedUrl.query.limit ? parseInt(parsedUrl.query.limit as string, 10) : undefined;
            const data = db.getAllSales(limit);
            return sendJson(res, 200, data);
          }
          if (req.method === 'POST') {
            const body = await parseJsonBody(req);
            const data = db.createSale(body);
            return sendJson(res, 201, data);
          }
        }
        const saleMatch = pathname.match(/^\/api\/sales\/(\d+)$/);
        if (saleMatch && req.method === 'DELETE') {
          const id = parseInt(saleMatch[1], 10);
          const data = db.deleteSale(id);
          return sendJson(res, 200, data);
        }
        if (pathname === '/api/sales/batch' && req.method === 'POST') {
          const body = await parseJsonBody(req);
          const data = db.createSaleBatch(body);
          return sendJson(res, 201, data);
        }

        // --- STOCK ADJUSTMENTS ---
        if (pathname === '/api/stock-adjustments' || pathname === '/api/shrinkage') {
          if (req.method === 'GET') {
            const limit = parsedUrl.query.limit ? parseInt(parsedUrl.query.limit as string, 10) : undefined;
            const data = db.getAllStockAdjustments(limit);
            return sendJson(res, 200, data);
          }
          if (req.method === 'POST') {
            const body = await parseJsonBody(req);
            const data = db.createStockAdjustment(body);
            return sendJson(res, 201, data);
          }
        }
        const stockAdjMatch = pathname.match(/^\/api\/(?:stock-adjustments|shrinkage)\/(\d+)$/);
        if (stockAdjMatch && req.method === 'DELETE') {
          const id = parseInt(stockAdjMatch[1], 10);
          const data = db.deleteStockAdjustment(id);
          return sendJson(res, 200, data);
        }

        // --- LEDGER & PAYMENT VOUCHERS ---
        const ledgerPartyMatch = pathname.match(/^\/api\/ledgers\/(\d+)$/);
        if (ledgerPartyMatch && req.method === 'GET') {
          const partyId = parseInt(ledgerPartyMatch[1], 10);
          const data = db.getPartyLedger(partyId);
          return sendJson(res, 200, data);
        }
        const voucherDeleteMatch = pathname.match(/^\/api\/(?:ledgers\/voucher|parties\/voucher|ledgers)\/(\d+)$/);
        if (voucherDeleteMatch && req.method === 'DELETE') {
          const id = parseInt(voucherDeleteMatch[1], 10);
          const data = db.deletePartyPaymentVoucher(id);
          return sendJson(res, 200, data);
        }
        if ((pathname === '/api/ledgers/voucher' || pathname === '/api/collect') && req.method === 'POST') {
          const body = await parseJsonBody(req);
          const data = db.recordPartyPaymentVoucher(body);
          return sendJson(res, 201, data);
        }

        // --- CASHBOOK ---
        if (pathname === '/api/cashbook') {
          if (req.method === 'GET') {
            const date = (parsedUrl.query.date as string) || new Date().toISOString().split('T')[0];
            const data = db.getDailyCashbook(date);
            return sendJson(res, 200, data);
          }
          if (req.method === 'POST') {
            const body = await parseJsonBody(req);
            const data = db.addCashbookEntry(body);
            return sendJson(res, 201, data);
          }
        }
        const cashbookMatch = pathname.match(/^\/api\/cashbook\/(\d+)$/);
        if (cashbookMatch && req.method === 'DELETE') {
          const id = parseInt(cashbookMatch[1], 10);
          const data = db.deleteCashbook(id);
          return sendJson(res, 200, data);
        }

        // --- EXPENSES ---
        if (pathname === '/api/expenses') {
          if (req.method === 'GET') {
            const limit = parsedUrl.query.limit ? parseInt(parsedUrl.query.limit as string, 10) : undefined;
            const data = db.getAllExpenses(limit);
            return sendJson(res, 200, data);
          }
          if (req.method === 'POST') {
            const body = await parseJsonBody(req);
            const data = db.addExpense(body);
            return sendJson(res, 201, data);
          }
        }
        const expenseMatch = pathname.match(/^\/api\/expenses\/(\d+)$/);
        if (expenseMatch && req.method === 'DELETE') {
          const id = parseInt(expenseMatch[1], 10);
          const data = db.deleteExpense(id);
          return sendJson(res, 200, data);
        }

        // --- NOTES ---
        if (pathname === '/api/notes') {
          if (req.method === 'GET') {
            const category = parsedUrl.query.category as string;
            const search = parsedUrl.query.search as string;
            const data = db.getAllNotes(category, search);
            return sendJson(res, 200, data);
          }
          if (req.method === 'POST') {
            const body = await parseJsonBody(req);
            const data = db.createNote(body);
            return sendJson(res, 201, data);
          }
        }

        // --- REPORTS & DASHBOARD ---
        if (pathname === '/api/reports/stats' && req.method === 'GET') {
          const data = db.getDashboardStats();
          return sendJson(res, 200, data);
        }
        if (pathname === '/api/reports/pnl' && req.method === 'GET') {
          const start = (parsedUrl.query.startDate as string) || new Date().toISOString().split('T')[0];
          const end = (parsedUrl.query.endDate as string) || new Date().toISOString().split('T')[0];
          const data = db.getProfitAndLossReport(start, end);
          return sendJson(res, 200, data);
        }

        // --- SYSTEM ---
        if (pathname === '/api/system/settings') {
          if (req.method === 'GET') {
            const data = db.getSettings();
            return sendJson(res, 200, data);
          }
          if (req.method === 'POST') {
            const body = await parseJsonBody(req);
            db.updateSetting(body.key, body.value);
            return sendJson(res, 200, { success: true });
          }
        }
        if (pathname === '/api/system/version' && req.method === 'GET') {
          return sendJson(res, 200, { version: db.getAppVersion() });
        }
        if (pathname === '/api/system/backup' && req.method === 'POST') {
          const data = db.createBackup();
          return sendJson(res, 200, data);
        }

        return sendJson(res, 404, { success: false, error: 'Endpoint not found' });
      } catch (err: any) {
        console.error('[LocalServer-API Error]:', err);
        return sendJson(res, 500, { success: false, error: err.message || 'Internal Server Error' });
      }
    }

    // 2. Static File Serving (Frontend PWA for Mobile/iPhone)
    let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname);

    // If file doesn't exist, check without trailing slash or fallback to index.html for SPA
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Static frontend files not built yet. Run npm run build.');
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[PWA Server] Listening on http://0.0.0.0:${port}`);
    const ips = getLocalIps();
    console.log(`[LocalServer] Background HTTP Server running on http://localhost:${port}`);
    if (ips.length > 0) {
      console.log(`[LocalServer] iPhone / Remote Access: http://${ips[0]}:${port}`);
    }
    console.log(`[LocalServer] Cloudflare Tunnel: cloudflared tunnel --url http://localhost:${port}`);
  });

  return server;
}
