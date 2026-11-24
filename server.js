/* =============================================================
   LÁ CHẮN SỐ – Máy chủ API (Node.js ≥ 18, không cần cài thư viện)

   Chạy:   npm start        (hoặc: node server.js)
   Mở:     http://localhost:3000

   - Phục vụ index.html / style.css / script.js
   - POST   /api/scan            Nhận tệp (≤ 32 MB) → tra cứu / gửi lên VirusTotal
   - GET    /api/scan/:id        Hỏi kết quả phân tích VirusTotal
   - POST   /api/reports         Lưu báo cáo (người thân / cán bộ / máy chủ)
   - GET    /api/reports         Danh sách báo cáo để kiểm tra, kiểm duyệt
   - PATCH  /api/reports/:id     Cán bộ kiểm duyệt báo cáo (duyệt / bỏ qua)
   - GET    /api/watchlist       Danh sách cảnh báo tổng hợp (SĐT, web, mã file độc, STK)
   - GET    /api/lookup?q=...    Đối chiếu nhanh nội dung với danh sách cảnh báo
   - GET    /api/stats           Thống kê tổng hợp
   - GET    /api/health          Trạng thái máy chủ
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
const MAX_UPLOAD = 32 * 1024 * 1024;
const MAX_JSON = 24 * 1024;

const TYPE_MAP = {
  phone: 'phone',
  call: 'phone',
  web: 'web',
  link: 'web',
  malware: 'malware',
  file: 'malware',
  bank: 'bank',
  sms: 'sms'
};
const RISK_LEVELS = ['danger', 'warning', 'safe'];
const REVIEW_STATUSES = ['pending', 'verified', 'dismissed'];
const VALID_CHANNELS = ['server', 'officer', 'family'];

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

/* Dữ liệu khởi tạo mẫu tại Đồng Nai khi cơ sở dữ liệu mới tinh */
const SEED_REPORTS = [
  {
    code: 'DN-2311-0101',
    type: 'phone',
    target_value: '0916882341',
    content: 'Đối tượng tự xưng cán bộ Công an tỉnh Đồng Nai gọi từ số 0916 882 341 thông báo tài khoản liên quan đường dây rửa tiền, yêu cầu chuyển gấp 35 triệu đồng vào tài khoản tạm giữ và cấm báo cho người nhà.',
    channels: ['server', 'officer'],
    ward: 'Phường Tam Hiệp',
    forward_police: 1,
    risk_level: 'danger',
    status: 'verified',
    report_count: 14,
    reviewer_note: 'Đã xác minh trùng khớp kịch bản giả danh cơ quan điều tra tại Biên Hòa.',
    created_at: '2026-11-23T08:30:00.000Z',
    reviewed_at: '2026-11-23T09:00:00.000Z'
  },
  {
    code: 'DN-2311-0102',
    type: 'web',
    target_value: 'dienluc-thanhtoan.top',
    content: 'Tin nhắn giả danh Điện lực Đồng Nai báo nợ tiền điện 2 tháng, đe doạ cắt điện trong 2 giờ tới và ép bấm vào trang web dienluc-thanhtoan.top để thanh toán trực tuyến.',
    channels: ['server', 'officer'],
    ward: 'Phường Tam Hiệp',
    forward_police: 1,
    risk_level: 'danger',
    status: 'verified',
    report_count: 9,
    reviewer_note: 'Tên miền giả mạo ngành điện, thu thập thông tin thẻ và chiếm quyền thiết bị.',
    created_at: '2026-11-23T10:15:00.000Z',
    reviewed_at: '2026-11-23T10:40:00.000Z'
  },
  {
    code: 'DN-2311-0103',
    type: 'malware',
    target_value: '9f2c4e81b7a05d36e1c8f4a2b9d07e53c6a18f20d4b97e6a3c5f81e02d9b7a46',
    file_name: 'nhan-qua-tri-an.apk',
    file_hash: '9f2c4e81b7a05d36e1c8f4a2b9d07e53c6a18f20d4b97e6a3c5f81e02d9b7a46',
    content: 'Tệp cài đặt Android nhan-qua-tri-an.apk gửi qua tin nhắn mạo danh chương trình tri ân khách hàng. Khi cài đặt đòi quyền Trợ năng (Accessibility) để tự động đọc mã OTP ngân hàng.',
    channels: ['server', 'officer'],
    ward: 'Phường Trấn Biên',
    forward_police: 1,
    risk_level: 'danger',
    status: 'verified',
    report_count: 7,
    reviewer_note: 'Mã độc Trojan-Banker.AndroidOS đã được xác nhận trên VirusTotal (38/66 công cụ).',
    created_at: '2026-11-23T13:20:00.000Z',
    reviewed_at: '2026-11-23T13:50:00.000Z'
  },
  {
    code: 'DN-2311-0104',
    type: 'bank',
    target_value: '190388492011',
    content: 'Chiếm đoạt tài khoản mạng xã hội của người quen rồi nhắn tin báo đang cấp cứu tại bệnh viện, yêu cầu chuyển gấp 10 triệu đồng vào STK lạ 190388492011 và từ chối nghe gọi video.',
    channels: ['server', 'officer', 'family'],
    ward: 'Phường Hố Nai',
    forward_police: 1,
    risk_level: 'danger',
    status: 'verified',
    report_count: 5,
    reviewer_note: 'Tài khoản nhận tiền trung gian đã bị nhiều người dân phản ánh.',
    created_at: '2026-11-23T15:05:00.000Z',
    reviewed_at: '2026-11-23T15:45:00.000Z'
  },
  {
    code: 'DN-2411-0105',
    type: 'phone',
    target_value: '0857441219',
    content: 'Số điện thoại lạ 0857 441 219 nhắn tin mời học sinh THPT làm cộng tác viên đặt đơn hàng online việc nhẹ lương cao 500.000đ/ngày, dẫn vào nhóm đóng tiền cọc nhận nhiệm vụ.',
    channels: ['server', 'officer'],
    ward: 'Phường Hố Nai',
    forward_police: 1,
    risk_level: 'warning',
    status: 'pending',
    report_count: 3,
    reviewer_note: '',
    created_at: '2026-11-24T01:10:00.000Z',
    reviewed_at: null
  },
  {
    code: 'DN-2411-0106',
    type: 'web',
    target_value: 'bit.ly/qua-tri-an-dn',
    content: 'Đường dẫn rút gọn bit.ly/qua-tri-an-dn thông báo trúng quà tri ân 2.000.000đ trong ngày, yêu cầu người cao tuổi điền số CCCD, số thẻ và mã OTP để nhận tiền thưởng.',
    channels: ['server', 'officer', 'family'],
    ward: 'Xã Long Thành',
    forward_police: 1,
    risk_level: 'danger',
    status: 'pending',
    report_count: 2,
    reviewer_note: '',
    created_at: '2026-11-24T02:25:00.000Z',
    reviewed_at: null
  },
  {
    code: 'DN-2411-0107',
    type: 'malware',
    target_value: '4a7d1ed414474e4033ac29ccb8653d9b8e12c34f9076a51b2c8e190fa34d2109',
    file_name: 'hoa-don-dien-tu-T11.scr',
    file_hash: '4a7d1ed414474e4033ac29ccb8653d9b8e12c34f9076a51b2c8e190fa34d2109',
    content: 'Tệp đính kèm hoa-don-dien-tu-T11.scr giả dạng file PDF hoá đơn điện tử gửi cho hộ kinh doanh tại Trảng Bom. Nghi ngờ chứa mã thực thi đánh cắp dữ liệu máy tính.',
    channels: ['server', 'officer'],
    ward: 'Xã Trảng Bom',
    forward_police: 0,
    risk_level: 'danger',
    status: 'pending',
    report_count: 1,
    reviewer_note: '',
    created_at: '2026-11-24T03:05:00.000Z',
    reviewed_at: null
  }
];

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

/* ---------- Chuẩn hoá định danh để tổng hợp danh sách cảnh báo ---------- */
function normalizeTarget(type, rawTarget, content, fileHash, fileName) {
  const src = String(rawTarget || '').trim();
  const body = String(content || '').trim();
  if (type === 'malware') {
    const h = String(fileHash || '').trim().toLowerCase();
    if (/^[a-f0-9]{32,64}$/.test(h)) return h;
    const matchHash = (src + ' ' + body).match(/\b[a-f0-9]{64}\b/i);
    if (matchHash) return matchHash[0].toLowerCase();
    return (src || String(fileName || '').trim() || body.slice(0, 80)).toLowerCase();
  }
  if (type === 'phone') {
    const digits = src.replace(/[\s.\-()]/g, '').replace(/^\+?84/, '0');
    if (/^0\d{8,10}$/.test(digits)) return digits;
    const m = body.match(/(?:\+?84|0)(?:[\s.\-]?\d){8,10}/);
    if (m) return m[0].replace(/[\s.\-()]/g, '').replace(/^\+?84/, '0');
    return src || body.slice(0, 40);
  }
  if (type === 'web') {
    const candidate = src || ((body.match(/(?:https?:\/\/|www\.|bit\.ly\/|[a-z0-9-]+\.(?:com|vn|net|top|xyz|info|link|online|site|org)\b)[^\s"<>]*/i) || [])[0] || '');
    return candidate.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '') || body.slice(0, 60).toLowerCase();
  }
  if (type === 'bank') {
    const digits = src.replace(/[\s.\-]/g, '');
    if (/^\d{8,19}$/.test(digits)) return digits;
    const m = body.match(/\b\d[\d\s]{7,20}\d\b/);
    if (m) {
      const clean = m[0].replace(/\s+/g, '');
      if (clean.length >= 8 && clean.length <= 19) return clean;
    }
    return src || body.slice(0, 40);
  }
  return src || body.slice(0, 60);
}

function parseChannels(val) {
  if (Array.isArray(val)) return val.filter((c) => VALID_CHANNELS.includes(c));
  if (typeof val === 'string') {
    try {
      const arr = JSON.parse(val);
      if (Array.isArray(arr)) return arr.filter((c) => VALID_CHANNELS.includes(c));
    } catch { /* bỏ qua */ }
  }
  return ['server'];
}

function serializeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    type: TYPE_MAP[row.type] || row.type,
    targetValue: row.target_value || '',
    fileName: row.file_name || '',
    fileHash: row.file_hash || '',
    content: row.content,
    channels: parseChannels(row.channels),
    ward: row.ward || 'Đồng Nai',
    forwardPolice: !!row.forward_police,
    riskLevel: row.risk_level || 'warning',
    status: row.status || 'pending',
    reportCount: Number(row.report_count) || 1,
    reviewerNote: row.reviewer_note || '',
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at
  };
}

function buildWatchlist(rows) {
  const groups = new Map();
  const rank = { danger: 3, warning: 2, safe: 1 };
  for (const raw of rows) {
    const r = serializeRow(raw);
    if (!r || r.status === 'dismissed') continue;
    const normKey = normalizeTarget(r.type, r.targetValue, r.content, r.fileHash, r.fileName);
    if (!normKey) continue;
    const mapKey = `${r.type}:${normKey}`;
    let g = groups.get(mapKey);
    if (!g) {
      g = {
        key: mapKey,
        type: r.type,
        targetValue: r.targetValue || normKey,
        normalizedTarget: normKey,
        fileName: r.fileName || '',
        fileHash: r.fileHash || '',
        summary: r.content,
        reportCount: 0,
        verified: false,
        status: 'pending',
        riskLevel: r.riskLevel || 'warning',
        ward: r.ward || 'Đồng Nai',
        latestAt: r.createdAt,
        reports: []
      };
      groups.set(mapKey, g);
    }
    g.reportCount += r.reportCount || 1;
    if (r.status === 'verified') {
      g.verified = true;
      g.status = 'verified';
      g.summary = r.content;
    }
    if ((rank[r.riskLevel] || 0) > (rank[g.riskLevel] || 0)) g.riskLevel = r.riskLevel;
    if (r.createdAt > g.latestAt) {
      g.latestAt = r.createdAt;
      if (r.ward) g.ward = r.ward;
    }
    if (!g.fileName && r.fileName) g.fileName = r.fileName;
    if (!g.fileHash && r.fileHash) g.fileHash = r.fileHash;
    g.reports.push({
      id: r.id,
      code: r.code,
      content: r.content,
      ward: r.ward,
      status: r.status,
      riskLevel: r.riskLevel,
      reviewerNote: r.reviewerNote,
      createdAt: r.createdAt
    });
  }

  const items = Array.from(groups.values()).sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
    return String(b.latestAt).localeCompare(String(a.latestAt));
  });

  const counts = { totalItems: items.length, totalReports: 0, phone: 0, web: 0, malware: 0, bank: 0, sms: 0 };
  for (const it of items) {
    counts.totalReports += it.reportCount;
    counts[it.type] = (counts[it.type] || 0) + 1;
  }
  return { items, counts };
}

function lookupWatchlist(rows, queryRaw) {
  const q = String(queryRaw || '').trim();
  if (!q) return { matched: false, matches: [] };
  const qLower = q.toLowerCase();
  const qCompact = qLower.replace(/[\s.\-()]/g, '').replace(/^\+?84/, '0');
  const { items } = buildWatchlist(rows);
  const matches = items.filter((it) => {
    const norm = String(it.normalizedTarget || '').toLowerCase();
    if (!norm || norm.length < 4) return false;
    if (it.type === 'phone' || it.type === 'bank') {
      const cleanNorm = norm.replace(/[\s.\-()]/g, '');
      return cleanNorm.length >= 8 && (qCompact.includes(cleanNorm) || cleanNorm === qCompact);
    }
    if (it.type === 'malware') {
      const fn = String(it.fileName || '').toLowerCase();
      return qLower.includes(norm) || (fn && fn.length >= 5 && qLower.includes(fn));
    }
    return qLower.includes(norm);
  });
  return { matched: matches.length > 0, matches };
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
        target_value      TEXT,
        file_name         TEXT,
        file_hash         TEXT,
        content           TEXT NOT NULL,
        channels          TEXT DEFAULT '["server"]',
        ward              TEXT DEFAULT 'Đồng Nai',
        forward_police    INTEGER NOT NULL DEFAULT 0,
        risk_level        TEXT,
        status            TEXT NOT NULL DEFAULT 'pending',
        report_count      INTEGER NOT NULL DEFAULT 1,
        reviewer_note     TEXT,
        reviewed_at       TEXT,
        queued_offline    INTEGER NOT NULL DEFAULT 0,
        client_created_at TEXT,
        created_at        TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reports_created ON reports (created_at);
    `);

    const extraCols = [
      "ALTER TABLE reports ADD COLUMN target_value TEXT",
      "ALTER TABLE reports ADD COLUMN file_name TEXT",
      "ALTER TABLE reports ADD COLUMN file_hash TEXT",
      "ALTER TABLE reports ADD COLUMN channels TEXT DEFAULT '[\"server\"]'",
      "ALTER TABLE reports ADD COLUMN ward TEXT DEFAULT 'Đồng Nai'",
      "ALTER TABLE reports ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'",
      "ALTER TABLE reports ADD COLUMN report_count INTEGER NOT NULL DEFAULT 1",
      "ALTER TABLE reports ADD COLUMN reviewer_note TEXT",
      "ALTER TABLE reports ADD COLUMN reviewed_at TEXT"
    ];
    for (const sql of extraCols) {
      try { db.exec(sql); } catch { /* cột đã tồn tại */ }
    }

    const countRow = db.prepare('SELECT COUNT(*) AS n FROM reports').get();
    if (!countRow || countRow.n === 0) {
      const seedStmt = db.prepare(`INSERT INTO reports
        (code, type, target_value, file_name, file_hash, content, channels, ward, forward_police, risk_level, status, report_count, reviewer_note, reviewed_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const s of SEED_REPORTS) {
        seedStmt.run(
          s.code, s.type, s.target_value || '', s.file_name || null, s.file_hash || null,
          s.content, JSON.stringify(s.channels || ['server']), s.ward || 'Đồng Nai',
          s.forward_police ? 1 : 0, s.risk_level || 'danger', s.status || 'pending',
          s.report_count || 1, s.reviewer_note || null, s.reviewed_at || null, s.created_at
        );
      }
    }

    const byClient = db.prepare('SELECT * FROM reports WHERE client_id = ?');
    const insert = db.prepare(`INSERT INTO reports
      (client_id, type, target_value, file_name, file_hash, content, channels, ward, forward_police, risk_level, status, report_count, queued_offline, client_created_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`);
    const setCode = db.prepare('UPDATE reports SET code = ? WHERE id = ?');
    const byId = db.prepare('SELECT * FROM reports WHERE id = ?');
    const updateReview = db.prepare(`UPDATE reports
      SET status = ?, reviewer_note = ?, risk_level = COALESCE(?, risk_level), reviewed_at = ?
      WHERE id = ?`);

    return {
      kind: 'sqlite',
      insert(r) {
        if (r.clientId) {
          const existing = byClient.get(r.clientId);
          if (existing) return { row: existing, duplicate: true };
        }
        const info = insert.run(
          r.clientId, r.type, r.targetValue, r.fileName, r.fileHash, r.content,
          JSON.stringify(r.channels), r.ward, r.forwardPolice ? 1 : 0, r.riskLevel,
          r.status || 'pending', r.queuedOffline ? 1 : 0, r.clientCreatedAt, new Date().toISOString()
        );
        const id = Number(info.lastInsertRowid);
        setCode.run(makeCode(id), id);
        return { row: byId.get(id), duplicate: false };
      },
      list(limit = 100) {
        return db.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT ?').all(limit);
      },
      all() {
        return db.prepare('SELECT * FROM reports ORDER BY id DESC').all();
      },
      getById(id) {
        return byId.get(id) || null;
      },
      review(id, { status, reviewerNote, riskLevel }) {
        const existing = byId.get(id);
        if (!existing) return null;
        updateReview.run(status, reviewerNote ?? existing.reviewer_note ?? '', riskLevel || null, new Date().toISOString(), id);
        return byId.get(id);
      },
      stats() {
        const rows = db.prepare('SELECT type, status, report_count FROM reports').all();
        return computeStats(rows);
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
    if (!rows.length) {
      rows = SEED_REPORTS.map((s, idx) => ({
        id: idx + 1,
        code: s.code,
        client_id: null,
        type: s.type,
        target_value: s.target_value || '',
        file_name: s.file_name || null,
        file_hash: s.file_hash || null,
        content: s.content,
        channels: JSON.stringify(s.channels || ['server']),
        ward: s.ward || 'Đồng Nai',
        forward_police: s.forward_police ? 1 : 0,
        risk_level: s.risk_level || 'danger',
        status: s.status || 'pending',
        report_count: s.report_count || 1,
        reviewer_note: s.reviewer_note || '',
        reviewed_at: s.reviewed_at || null,
        queued_offline: 0,
        client_created_at: null,
        created_at: s.created_at
      }));
      persist();
    }
    return {
      kind: 'json',
      insert(r) {
        if (r.clientId) {
          const existing = rows.find((x) => x.client_id === r.clientId);
          if (existing) return { row: existing, duplicate: true };
        }
        const id = rows.length ? rows[rows.length - 1].id + 1 : 1;
        const row = {
          id,
          code: makeCode(id),
          client_id: r.clientId,
          type: r.type,
          target_value: r.targetValue,
          file_name: r.fileName,
          file_hash: r.fileHash,
          content: r.content,
          channels: JSON.stringify(r.channels),
          ward: r.ward,
          forward_police: r.forwardPolice ? 1 : 0,
          risk_level: r.riskLevel,
          status: r.status || 'pending',
          report_count: 1,
          reviewer_note: '',
          reviewed_at: null,
          queued_offline: r.queuedOffline ? 1 : 0,
          client_created_at: r.clientCreatedAt,
          created_at: new Date().toISOString()
        };
        rows.push(row);
        persist();
        return { row, duplicate: false };
      },
      list(limit = 100) { return rows.slice(-limit).reverse(); },
      all() { return rows.slice().reverse(); },
      getById(id) { return rows.find((x) => x.id === id) || null; },
      review(id, { status, reviewerNote, riskLevel }) {
        const row = rows.find((x) => x.id === id);
        if (!row) return null;
        row.status = status;
        if (reviewerNote !== undefined) row.reviewer_note = reviewerNote;
        if (riskLevel) row.risk_level = riskLevel;
        row.reviewed_at = new Date().toISOString();
        persist();
        return row;
      },
      stats() { return computeStats(rows); }
    };
  }
}

function computeStats(rows) {
  const byType = {};
  let total = 0;
  let pending = 0;
  let verified = 0;
  for (const r of rows) {
    const t = TYPE_MAP[r.type] || r.type;
    const count = Number(r.report_count) || 1;
    if (r.status !== 'dismissed') {
      total += count;
      byType[t] = (byType[t] || 0) + count;
    }
    if (r.status === 'pending') pending += 1;
    if (r.status === 'verified') verified += 1;
  }
  return { total, records: rows.length, pending, verified, byType };
}

function makeCode(id) {
  const d = new Date();
  return `DN-${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}-${String(id + 100).padStart(4, '0')}`;
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

function checkAdminAuth(req, res) {
  if (!ADMIN_TOKEN) return true; // Chế độ prototype: cho phép cán bộ xem/kiểm duyệt trực tiếp khi chưa đặt ADMIN_TOKEN
  const given = Buffer.from(String(req.headers['x-admin-token'] || ''));
  const expected = Buffer.from(ADMIN_TOKEN);
  const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (!ok) {
    send(res, 401, { error: 'Cần mã quản trị hợp lệ (x-admin-token) để thực hiện thao tác này.' });
    return false;
  }
  return true;
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
  } catch {
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

  const form = new FormData();
  form.append('file', new Blob([buf]), name);
  const up = await vt('/files', { method: 'POST', body: form });
  const analysisId = up && up.data && up.data.id;
  if (!analysisId) throw new VtError(502, 'VirusTotal không trả về mã phân tích. Hãy thử lại.');
  pending.set(analysisId, { name, size: buf.length, sha256, at: Date.now() });
  return send(res, 202, { status: 'queued', analysisId, sha256 });
}

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

/* ---------- Báo cáo, Kiểm duyệt & Danh sách cảnh báo ---------- */
function validateReport(body) {
  if (!body || typeof body !== 'object') return 'Dữ liệu báo cáo không hợp lệ.';
  if (!TYPE_MAP[body.type]) return 'Hãy chọn loại báo cáo: số điện thoại, trang web, mã file độc, số tài khoản hoặc tin nhắn.';
  const hasTarget = typeof body.targetValue === 'string' && body.targetValue.trim().length > 0;
  const hasContent = typeof body.content === 'string' && body.content.trim().length > 0;
  if (!hasTarget && !hasContent) return 'Hãy nhập số điện thoại, trang web, mã file độc hoặc nội dung cần báo cáo.';
  if (body.content && String(body.content).length > 2000) return 'Nội dung báo cáo dài quá 2.000 ký tự. Hãy rút gọn lại.';
  if (body.targetValue && String(body.targetValue).length > 300) return 'Thông tin định danh quá dài.';
  if (body.riskLevel != null && !RISK_LEVELS.includes(body.riskLevel)) return 'Mức rủi ro không hợp lệ.';
  if (body.clientId != null && !/^[A-Za-z0-9-]{6,64}$/.test(String(body.clientId))) return 'Mã báo cáo không hợp lệ.';
  return null;
}

async function handleCreateReport(req, res) {
  if (rateLimited(req, 'report', 25, 60000)) return send(res, 429, { error: 'Bạn gửi quá nhiều báo cáo trong 1 phút. Hãy thử lại sau.' });
  let body;
  try {
    body = JSON.parse((await readBody(req, MAX_JSON)).toString('utf8') || '{}');
  } catch (err) {
    if (err.status === 413) return send(res, 413, { error: 'Báo cáo quá lớn.' });
    return send(res, 400, { error: 'Dữ liệu gửi lên không đúng định dạng JSON.' });
  }
  const problem = validateReport(body);
  if (problem) return send(res, 400, { error: problem });

  const normType = TYPE_MAP[body.type];
  const fileName = body.fileName ? String(body.fileName).trim().slice(0, 120) : null;
  const fileHash = body.fileHash ? String(body.fileHash).trim().toLowerCase().slice(0, 128) : null;
  const rawContent = String(body.content || '').trim();
  const rawTarget = String(body.targetValue || '').trim();
  const targetValue = rawTarget || normalizeTarget(normType, rawTarget, rawContent, fileHash, fileName);
  const content = rawContent || `Báo cáo ${normType}: ${targetValue}`;
  const channels = parseChannels(body.channels);
  if (!channels.length) channels.push('server');
  const ward = body.ward ? String(body.ward).trim().slice(0, 80) : 'Đồng Nai';
  const forwardPolice = !!body.forwardPolice || channels.includes('officer');

  const clientCreatedAt = typeof body.clientCreatedAt === 'string' && !Number.isNaN(Date.parse(body.clientCreatedAt))
    ? new Date(body.clientCreatedAt).toISOString() : null;

  const { row, duplicate } = db.insert({
    clientId: body.clientId ? String(body.clientId) : null,
    type: normType,
    targetValue: targetValue.slice(0, 300),
    fileName,
    fileHash,
    content: content.slice(0, 2000),
    channels,
    ward,
    forwardPolice,
    riskLevel: body.riskLevel || 'danger',
    status: 'pending',
    queuedOffline: !!body.queuedOffline,
    clientCreatedAt
  });

  const serialized = serializeRow(row);
  return send(res, duplicate ? 200 : 201, {
    id: serialized.id,
    code: serialized.code,
    createdAt: serialized.createdAt,
    report: serialized,
    duplicate
  });
}

function handleListReports(req, res, url) {
  if (!checkAdminAuth(req, res)) return;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 80));
  const statusFilter = url.searchParams.get('status');
  let items = db.list(limit).map(serializeRow);
  if (statusFilter && REVIEW_STATUSES.includes(statusFilter)) {
    items = items.filter((r) => r.status === statusFilter);
  }
  return send(res, 200, { items, ...db.stats() });
}

async function handleReviewReport(req, res, idStr) {
  if (!checkAdminAuth(req, res)) return;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return send(res, 400, { error: 'Mã báo cáo không hợp lệ.' });

  let body;
  try {
    body = JSON.parse((await readBody(req, MAX_JSON)).toString('utf8') || '{}');
  } catch {
    return send(res, 400, { error: 'Dữ liệu kiểm duyệt không đúng JSON.' });
  }
  if (!REVIEW_STATUSES.includes(body.status)) {
    return send(res, 400, { error: 'Trạng thái kiểm duyệt phải là pending, verified hoặc dismissed.' });
  }
  if (body.riskLevel != null && !RISK_LEVELS.includes(body.riskLevel)) {
    return send(res, 400, { error: 'Mức rủi ro không hợp lệ.' });
  }
  const reviewerNote = typeof body.reviewerNote === 'string' ? body.reviewerNote.trim().slice(0, 500) : undefined;
  const updated = db.review(id, { status: body.status, reviewerNote, riskLevel: body.riskLevel });
  if (!updated) return send(res, 404, { error: 'Không tìm thấy báo cáo này.' });

  return send(res, 200, {
    report: serializeRow(updated),
    stats: db.stats(),
    watchlist: buildWatchlist(db.all())
  });
}

function handleWatchlist(req, res, url) {
  const type = url.searchParams.get('type');
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const wl = buildWatchlist(db.all());
  let items = wl.items;
  if (type && TYPE_MAP[type]) {
    const t = TYPE_MAP[type];
    items = items.filter((it) => it.type === t);
  }
  if (q) {
    items = items.filter((it) =>
      it.targetValue.toLowerCase().includes(q) ||
      it.summary.toLowerCase().includes(q) ||
      (it.fileName && it.fileName.toLowerCase().includes(q)) ||
      (it.ward && it.ward.toLowerCase().includes(q))
    );
  }
  return send(res, 200, { items, counts: wl.counts });
}

function handleLookup(req, res, url) {
  const q = url.searchParams.get('q') || '';
  return send(res, 200, lookupWatchlist(db.all(), q));
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
    if (pathname === '/api/watchlist' && req.method === 'GET') return handleWatchlist(req, res, url);
    if (pathname === '/api/lookup' && req.method === 'GET') return handleLookup(req, res, url);
    if (pathname === '/api/reports' && req.method === 'POST') return await handleCreateReport(req, res);
    if (pathname === '/api/reports' && req.method === 'GET') return handleListReports(req, res, url);

    const reviewMatch = pathname.match(/^\/api\/reports\/(\d+)$/);
    if (reviewMatch && (req.method === 'PATCH' || req.method === 'POST')) {
      return await handleReviewReport(req, res, reviewMatch[1]);
    }

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
