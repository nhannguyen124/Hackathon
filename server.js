/* =============================================================
   LÁ CHẮN SỐ – Máy chủ API (Node.js ≥ 18, không cần cài thư viện)

   Chạy:   npm start        (hoặc: node server.js)
   Mở:     http://localhost:3000

   - Phục vụ index.html / style.css / script.js
   - POST /api/scan          Nhận tệp (≤ 32 MB) → tra cứu / gửi lên VirusTotal
   - GET  /api/scan/:id      Hỏi kết quả phân tích VirusTotal
   - POST /api/reports       Lưu báo cáo lừa đảo vào cơ sở dữ liệu
   - GET  /api/reports       Danh sách báo cáo (cần ADMIN_TOKEN)
   - GET  /api/stats         Thống kê tổng hợp (công khai, không lộ nội dung)
   - GET  /api/health        Trạng thái máy chủ

   Khoá VirusTotal đặt trong tệp .env (xem .env.example) – không bao giờ
   gửi khoá xuống trình duyệt.
   ============================================================= */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
loadEnv(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const VT_KEY = (process.env.VIRUSTOTAL_API_KEY || '').trim();
const VT_BASE = (process.env.VT_BASE_URL || 'https://www.virustotal.com/api/v3').replace(/\/+$/, '');
const ADMIN_TOKEN = (process.env.ADMIN_TOKEN || '').trim();
const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || 'data');
const MAX_UPLOAD = 32 * 1024 * 1024; // giới hạn tải trực tiếp của VirusTotal API
const MAX_JSON = 16 * 1024;

const REPORT_TYPES = ['call', 'sms', 'link', 'bank'];
const RISK_LEVELS = ['danger', 'warning', 'safe'];

/* Chỉ phục vụ đúng 3 tệp giao diện – tuyệt đối không lộ .env, data/, server.js */
const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/script.js': ['script.js', 'text/javascript; charset=utf-8']
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ')
};

/* ---------- .env ---------- */
function loadEnv(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    let value = m[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

/* ---------- Cơ sở dữ liệu: SQLite (node:sqlite) hoặc tệp JSON ---------- */
function openDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(DATA_DIR, 'reports.db'));
    db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        code              TEXT UNIQUE,
        client_id         TEXT UNIQUE,
        type              TEXT NOT NULL,
        content           TEXT NOT NULL,
        forward_police    INTEGER NOT NULL DEFAULT 0,
        risk_level        TEXT,
        queued_offline    INTEGER NOT NULL DEFAULT 0,
        client_created_at TEXT,
        created_at        TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reports_created ON reports (created_at);
    `);
    const byClient = db.prepare('SELECT * FROM reports WHERE client_id = ?');
    const insert = db.prepare(`INSERT INTO reports
      (client_id, type, content, forward_police, risk_level, queued_offline, client_created_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const setCode = db.prepare('UPDATE reports SET code = ? WHERE id = ?');
    const byId = db.prepare('SELECT * FROM reports WHERE id = ?');
    return {
      kind: 'sqlite',
      insert(r) {
        if (r.clientId) {
          const existing = byClient.get(r.clientId);
          if (existing) return { row: existing, duplicate: true };
        }
        const info = insert.run(r.clientId, r.type, r.content, r.forwardPolice ? 1 : 0, r.riskLevel,
          r.queuedOffline ? 1 : 0, r.clientCreatedAt, new Date().toISOString());
        const id = Number(info.lastInsertRowid);
        setCode.run(makeCode(id), id);
        return { row: byId.get(id), duplicate: false };
      },
      list(limit) { return db.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT ?').all(limit); },
      stats() {
        const total = db.prepare('SELECT COUNT(*) AS n FROM reports').get().n;
        const byType = db.prepare('SELECT type, COUNT(*) AS n FROM reports GROUP BY type').all();
        return { total, byType: Object.fromEntries(byType.map((r) => [r.type, r.n])) };
      }
    };
  } catch (err) {
    console.warn('[db] Không dùng được node:sqlite (%s) – chuyển sang lưu tệp JSON.', err.message);
    const file = path.join(DATA_DIR, 'reports.json');
    let rows = [];
    try { rows = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { rows = []; }
    const persist = () => {
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(rows, null, 2));
      fs.renameSync(tmp, file);
    };
    return {
      kind: 'json',
      insert(r) {
        if (r.clientId) {
          const existing = rows.find((x) => x.client_id === r.clientId);
          if (existing) return { row: existing, duplicate: true };
        }
        const id = rows.length ? rows[rows.length - 1].id + 1 : 1;
        const row = {
          id, code: makeCode(id), client_id: r.clientId, type: r.type, content: r.content,
          forward_police: r.forwardPolice ? 1 : 0, risk_level: r.riskLevel, queued_offline: r.queuedOffline ? 1 : 0,
          client_created_at: r.clientCreatedAt, created_at: new Date().toISOString()
        };
        rows.push(row);
        persist();
        return { row, duplicate: false };
      },
      list(limit) { return rows.slice(-limit).reverse(); },
      stats() {
        const byType = {};
        rows.forEach((r) => { byType[r.type] = (byType[r.type] || 0) + 1; });
        return { total: rows.length, byType };
      }
    };
  }
}

function makeCode(id) {
  const d = new Date();
  return `DN-${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}-${String(id).padStart(4, '0')}`;
}

const db = openDatabase();

/* ---------- Tiện ích HTTP ---------- */
function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const payload = isBuf ? body : JSON.stringify(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': isBuf ? headers['Content-Type'] : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(payload);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > limit) {
      reject(Object.assign(new Error('too_large'), { status: 413 }));
      req.resume();
      return;
    }
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('too_large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* Giới hạn tần suất đơn giản theo IP (chống spam báo cáo / quét) */
const buckets = new Map();
function rateLimited(req, key, max, windowMs) {
  const ip = req.socket.remoteAddress || 'unknown';
  const k = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(k) || { count: 0, reset: now + windowMs };
  if (now > b.reset) { b.count = 0; b.reset = now + windowMs; }
  b.count += 1;
  buckets.set(k, b);
  return b.count > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k);
}, 60000).unref();

/* ---------- VirusTotal ---------- */
class VtError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function vt(pathname, init = {}) {
  let res;
  try {
    res = await fetch(VT_BASE + pathname, {
      ...init,
      headers: { 'x-apikey': VT_KEY, accept: 'application/json', ...(init.headers || {}) },
      signal: AbortSignal.timeout(90000)
    });
  } catch (err) {
    throw new VtError(502, 'Không kết nối được tới VirusTotal. Kiểm tra mạng của máy chủ rồi thử lại.');
  }
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  if (res.status === 401 || res.status === 403) throw new VtError(502, 'Khoá API VirusTotal không hợp lệ hoặc đã bị khoá. Kiểm tra VIRUSTOTAL_API_KEY trong tệp .env.');
  if (res.status === 429) throw new VtError(429, 'VirusTotal đang giới hạn lượt quét (gói miễn phí: 4 lượt/phút, 500 lượt/ngày). Hãy thử lại sau 1 phút.');
  if (res.status === 413) throw new VtError(413, 'Tệp vượt giới hạn dung lượng của VirusTotal.');
  throw new VtError(502, `VirusTotal trả lỗi ${res.status}${data.error && data.error.message ? `: ${data.error.message}` : ''}.`);
}

function summarize({ name, size, sha256, typeDesc, stats = {}, results = {}, source }) {
  const s = {
    malicious: stats.malicious || 0,
    suspicious: stats.suspicious || 0,
    harmless: stats.harmless || 0,
    undetected: stats.undetected || 0
  };
  // 1–2 công cụ báo đỏ thường là cảnh báo nhầm → "nghi ngờ"; từ 3 trở lên → "nguy hiểm"
  const level = s.malicious >= 3 ? 'danger' : (s.malicious > 0 || s.suspicious > 0) ? 'warning' : 'safe';
  const detections = Object.entries(results)
    .filter(([, r]) => r && (r.category === 'malicious' || r.category === 'suspicious') && r.result)
    .sort((a, b) => (a[1].category === 'malicious' ? -1 : 1) - (b[1].category === 'malicious' ? -1 : 1))
    .slice(0, 5)
    .map(([engine, r]) => ({ engine, result: String(r.result).slice(0, 80) }));
  return {
    name, size, sha256, typeDesc: typeDesc || '', level, stats: s, detections,
    live: true, source,
    permalink: sha256 ? `https://www.virustotal.com/gui/file/${sha256}` : null
  };
}

function safeFileName(raw) {
  let name = 'tep-tai-len';
  try { name = decodeURIComponent(String(raw || '')); } catch { /* giữ mặc định */ }
  name = path.basename(name).replace(/[\u0000-\u001f"\\]/g, '').trim().slice(0, 120);
  return name || 'tep-tai-len';
}

async function handleScanUpload(req, res) {
  if (!VT_KEY) return send(res, 503, { error: 'Máy chủ chưa cấu hình khoá VirusTotal (VIRUSTOTAL_API_KEY).' });
  if (rateLimited(req, 'scan', 6, 60000)) return send(res, 429, { error: 'Bạn quét quá nhiều tệp trong 1 phút. Hãy đợi một chút rồi thử lại.' });

  let buf;
  try {
    buf = await readBody(req, MAX_UPLOAD);
  } catch (err) {
    if (err.status === 413) return send(res, 413, { error: 'Tệp vượt giới hạn 32 MB. Hãy chọn tệp nhỏ hơn.' });
    throw err;
  }
  if (!buf.length) return send(res, 400, { error: 'Tệp trống (0 byte). Hãy chọn tệp khác.' });

  const name = safeFileName(req.headers['x-file-name']);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

  // 1) Tra cứu theo mã băm – nếu VirusTotal đã biết tệp này thì không cần tải lên
  const known = await vt(`/files/${sha256}`);
  if (known && known.data && known.data.attributes) {
    const a = known.data.attributes;
    const stats = a.last_analysis_stats || {};
    const total = Object.values(stats).reduce((x, y) => x + (Number(y) || 0), 0);
    if (total > 0) {
      return send(res, 200, {
        status: 'completed',
        result: summarize({
          name, size: buf.length, sha256, typeDesc: a.type_description,
          stats, results: a.last_analysis_results, source: 'cache'
        })
      });
    }
  }

  // 2) Tệp mới: tải lên để phân tích
  const form = new FormData();
  form.append('file', new Blob([buf]), name);
  const up = await vt('/files', { method: 'POST', body: form });
  const analysisId = up && up.data && up.data.id;
  if (!analysisId) throw new VtError(502, 'VirusTotal không trả về mã phân tích. Hãy thử lại.');
  pending.set(analysisId, { name, size: buf.length, sha256, at: Date.now() });
  return send(res, 202, { status: 'queued', analysisId, sha256 });
}

/* Ghi nhớ tên/kích thước tệp đang chờ phân tích (để trả kết quả đầy đủ) */
const pending = new Map();
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, v] of pending) if (v.at < cutoff) pending.delete(id);
}, 10 * 60 * 1000).unref();

async function handleScanPoll(req, res, id) {
  if (!VT_KEY) return send(res, 503, { error: 'Máy chủ chưa cấu hình khoá VirusTotal (VIRUSTOTAL_API_KEY).' });
  if (!/^[A-Za-z0-9=_-]{8,200}$/.test(id)) return send(res, 400, { error: 'Mã phân tích không hợp lệ.' });
  if (rateLimited(req, 'poll', 30, 60000)) return send(res, 429, { error: 'Hỏi kết quả quá nhanh. Hãy đợi vài giây.' });

  const data = await vt(`/analyses/${encodeURIComponent(id)}`);
  if (!data || !data.data) return send(res, 404, { error: 'Không tìm thấy phiên phân tích này trên VirusTotal.' });
  const a = data.data.attributes || {};
  if (a.status !== 'completed') return send(res, 200, { status: a.status || 'queued' });

  const info = pending.get(id) || {};
  const sha256 = (data.meta && data.meta.file_info && data.meta.file_info.sha256) || info.sha256 || null;
  pending.delete(id);
  return send(res, 200, {
    status: 'completed',
    result: summarize({
      name: info.name || 'Tệp đã quét', size: info.size || (data.meta && data.meta.file_info && data.meta.file_info.size) || 0,
      sha256, stats: a.stats, results: a.results, source: 'upload'
    })
  });
}

/* ---------- Báo cáo ---------- */
function validateReport(body) {
  if (!body || typeof body !== 'object') return 'Dữ liệu báo cáo không hợp lệ.';
  if (!REPORT_TYPES.includes(body.type)) return 'Hãy chọn hình thức lừa đảo: cuộc gọi, tin nhắn, đường dẫn hoặc số tài khoản.';
  if (typeof body.content !== 'string' || !body.content.trim()) return 'Hãy nhập nội dung, số điện thoại hoặc đường dẫn cần báo cáo.';
  if (body.content.length > 2000) return 'Nội dung báo cáo dài quá 2.000 ký tự. Hãy rút gọn lại.';
  if (body.riskLevel != null && !RISK_LEVELS.includes(body.riskLevel)) return 'Mức rủi ro không hợp lệ.';
  if (body.clientId != null && !/^[A-Za-z0-9-]{8,64}$/.test(String(body.clientId))) return 'Mã báo cáo không hợp lệ.';
  return null;
}

async function handleCreateReport(req, res) {
  if (rateLimited(req, 'report', 20, 60000)) return send(res, 429, { error: 'Bạn gửi quá nhiều báo cáo trong 1 phút. Hãy thử lại sau.' });
  let body;
  try {
    body = JSON.parse((await readBody(req, MAX_JSON)).toString('utf8') || '{}');
  } catch (err) {
    if (err.status === 413) return send(res, 413, { error: 'Báo cáo quá lớn.' });
    return send(res, 400, { error: 'Dữ liệu gửi lên không đúng định dạng JSON.' });
  }
  const problem = validateReport(body);
  if (problem) return send(res, 400, { error: problem });

  const clientCreatedAt = typeof body.clientCreatedAt === 'string' && !Number.isNaN(Date.parse(body.clientCreatedAt))
    ? new Date(body.clientCreatedAt).toISOString() : null;
  const { row, duplicate } = db.insert({
    clientId: body.clientId ? String(body.clientId) : null,
    type: body.type,
    content: body.content.trim(),
    forwardPolice: !!body.forwardPolice,
    riskLevel: body.riskLevel || null,
    queuedOffline: !!body.queuedOffline,
    clientCreatedAt
  });
  return send(res, duplicate ? 200 : 201, { id: row.id, code: row.code, createdAt: row.created_at, duplicate });
}

function handleListReports(req, res, url) {
  if (!ADMIN_TOKEN) return send(res, 403, { error: 'Chưa bật xem danh sách. Đặt ADMIN_TOKEN trong tệp .env để dùng.' });
  const given = Buffer.from(String(req.headers['x-admin-token'] || ''));
  const expected = Buffer.from(ADMIN_TOKEN);
  const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (!ok) return send(res, 401, { error: 'Sai mã quản trị (x-admin-token).' });
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50));
  return send(res, 200, { items: db.list(limit), ...db.stats() });
}

/* ---------- Router ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;
  try {
    if (req.method === 'GET' && STATIC_FILES[pathname]) {
      const [file, type] = STATIC_FILES[pathname];
      return send(res, 200, fs.readFileSync(path.join(ROOT, file)), { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    }
    if (pathname === '/api/health' && req.method === 'GET') {
      return send(res, 200, { ok: true, virustotal: !!VT_KEY, database: db.kind });
    }
    if (pathname === '/api/stats' && req.method === 'GET') return send(res, 200, db.stats());
    if (pathname === '/api/reports' && req.method === 'POST') return await handleCreateReport(req, res);
    if (pathname === '/api/reports' && req.method === 'GET') return handleListReports(req, res, url);
    if (pathname === '/api/scan' && req.method === 'POST') return await handleScanUpload(req, res);
    const poll = pathname.match(/^\/api\/scan\/([^/]+)$/);
    if (poll && req.method === 'GET') return await handleScanPoll(req, res, decodeURIComponent(poll[1]));
    if (pathname.startsWith('/api/')) return send(res, 404, { error: 'Không có API này.' });
    return send(res, 404, Buffer.from('Không tìm thấy trang.'), { 'Content-Type': 'text/plain; charset=utf-8' });
  } catch (err) {
    if (err instanceof VtError) return send(res, err.status, { error: err.message });
    console.error('[server]', err);
    if (!res.headersSent) send(res, 500, { error: 'Máy chủ gặp lỗi khi xử lý yêu cầu. Hãy thử lại.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Lá Chắn Số đang chạy tại http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`  Cơ sở dữ liệu: ${db.kind === 'sqlite' ? 'SQLite' : 'JSON'} (${DATA_DIR})`);
  console.log(`  VirusTotal: ${VT_KEY ? 'đã có khoá API' : 'CHƯA có khoá – quét tệp chạy ở chế độ demo'}`);
});
