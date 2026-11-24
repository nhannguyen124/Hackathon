/* =============================================================
   LÁ CHẮN SỐ – Clickable Prototype (v1.1)
   - Nội dung kiểm tra văn bản, bài học, quiz, dashboard: dữ liệu giả lập.
   - Quét tệp (VirusTotal) và lưu báo cáo: gọi máy chủ thật trong server.js
     khi trang được mở qua `npm start`. Khi mở trực tiếp file index.html,
     ứng dụng tự chuyển sang chế độ demo và ghi rõ trên giao diện.
   ============================================================= */
(() => {
  'use strict';

  /* ---------- 1. HELPERS ---------- */
  const $ = (root, ref) => root.querySelector(`[data-ref="${ref}"]`);
  const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));
  const icon = (id, cls = '') => `<svg class="ic ${cls}"><use href="#${id}"/></svg>`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  const isMobile = () => window.matchMedia('(max-width: 860px)').matches;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* bộ nhớ bị chặn: bỏ qua */ }
    }
  };

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  }

  /* Số điện thoại Việt Nam */
  const normalizePhone = (raw) => raw.replace(/[\s.\-()]/g, '').replace(/^\+?84/, '0');
  const isValidPhone = (p) => /^0(3|5|7|8|9)\d{8}$/.test(p) || /^02\d{9}$/.test(p);
  const formatPhone = (p) => (p.length === 10 ? `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}` : `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}`);
  const maskPhone = (p) => `${p.slice(0, 4)} •••${p.slice(-3)}`;
  function initials(name) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[words.length - 2][0] + words[words.length - 1][0]).toUpperCase();
  }

  async function fetchJSON(url, opts = {}, timeout = 10000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const init = { ...opts, signal: ctrl.signal };
      if (opts.json !== undefined) {
        init.body = JSON.stringify(opts.json);
        init.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
        delete init.json;
      }
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || `Máy chủ trả lỗi ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function sha256Hex(file) {
    if (!(window.crypto && crypto.subtle)) return null;
    const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- 2. DỮ LIỆU GIẢ LẬP ---------- */
  const SCREENS = {
    home:      { code: '01_TrangChu',   title: 'Trang chủ & Kiểm tra nhanh', tab: 'check' },
    result:    { code: '02_KetQua',     title: 'Kết quả kiểm tra',           tab: 'check' },
    report:    { code: '04_BaoCao',     title: 'Gửi báo cáo',                tab: 'report' },
    learn:     { code: '05_BaiHoc',     title: 'Bài học 01 phút',            tab: 'learn' },
    quiz:      { code: '06_ThiThu',     title: 'Thi thử (trong Bài học)',    tab: 'learn' },
    volunteer: { code: '07_TinhNguyen', title: 'Dashboard Đội tình nguyện',  tab: 'volunteer' },
    settings:  { code: '08_CaiDat',     title: 'Cài đặt',                    tab: null }
  };
  const SCREEN_ORDER = ['home', 'result', 'report', 'learn', 'quiz', 'volunteer', 'settings'];

  const SAMPLES = {
    police: {
      level: 'danger',
      text: 'Tôi là cán bộ Công an tỉnh Đồng Nai. Tài khoản của bà liên quan đến đường dây rửa tiền, yêu cầu chuyển tiền gấp vào tài khoản tạm giữ 0123 4567 89 để xác minh, không được báo cho người nhà.'
    },
    gift: {
      level: 'warning',
      text: 'Chúc mừng quý khách nhận quà tri ân 2.000.000đ từ chương trình khách hàng thân thiết. Bấm vào đường dẫn để nhận ngay trong hôm nay: bit.ly/qua-tri-an-dn'
    },
    safe: { level: 'safe', text: '0912 345 678' }
  };
  const SAMPLE_BY_LEVEL = { danger: SAMPLES.police, warning: SAMPLES.gift, safe: SAMPLES.safe };
  const VOICE_TRANSCRIPT = 'Có người tự xưng công an gọi bảo tôi chuyển tiền gấp để xác minh tài khoản, không được nói với ai.';

  const RESULTS = {
    danger: {
      icon: 'i-shield-alert', badge: 'Nguy hiểm',
      title: 'Có dấu hiệu lừa đảo rõ rệt',
      sub: 'Dừng lại ngay – không chuyển tiền, không đọc mã OTP.',
      conf: 'Độ tin cậy 96%',
      reasons: [
        'Có dấu hiệu <mark>giả danh công an</mark>. Công an không làm việc, không yêu cầu chuyển tiền qua điện thoại hay tin nhắn.',
        'Thúc ép tâm lý bằng cụm từ <mark>chuyển tiền gấp</mark> và <mark>tài khoản tạm giữ</mark>.',
        'Yêu cầu <mark>không báo cho người nhà</mark> để cô lập nạn nhân. Số tài khoản đã bị báo cáo <strong>12 lần</strong> tại Đồng Nai.'
      ]
    },
    warning: {
      icon: 'i-shield-question', badge: 'Nghi ngờ',
      title: 'Cần xác minh trước khi bấm',
      sub: 'Chưa bấm vào đường dẫn, chưa nhập thông tin cá nhân.',
      conf: 'Độ tin cậy 81%',
      reasons: [
        '<mark>Đường dẫn rút gọn</mark> che giấu địa chỉ thật, không phải tên miền chính thức của cơ quan hay ngân hàng.',
        'Lời mời <mark>nhận quà tri ân</mark> kèm hạn chót <mark>ngay trong hôm nay</mark> để hối thúc bạn bấm.',
        'Chưa có trong danh sách báo cáo. Hãy <strong>hỏi người thân</strong> trước khi mở đường dẫn.'
      ]
    },
    safe: {
      icon: 'i-shield-check', badge: 'An toàn',
      title: 'Chưa phát hiện dấu hiệu bất thường',
      sub: 'Vẫn giữ cảnh giác nếu bị hối thúc chuyển tiền.',
      conf: 'Độ tin cậy 92%',
      reasons: [
        'Không nằm trong <strong>danh sách báo cáo lừa đảo</strong> tại Đồng Nai và toàn quốc.',
        'Không phát hiện đường dẫn độc hại hay từ khoá thúc ép chuyển tiền.',
        'Nếu được yêu cầu <mark>chuyển tiền</mark> hoặc <mark>đọc mã OTP</mark>, hãy dừng lại và hỏi người thân.'
      ]
    }
  };

  const LESSONS = [
    {
      icon: 'i-shield-alert', tone: 't-danger', tag: 'Phổ biến nhất tại Đồng Nai',
      title: 'Giả danh Công an yêu cầu chuyển tiền',
      quote: '“Tài khoản của bạn liên quan đến vụ án rửa tiền. Chuyển tiền vào tài khoản tạm giữ để xác minh.”',
      steps: [
        ['Cúp máy ngay', 'Công an không làm việc, không đòi tiền qua điện thoại.'],
        ['Không chuyển tiền, không đọc OTP', 'Dù bị doạ bắt giữ hay “phối hợp điều tra”.'],
        ['Gọi người thân hoặc 113', 'Sau đó báo cáo số điện thoại trên Lá Chắn Số.']
      ]
    },
    {
      icon: 'i-gift', tone: 't-warning', tag: 'Tăng mạnh dịp cuối năm',
      title: 'Đường dẫn nhận quà tri ân',
      quote: '“Quý khách được tặng quà tri ân 2 triệu đồng. Bấm vào link để nhận trước 24 giờ.”',
      steps: [
        ['Không bấm vào đường dẫn lạ', 'Link rút gọn thường dẫn tới trang giả mạo ngân hàng.'],
        ['Không nhập mật khẩu, mã OTP', 'Ngân hàng không bao giờ hỏi mã OTP của bạn.'],
        ['Dán link vào Lá Chắn Số', 'Kiểm tra trước khi mở, chỉ mất 3 giây.']
      ]
    },
    {
      icon: 'i-briefcase', tone: 't-blue', tag: 'Nhắm vào học sinh, nội trợ',
      title: 'Tuyển CTV đặt đơn hàng online',
      quote: '“Việc nhẹ lương cao, làm tại nhà, hoàn tiền 10–30% cho mỗi đơn hàng.”',
      steps: [
        ['Không nộp tiền để “nhận việc”', 'Việc thật không bắt bạn ứng tiền trước.'],
        ['Cảnh giác khoản thưởng đầu tiên', 'Đó là mồi để bạn nạp số tiền lớn hơn.'],
        ['Chặn và báo cáo', 'Gửi kèm ảnh chụp tin nhắn qua mục Báo cáo.']
      ]
    },
    {
      icon: 'i-heart-pulse', tone: 't-sos', tag: 'Đánh vào tâm lý hoảng loạn',
      title: 'Người thân gặp tai nạn cần tiền gấp',
      quote: '“Con chị bị tai nạn đang cấp cứu, cần chuyển gấp 50 triệu để mổ ngay.”',
      steps: [
        ['Bình tĩnh, gọi trực tiếp người thân', 'Gọi số quen thuộc, không gọi số lạ đưa ra.'],
        ['Gọi bệnh viện qua số chính thức', 'Bệnh viện không yêu cầu chuyển khoản cá nhân.'],
        ['Không chuyển khi chưa xác minh', 'Bấm nút cam “Hỏi người thân” để được giúp.']
      ]
    }
  ];

  const QUIZ = [
    {
      sender: '+84 857 ••• 219', sub: 'Không có trong danh bạ', avatar: '?', contact: false, time: 'Hôm nay 08:15',
      text: 'Chào bạn! Bên mình đang tuyển CTV [[việc nhẹ lương cao]], làm tại nhà 1–2 giờ/ngày, thu nhập [[500k/ngày]], [[nhận lương ngay trong ngày]]. Đăng ký tại: [[bit.ly/viec-nhe-500k]]',
      answer: 'scam',
      explain: 'Đây là chiêu <b>tuyển CTV việc nhẹ lương cao</b>. Các chi tiết bẫy:',
      points: ['Hứa hẹn công việc nhẹ nhàng bất thường', 'Thu nhập cao vô lý so với 1–2 giờ làm', 'Trả lương ngay để tạo lòng tin, sau đó bắt nạp tiền', 'Đường dẫn rút gọn che giấu trang đích']
    },
    {
      sender: 'NH-ThongBao', sub: 'Tên thương hiệu đã xác thực', avatar: 'NH', contact: true, time: 'Hôm nay 09:02',
      text: 'Ma OTP cua Quy khach la 482913, hieu luc trong 3 phut. [[Tuyet doi KHONG cung cap ma OTP cho bat ky ai]], ke ca nhan vien ngan hang.',
      answer: 'safe',
      explain: 'Tin OTP chuẩn: gửi từ tên thương hiệu, <b>không chứa đường dẫn</b> và nhắc bạn không chia sẻ mã. Chỉ an toàn khi chính bạn vừa thực hiện giao dịch.',
      points: []
    },
    {
      sender: '+84 789 ••• 031', sub: 'Không có trong danh bạ', avatar: '?', contact: false, time: 'Hôm qua 19:40',
      text: 'THONG BAO: Ho gia dinh no tien dien 2 thang, [[se bi cat dien trong 2 gio toi]]. Vui long [[thanh toan ngay qua duong dan]] [[dienluc-thanhtoan.top]] de tranh gian doan.',
      answer: 'scam',
      explain: '<b>Giả danh điện lực</b> để lấy tiền và thông tin thẻ:',
      points: ['Doạ cắt điện gấp để bạn mất bình tĩnh', 'Điện lực không thu tiền qua đường dẫn lạ', 'Tên miền “.top” không phải trang chính thức']
    },
    {
      sender: 'Hoàng Nam', sub: 'Con trai · Trong danh bạ', avatar: 'HN', contact: true, time: 'Hôm nay 17:26',
      text: 'Mẹ ơi tối nay con về muộn một chút, mẹ cứ ăn cơm trước nhé. [[Con gọi lại mẹ sau 8 giờ]] ạ.',
      answer: 'safe',
      explain: 'Tin từ số <b>đã lưu trong danh bạ</b>, nội dung đời thường, không yêu cầu tiền hay mã OTP.',
      points: []
    },
    {
      sender: 'Thu Hà', sub: 'Bạn bè · Mạng xã hội', avatar: 'TH', contact: true, time: 'Hôm nay 21:08',
      text: 'Hà đây, cho mình [[mượn gấp 5 triệu]] nhé, mình [[đang kẹt ở bệnh viện]]. [[Chuyển vào STK mới này]] giúp mình: 1903 •••• 7788. [[Đừng gọi]] vì mình không nghe máy được.',
      answer: 'scam',
      explain: 'Tài khoản bạn bè có thể đã <b>bị chiếm đoạt</b>. Dấu hiệu:',
      points: ['Vay tiền gấp bất thường', 'Kể hoàn cảnh khẩn cấp để bạn mủi lòng', 'Số tài khoản lạ, không phải tên người quen', 'Né tránh gọi điện xác minh']
    }
  ];

  /* Bảng màu phân loại (thứ tự cố định, đã kiểm tra CVD) */
  const CHART = [
    { name: 'Đường dẫn giả mạo', value: 35, color: '#2A78D6' },
    { name: 'Giả danh Công an', value: 25, color: '#EB6834' },
    { name: 'Tuyển CTV online', value: 20, color: '#1BAF7A' },
    { name: 'Người thân gặp nạn', value: 12, color: '#EDA100' },
    { name: 'Khác', value: 8, color: '#94A3B8' }
  ];

  /* Người thân mặc định */
  const DEFAULT_FAMILY = [
    { id: 'f-minh-anh', name: 'Minh Anh', rel: 'Con gái', phone: '0908123214', color: 1 },
    { id: 'f-hoang-nam', name: 'Hoàng Nam', rel: 'Con trai', phone: '0977450586', color: 2 }
  ];
  const MAX_FAMILY = 5;
  const DEFAULT_SETTINGS = { background: true, calls: true, links: true, files: false, autoRead: false };

  /* Quét tệp */
  const MAX_FILE_BYTES = 32 * 1024 * 1024;
  const RISKY_EXT = ['apk', 'exe', 'scr', 'bat', 'cmd', 'js', 'vbs', 'msi', 'jar', 'ps1', 'dll'];
  const ARCHIVE_EXT = ['zip', 'rar', '7z', 'docm', 'xlsm', 'pptm', 'iso'];
  const FILE_TEXT = {
    danger:  { title: 'Tệp chứa mã độc', sub: 'Không mở, không cài đặt. Xoá tệp này ngay.' },
    warning: { title: 'Tệp có dấu hiệu đáng ngờ', sub: 'Một vài công cụ cảnh báo. Chưa mở khi chưa xác minh.' },
    safe:    { title: 'Chưa phát hiện mã độc', sub: 'Vẫn chỉ mở tệp từ người gửi bạn tin tưởng.' }
  };
  const DEMO_FILE_RESULT = {
    name: 'nhan-qua-tri-an.apk', size: 2516582, typeDesc: 'Ứng dụng Android',
    sha256: '9f2c4e81b7a05d36e1c8f4a2b9d07e53c6a18f20d4b97e6a3c5f81e02d9b7a46',
    level: 'danger', live: false, permalink: null,
    stats: { malicious: 38, suspicious: 2, harmless: 0, undetected: 26 },
    detections: [
      { engine: 'Công cụ #1', result: 'Trojan-Banker.AndroidOS' },
      { engine: 'Công cụ #2', result: 'Android/Spy.Banker' },
      { engine: 'Công cụ #3', result: 'APK:RepMalware [Trj]' },
      { engine: 'Công cụ #4', result: 'Android.Trojan.SmsSpy' }
    ]
  };

  /* Loại báo cáo */
  const REPORT_TYPES = {
    phone: { label: 'Số điện thoại', input: 'Số điện thoại lừa đảo', placeholder: '0912 345 678', mode: 'tel', icon: 'i-phone' },
    link:  { label: 'Trang web', input: 'Đường dẫn trang web giả mạo', placeholder: 'bit.ly/abc hoặc trang-gia.top', mode: 'url', icon: 'i-link' },
    file:  { label: 'Tệp độc hại', input: 'Mã SHA-256 của tệp', placeholder: 'Bấm “Chọn tệp” để lấy mã', mode: 'text', icon: 'i-file-search' },
    bank:  { label: 'Số tài khoản', input: 'Số tài khoản nhận tiền lừa', placeholder: '0123 4567 89', mode: 'numeric', icon: 'i-landmark' },
    call:  { label: 'Cuộc gọi', icon: 'i-phone' },
    sms:   { label: 'Tin nhắn', icon: 'i-message' }
  };
  const URL_IN_TEXT = /(https?:\/\/\S+|www\.\S+|bit\.ly\/\S+|\b[a-z0-9-]+\.(?:com|vn|net|top|xyz|info|link|online|site)\b\S*)/i;
  const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();

  /* Bản demo (không có máy chủ): danh sách cảnh báo & hàng chờ duyệt mẫu */
  const MOCK_WARNINGS = [
    { key: '0123456789', approved: 12, pending: 2, lastAt: hoursAgo(2) },
    { key: 'bit.ly/qua-tri-an-dn', approved: 5, pending: 1, lastAt: hoursAgo(5) },
    { key: DEMO_FILE_RESULT.sha256, approved: 7, pending: 0, lastAt: hoursAgo(26) }
  ];
  const MOCK_PENDING = [
    { id: 'd1', code: 'DN-2411-0131', type: 'phone', target: '0857 219 446', created_at: hoursAgo(0.3),
      content: 'Gọi tự xưng cán bộ điện lực, nói nhà tôi nợ tiền điện 2 tháng, đòi chuyển khoản ngay kẻo cắt điện trong 2 giờ.',
      recipients: { server: true, officials: true, family: 0 } },
    { id: 'd2', code: 'DN-2411-0129', type: 'link', target: 'dichvucong-hotro.top', created_at: hoursAgo(1.5),
      content: 'Tin nhắn mời nhận trợ cấp qua cổng dịch vụ công, bấm link thì bắt nhập số thẻ ngân hàng và mã OTP.',
      recipients: { server: true, officials: false, family: 2 } },
    { id: 'd3', code: 'DN-2411-0127', type: 'file', target: '4d1f0c9a7be3e2618f5a0b74c9d2e86a1f3b5c7d9e0a2b4c6d8e0f1a3b5c7d9e', created_at: hoursAgo(4),
      content: 'Tệp “VNeID-capnhat.apk” gửi qua mạng xã hội, cài vào thì máy bị điều khiển từ xa.',
      recipients: { server: true, officials: true, family: 0 } }
  ];

  /* ---------- 3. TRẠNG THÁI ---------- */
  const state = {
    screen: 'home',
    prevScreen: 'home',
    senior: false,
    offline: false,
    level: 'danger',
    resultKind: 'text',
    fileResult: null,
    checkedText: SAMPLES.police.text,
    reportPrefill: '',
    family: store.get('lcs.family', DEFAULT_FAMILY),
    familyStash: null,
    emptyOverride: false,
    settings: { ...DEFAULT_SETTINGS, ...store.get('lcs.settings', {}) },
    queue: store.get('lcs.queue', []),
    sheetOpen: false,
    contactEditId: null,
    contactFrom: null,
    contactRel: null,
    deleteArmed: false,
    file: null,
    scanToken: null,
    reportType: null,
    recipients: { server: true, officials: true, family: false },
    lesson: 0,
    learned: new Set(),
    quizIndex: 0,
    quizScore: 0,
    quizAnswered: false,
    sampleCursor: 0,
    gallery: false
  };
  if (!Array.isArray(state.family)) state.family = DEFAULT_FAMILY.slice();

  /* Kết nối máy chủ (server.js) */
  const api = { checked: false, online: false, vt: false, db: null };

  const timers = { mic: null, typing: null, listen: null, check: null, disarm: null };

  /* ---------- 4. DOM ---------- */
  const workspace = document.getElementById('workspace');
  const inspector = document.getElementById('inspector');
  const stage = document.getElementById('stage');
  const deviceWrap = document.getElementById('deviceWrap');
  const device = document.getElementById('device');
  const gallery = document.getElementById('gallery');
  const galleryGrid = document.getElementById('galleryGrid');
  const galleryMeta = document.getElementById('galleryMeta');
  const stageCode = document.getElementById('stageCode');
  const stageTitle = document.getElementById('stageTitle');

  const ui = {
    viewport: $(device, 'viewport'),
    omni: $(device, 'omni'),
    omniInput: $(device, 'omniInput'),
    fileInput: $(device, 'fileInput'),
    checkBtn: $(device, 'checkBtn'),
    listen: $(device, 'listen'),
    listenBar: $(device, 'listenBar'),
    sheetLayer: $(device, 'sheetLayer'),
    sheet: $(device, 'sheet'),
    toastHost: $(device, 'toastHost'),
    reportText: $(device, 'reportText'),
    exportBtn: $(device, 'exportBtn'),
    reportTarget: $(device, 'reportTarget'),
    reportFileInput: $(device, 'reportFileInput'),
    contactForm: $(device, 'contactForm'),
    contactName: $(device, 'contactName'),
    contactPhone: $(device, 'contactPhone')
  };

  /* ---------- 5. PHÂN TÍCH GIẢ LẬP & KIỂM TRA ĐỊNH DẠNG ---------- */
  const URL_RE = /(https?:\/\/|www\.|bit\.ly|[a-z0-9-]+\.(com|vn|net|top|xyz|info|link|online|site)\b)/i;

  function detectType(text) {
    const compact = text.replace(/[\s.\-+()]/g, '');
    if (URL_RE.test(text) && text.length < 60) return { label: 'Đường dẫn', icon: 'i-link' };
    if (/^\d+$/.test(compact)) {
      if (/^(0|84)\d{9,10}$/.test(compact)) return { label: 'Số điện thoại', icon: 'i-phone' };
      return { label: 'Số tài khoản', icon: 'i-landmark' };
    }
    return { label: 'Tin nhắn', icon: 'i-message' };
  }

  function validate(raw) {
    const text = raw.trim();
    if (!text) {
      return 'Bạn chưa nhập nội dung. Hãy dán tin nhắn, số điện thoại (10 số), đường dẫn – hoặc bấm “Quét tệp” để kiểm tra tệp.';
    }
    const compact = text.replace(/[\s.\-+()]/g, '');
    if (/^\d+$/.test(compact)) {
      if (compact.length < 9) {
        return `Số “${esc(text)}” chưa đúng định dạng. Số điện thoại cần đủ 10 chữ số, bắt đầu bằng 0 (VD: 0912 345 678); số tài khoản từ 9–19 chữ số.`;
      }
      if (compact.length > 19) {
        return 'Dãy số quá dài. Vui lòng kiểm tra lại: số tài khoản ngân hàng chỉ gồm 9–19 chữ số.';
      }
      return null;
    }
    if (text.length < 8 && !URL_RE.test(text)) {
      return 'Nội dung quá ngắn để phân tích. Hãy dán nguyên văn tin nhắn hoặc đường dẫn (VD: bit.ly/abc123).';
    }
    return null;
  }

  function validateFile(file) {
    if (!file) return 'Chưa chọn tệp nào.';
    if (file.size === 0) return `Tệp “${esc(file.name)}” trống (0 byte). Hãy chọn tệp khác.`;
    if (file.size > MAX_FILE_BYTES) return `Tệp “${esc(file.name)}” nặng ${formatSize(file.size)}, vượt giới hạn 32 MB. Hãy chọn tệp nhỏ hơn.`;
    return null;
  }

  function analyze(raw) {
    const t = raw.toLowerCase();
    const danger = ['công an', 'tạm giữ', 'rửa tiền', 'chuyển tiền', 'chuyển gấp', 'otp', 'bắt giữ', 'điều tra', 'viện kiểm sát', 'tòa án', 'cấp cứu'];
    const warning = ['http', 'bit.ly', '.top', '.xyz', 'link', 'đường dẫn', 'quà', 'tri ân', 'trúng thưởng', 'nhận thưởng', 'việc nhẹ', 'ctv', 'hoàn tiền'];
    if (danger.some((k) => t.includes(k))) return 'danger';
    if (warning.some((k) => t.includes(k))) return 'warning';
    return 'safe';
  }

  function relTime(iso) {
    const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (!iso || Number.isNaN(m)) return 'không rõ thời gian';
    if (m < 1) return 'vừa xong';
    if (m < 60) return `${m} phút trước`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h} giờ trước` : `${Math.round(h / 24)} ngày trước`;
  }

  function validateTarget(type, raw) {
    const v = raw.trim();
    if (!v) return `Nhập ${REPORT_TYPES[type].input.toLowerCase()}.`;
    const digits = v.replace(/[\s.\-()]/g, '');
    if (type === 'phone' && !/^\+?\d{8,15}$/.test(digits)) return 'Số điện thoại cần 8–15 chữ số (VD: 0912 345 678).';
    if (type === 'bank' && !/^\d{6,19}$/.test(digits)) return 'Số tài khoản chỉ gồm 6–19 chữ số.';
    if (type === 'link' && !/^(https?:\/\/)?[^\s/]+\.[^\s]{2,}$/i.test(v)) return 'Đường dẫn chưa đúng. VD: bit.ly/abc hoặc https://trang-gia.top';
    if (type === 'file' && !/^([a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i.test(v)) return 'Mã tệp cần là chuỗi SHA-256 (64 ký tự). Bấm “Chọn tệp” để lấy mã tự động.';
    return null;
  }

  /* Các giá trị có thể tra trong danh sách cảnh báo: cả nội dung ngắn, mọi đường dẫn và dãy số trong tin nhắn */
  function lookupCandidates(text) {
    const t = text.trim();
    const out = new Set(t.length <= 120 ? [t] : []);
    (t.match(new RegExp(URL_IN_TEXT.source, 'gi')) || []).forEach((u) => out.add(u));
    (t.match(/\+?\d[\d\s.\-]{6,22}\d/g) || []).forEach((d) => out.add(d));
    return [...out].slice(0, 5);
  }

  const normalizeLoose = (v) => {
    const d = v.replace(/[\s.\-()]/g, '');
    if (/^\+?\d+$/.test(d)) return d.replace(/^\+?84(?=\d{9}$)/, '0');
    return v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  };

  async function lookupCommunity(text) {
    if (state.offline) return null;
    const qs = lookupCandidates(text);
    if (!qs.length) return null;
    if (!api.online) {
      const keys = qs.map(normalizeLoose);
      return MOCK_WARNINGS.find((w) => keys.includes(w.key)) || null;
    }
    try {
      return await fetchJSON('/api/lookup?' + qs.map((q) => 'q=' + encodeURIComponent(q)).join('&'), {}, 2500);
    } catch {
      return null;
    }
  }

  /* Báo cáo đã kiểm duyệt nâng mức cảnh báo: ≥3 → nguy hiểm, ≥1 → ít nhất nghi ngờ */
  function bumpLevel(level, info) {
    if (!info) return level;
    if (info.approved >= 3) return 'danger';
    if (info.approved >= 1 && level === 'safe') return 'warning';
    return level;
  }

  const communityReasons = (info) => [
    `<mark>${info.approved} người</mark> đã báo cáo nội dung này và báo cáo đã được kiểm duyệt.`,
    'Đối tượng lừa đảo thường <mark>đổi số, đổi đường dẫn</mark> liên tục để tránh bị phát hiện.',
    'Không chuyển tiền, không đọc mã OTP. Hãy <strong>hỏi người thân</strong> trước khi làm theo.'
  ];

  /* ---------- 6. RENDERERS (nhận root để dùng lại cho Gallery) ---------- */
  function setScreen(root, key) {
    $$(root, '.screen').forEach((s) => s.classList.toggle('is-active', s.dataset.screen === key));
    const tab = SCREENS[key].tab;
    $$(root, '.tab').forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle('is-active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    const gear = $(root, 'settingsBtn');
    if (gear) gear.classList.toggle('is-active', key === 'settings');
  }

  function setShare(root, level, text) {
    $(root, 'shareDot').className = 'lv-dot lv-' + level;
    $(root, 'shareText').textContent = truncate(text, 80);
  }

  function renderVerdict(root, level, title, sub) {
    const r = RESULTS[level];
    $(root, 'verdict').dataset.level = level;
    $(root, 'verdictIcon').setAttribute('href', '#' + r.icon);
    $(root, 'verdictBadge').textContent = r.badge;
    $(root, 'verdictTitle').textContent = title;
    $(root, 'verdictSub').textContent = sub;
  }

  function renderCommunity(root, info) {
    const el = $(root, 'community');
    const show = !!info && (info.approved > 0 || info.pending > 0);
    el.classList.toggle('is-visible', show);
    if (!show) return;
    el.dataset.level = info.approved >= 3 ? 'danger' : 'warning';
    $(root, 'communityTitle').textContent = info.approved > 0
      ? `${info.approved} báo cáo đã được kiểm duyệt`
      : `${info.pending} báo cáo đang chờ kiểm duyệt`;
    $(root, 'communityText').textContent = info.approved > 0
      ? `Nội dung này có trong danh sách cảnh báo cộng đồng${info.pending ? `, thêm ${info.pending} báo cáo đang chờ duyệt` : ''}. Lần gần nhất: ${relTime(info.lastAt)}.`
      : 'Chưa được xác nhận nhưng đã có người cảnh báo. Hãy thận trọng.';
  }

  function renderResult(root, level, text, reasons) {
    const r = RESULTS[level];
    root.querySelector('[data-screen="result"]').classList.remove('is-file');
    if (reasons) renderVerdict(root, level, level === 'danger' ? 'Nhiều người đã báo cáo lừa đảo' : 'Đã có người báo cáo lừa đảo', 'Không chuyển tiền, không đọc mã OTP cho người lạ.');
    else renderVerdict(root, level, r.title, r.sub);

    const type = detectType(text);
    $(root, 'checkedType').innerHTML = icon(type.icon) + type.label;
    $(root, 'checkedText').textContent = text;

    root.querySelector('.ai-card').dataset.level = level;
    $(root, 'conf').textContent = r.conf;
    $(root, 'reasons').innerHTML = (reasons || r.reasons).map((h, i) => `<li data-n="${i + 1}">${h}</li>`).join('');
    setShare(root, level, text);
  }

  function renderFileResult(root, f) {
    root.querySelector('[data-screen="result"]').classList.add('is-file');
    const t = FILE_TEXT[f.level];
    renderVerdict(root, f.level, t.title, t.sub);

    $(root, 'rFileName').textContent = f.name;
    $(root, 'rFileInfo').textContent = formatSize(f.size) + (f.typeDesc ? ` – ${f.typeDesc}` : '');
    $(root, 'rFileHash').textContent = f.sha256 || 'Trình duyệt không hỗ trợ tính mã SHA-256';

    const card = root.querySelector('.vt-card');
    card.dataset.level = f.level;
    const demo = $(root, 'vtDemo');
    demo.textContent = f.live ? (f.source === 'cache' ? 'Đã có dữ liệu' : 'Vừa phân tích') : 'Dữ liệu demo';
    demo.classList.toggle('is-live', !!f.live);

    const s = f.stats;
    const total = s.malicious + s.suspicious + s.harmless + s.undetected;
    $(root, 'vtFlagged').textContent = s.malicious + s.suspicious;
    $(root, 'vtTotal').textContent = total;
    const parts = [
      ['Nguy hiểm', s.malicious, 'var(--danger)'],
      ['Đáng ngờ', s.suspicious, 'var(--warn)'],
      ['An toàn', s.harmless, 'var(--safe)'],
      ['Không phát hiện', s.undetected, '#CBD5E1']
    ];
    $(root, 'vtBar').innerHTML = parts.filter((p) => p[1] > 0).map((p) => `<i style="flex:${p[1]};background:${p[2]}" title="${p[0]}: ${p[1]}"></i>`).join('');
    $(root, 'vtLegend').innerHTML = parts.map((p) => `<li><i style="background:${p[2]}"></i>${p[0]}<b>${p[1]}</b></li>`).join('');

    const detect = $(root, 'vtDetect');
    detect.style.display = f.detections.length ? '' : 'none';
    $(root, 'vtDetectList').innerHTML = f.detections.slice(0, 5)
      .map((d) => `<li><span>${esc(d.engine)}</span><b title="${esc(d.result)}">${esc(d.result)}</b></li>`).join('');

    const link = $(root, 'vtLink');
    link.style.display = f.live && f.permalink ? '' : 'none';
    if (f.permalink) link.href = f.permalink;

    setShare(root, f.level, `Tệp ${f.name} – ${t.title.toLowerCase()}`);
  }

  function setError(root, message) {
    const omni = $(root, 'omni');
    const err = $(root, 'omniError');
    const input = $(root, 'omniInput');
    if (message) {
      omni.classList.remove('is-error');
      void omni.offsetWidth; // chạy lại hiệu ứng rung
      omni.classList.add('is-error');
      $(root, 'omniErrorText').innerHTML = message;
      err.classList.add('is-visible');
      input.setAttribute('aria-invalid', 'true');
    } else {
      omni.classList.remove('is-error');
      err.classList.remove('is-visible');
      input.removeAttribute('aria-invalid');
    }
  }

  function setInputValue(root, value) {
    const input = $(root, 'omniInput');
    input.value = value;
    $(root, 'omni').classList.toggle('has-value', value.length > 0);
  }

  function setFileChip(root, file) {
    const omni = $(root, 'omni');
    omni.classList.toggle('has-file', !!file);
    $(root, 'checkLabel').textContent = file ? 'Quét tệp với VirusTotal' : 'Kiểm tra ngay';
    $(root, 'checkIcon').setAttribute('href', file ? '#i-file-search' : '#i-shield-check');
    if (file) {
      $(root, 'fileName').textContent = file.name;
      $(root, 'fileInfo').textContent = `${formatSize(file.size)} – sẵn sàng quét`;
    }
  }

  function setScanStep(root, step, progress) {
    const order = ['hash', 'lookup', 'analyze'];
    const idx = order.indexOf(step);
    $$(root, '[data-ref="vtSteps"] li').forEach((li) => {
      const i = order.indexOf(li.dataset.step);
      li.classList.toggle('is-done', step === 'done' || i < idx);
      li.classList.toggle('is-active', i === idx);
    });
    $(root, 'vtRing').style.strokeDasharray = `${progress} 100`;
  }

  function renderLesson(root, index, flipped) {
    const l = LESSONS[index];
    $(root, 'lessonTag').textContent = l.tag;
    $(root, 'lessonIcon').setAttribute('href', '#' + l.icon);
    $(root, 'lessonTitle').textContent = l.title;
    $(root, 'lessonQuote').textContent = l.quote;
    $(root, 'lessonSteps').innerHTML = l.steps.map((s, i) => `
      <span class="flip-step"><span class="flip-step-n">${i + 1}</span>
        <span class="flip-step-t"><strong>${s[0]}</strong><small>${s[1]}</small></span>
      </span>`).join('');
    const flip = $(root, 'flip');
    flip.classList.toggle('is-flipped', !!flipped);
    flip.classList.toggle('is-settled', !!flipped);
    $(root, 'flipInner').setAttribute('aria-label', `Thẻ bài học: ${l.title}. Chạm để lật.`);

    $(root, 'lessonList').innerHTML = LESSONS.map((x, i) => i === index ? '' : `
      <button class="lesson" data-action="pick-lesson" data-index="${i}">
        <span class="lesson-icon ${x.tone}">${icon(x.icon)}</span>
        <span class="lesson-body">
          <strong>${x.title}</strong>
          <span class="lesson-meta">
            <span class="min-badge">${icon('i-clock')}1 phút</span>
            ${state.learned.has(i) && root === device ? `<span class="lesson-done">${icon('i-check')}Đã học</span>` : ''}
          </span>
        </span>
        ${icon('i-chevron-right', 'lesson-chev')}
      </button>`).join('');

    const learnedCount = root === device ? state.learned.size : 0;
    $(root, 'learnProgress').innerHTML = `${icon('i-star')}${2 + learnedCount}/12 bài`;
  }

  function buildBubble(q) {
    let n = 0;
    return esc(q.text).replace(/\[\[(.+?)\]\]/g, (_, t) => `<span class="trap" data-n="${++n}">${t}</span>`);
  }

  function renderQuiz(root, index, picked, score) {
    const q = QUIZ[index];
    const screen = root.querySelector('[data-screen="quiz"]');
    screen.classList.remove('is-finished');

    $(root, 'quizCount').textContent = `Câu ${index + 1}/${QUIZ.length}`;
    $$(root, '[data-ref="quizBars"] i').forEach((bar, i) => {
      bar.className = i < index || (i === index && picked) ? 'is-done' : i === index ? 'is-current' : '';
    });
    $(root, 'scoreVal').textContent = score;

    const avatar = $(root, 'smsAvatar');
    avatar.textContent = q.avatar;
    avatar.classList.toggle('is-contact', q.contact);
    $(root, 'smsSender').textContent = q.sender;
    $(root, 'smsSub').textContent = q.sub;
    $(root, 'smsTime').textContent = q.time;
    $(root, 'smsBubble').innerHTML = buildBubble(q);

    const row = $(root, 'answerRow');
    const explain = $(root, 'explain');
    row.classList.toggle('is-answered', !!picked);
    $$(row, '.answer').forEach((b) => b.classList.toggle('is-picked', b.dataset.choice === picked));

    if (!picked) {
      explain.classList.remove('is-visible', 'is-correct', 'is-wrong');
      return;
    }

    const correct = picked === q.answer;
    $$(root, '[data-ref="smsBubble"] .trap').forEach((t, i) => {
      t.style.animationDelay = `${i * 0.12}s`;
      t.classList.add(q.answer === 'scam' ? 'is-revealed' : 'is-good');
    });

    explain.classList.remove('is-correct', 'is-wrong');
    explain.classList.add('is-visible', correct ? 'is-correct' : 'is-wrong');
    $(root, 'explainIcon').setAttribute('href', correct ? '#i-check' : '#i-x');
    $(root, 'explainTitle').textContent = correct
      ? 'Chính xác!'
      : `Chưa đúng – đây là tin ${q.answer === 'scam' ? 'lừa đảo' : 'an toàn'}`;
    const list = q.points.length
      ? `<ol>${q.points.map((p, i) => `<li><b>${i + 1}</b><span>${p}</span></li>`).join('')}</ol>`
      : '';
    $(root, 'explainText').innerHTML = q.explain + list;
    $(root, 'nextLabel').textContent = index === QUIZ.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo';
  }

  function renderChart(root) {
    const svg = $(root, 'donut');
    const ns = 'http://www.w3.org/2000/svg';
    const gap = 0.8;
    let offset = 0;
    $$(svg, '.donut-seg').forEach((s) => s.remove());
    CHART.forEach((d, i) => {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('class', 'donut-seg');
      c.setAttribute('cx', '70');
      c.setAttribute('cy', '70');
      c.setAttribute('r', '52');
      c.setAttribute('pathLength', '100');
      c.setAttribute('stroke', d.color);
      c.style.strokeDasharray = `${d.value - gap} ${100 - d.value + gap}`;
      c.style.strokeDashoffset = `${-offset}`;
      c.style.animationDelay = `${i * 0.08}s`;
      c.dataset.index = i;
      const title = document.createElementNS(ns, 'title');
      title.textContent = `${d.name}: ${d.value}%`;
      c.appendChild(title);
      svg.appendChild(c);
      offset += d.value;
    });

    $(root, 'legend').innerHTML = CHART.map((d, i) => `
      <li class="legend-item" data-index="${i}">
        <span class="legend-swatch" style="background:${d.color}"></span>
        <span class="legend-name">${d.name}</span>
        <span class="legend-bar"><i style="width:${(d.value / 35) * 100}%;background:${d.color}"></i></span>
        <span class="legend-val">${d.value}%</span>
      </li>`).join('');
    focusChart(root, null);
  }

  function focusChart(root, index) {
    const svg = $(root, 'donut');
    svg.classList.toggle('has-focus', index !== null);
    $$(svg, '.donut-seg').forEach((s) => s.classList.toggle('is-focus', Number(s.dataset.index) === index));
    $$(root, '.legend-item').forEach((l) => l.classList.toggle('is-focus', Number(l.dataset.index) === index));
    if (index === null) {
      $(root, 'donutValue').textContent = '120';
      $(root, 'donutLabel').textContent = 'báo cáo trong tháng';
    } else {
      $(root, 'donutValue').textContent = CHART[index].value + '%';
      $(root, 'donutLabel').textContent = CHART[index].name;
    }
  }

  /* Người thân: bottom sheet "Hỏi người thân" */
  function renderFamilySheet(root, family) {
    $(root, 'sheet').classList.toggle('is-empty', family.length === 0);
    $(root, 'familyList').innerHTML = family.map((f) => `
      <li class="family-row">
        <button class="fr-main" data-action="send-family" data-id="${f.id}">
          <span class="avatar av-${f.color}">${esc(initials(f.name))}</span>
          <span class="fr-body"><strong>${esc(f.name)}</strong><small>${esc(f.rel)} · ${maskPhone(f.phone)}</small></span>
          <span class="fr-send" aria-label="Gửi cảnh báo">${icon('i-send')}<span>Gửi</span></span>
        </button>
        <button class="fr-call" data-action="call-family" data-id="${f.id}" aria-label="Gọi ${esc(f.name)}">${icon('i-phone')}</button>
      </li>`).join('');
    const recip = $(root, 'familyRecipText');
    if (recip) recip.textContent = family.length ? family.map((f) => f.name).join(', ') : 'Chưa có người thân – thêm trong Cài đặt';
    const more = $(root, 'familyAddMore');
    if (more) more.style.display = family.length >= MAX_FAMILY ? 'none' : '';
  }

  /* Cài đặt */
  function renderSettings(root, settings, family) {
    const guard = $(root, 'guard');
    guard.classList.toggle('is-off', !settings.background);
    $(root, 'guardStatus').textContent = settings.background
      ? 'Đang bảo vệ kể cả khi bạn đóng ứng dụng'
      : 'Đang tắt. Bạn chỉ được bảo vệ khi mở ứng dụng';
    $$(root, '[data-action="toggle-background"]').forEach((b) => b.setAttribute('aria-checked', String(settings.background)));
    $$(root, '[data-action="toggle-option"]').forEach((b) => b.setAttribute('aria-checked', String(!!settings[b.dataset.option])));

    $(root, 'familyCount').textContent = `${family.length}/${MAX_FAMILY}`;
    $(root, 'contactList').innerHTML = family.length
      ? family.map((f) => `
        <li class="contact-row">
          <button class="contact-main" data-action="edit-contact" data-id="${f.id}">
            <span class="avatar av-${f.color}">${esc(initials(f.name))}</span>
            <span class="set-text"><strong>${esc(f.name)}</strong><small>${esc(f.rel)} – ${formatPhone(f.phone)}</small></span>
          </button>
          <button class="contact-edit" data-action="edit-contact" data-id="${f.id}" aria-label="Sửa thông tin ${esc(f.name)}">${icon('i-pencil')}</button>
        </li>`).join('')
      : '<li class="contact-empty">Chưa có người thân nào. Thêm ít nhất 1 người để dùng nút “Hỏi người thân”.</li>';
    const add = $(root, 'addContactBtn');
    add.disabled = family.length >= MAX_FAMILY;
    add.lastChild.textContent = family.length >= MAX_FAMILY ? 'Đã đủ 5 người thân' : 'Thêm người thân';
  }

  function renderServerStatus(root) {
    const serverDot = $(root, 'serverDot');
    const vtDot = $(root, 'vtDot');
    let serverText;
    if (!api.checked) serverText = 'Đang kiểm tra kết nối…';
    else if (state.offline) serverText = 'Mất mạng – báo cáo mới sẽ chờ gửi';
    else if (api.online) serverText = `Đã kết nối – lưu trong cơ sở dữ liệu ${api.db === 'sqlite' ? 'SQLite' : 'JSON'}`;
    else serverText = 'Chưa kết nối – đang chạy bản demo';
    $(root, 'serverText').textContent = serverText;
    serverDot.className = 'status-dot' + (api.online && !state.offline ? ' is-ok' : api.checked ? ' is-warn' : '');

    let vtText;
    if (!api.checked) vtText = 'Đang kiểm tra…';
    else if (api.online && api.vt) vtText = 'Sẵn sàng quét bằng VirusTotal';
    else if (api.online) vtText = 'Máy chủ chưa có khoá API – quét ở chế độ demo';
    else vtText = 'Chế độ demo – kết quả quét là dữ liệu mẫu';
    $(root, 'vtText').textContent = vtText;
    vtDot.className = 'status-dot' + (api.online && api.vt && !state.offline ? ' is-ok' : api.checked ? ' is-warn' : '');

    const n = state.queue.length;
    $(root, 'queueText').textContent = n ? `${n} báo cáo đang chờ gửi lên máy chủ` : 'Không có báo cáo nào đang chờ';
    $(root, 'flushBtn').disabled = !n || state.offline || !api.online;
  }

  /* Báo cáo */
  function selectReportType(root, type) {
    $$(root, '.type-card').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.type === type)));
    $(root, 'typeError').classList.remove('is-visible');
    const t = REPORT_TYPES[type];
    $(root, 'targetLabel').textContent = t ? t.input : 'Số điện thoại, đường dẫn hoặc mã tệp';
    const input = $(root, 'reportTarget');
    input.placeholder = t ? t.placeholder : 'Chọn loại báo cáo ở trên';
    input.inputMode = t ? t.mode : 'text';
    $(root, 'targetWrap').classList.toggle('is-file', type === 'file');
    setStep(root, type ? 2 : 1);
  }

  function setStep(root, step, allDone = false) {
    $$(root, '[data-ref="stepper"] .step').forEach((s) => {
      const n = Number(s.dataset.step);
      s.classList.toggle('is-done', allDone || n < step);
      s.classList.toggle('is-active', !allDone && n === step);
    });
  }

  function renderReportDone(root, mode, info = {}) {
    $(root, 'reportDone').dataset.mode = mode;
    const r = info.recipients || { server: true, officials: true, family: [] };
    const code = info.code ? `<b>#${esc(info.code)}</b>` : '';
    const head = {
      sent: ['i-check', 'Đã gửi báo cáo', `Mã tiếp nhận ${code}. Cảm ơn bạn đã góp phần bảo vệ cộng đồng Đồng Nai.`],
      queued: ['i-clock', 'Đã lưu tạm báo cáo', 'Báo cáo sẽ <b>tự động gửi</b> khi điện thoại có mạng trở lại. Bạn không cần làm gì thêm.'],
      demo: ['i-check', 'Đã ghi nhận báo cáo', `Mã tiếp nhận ${code}. Đây là bản demo nên báo cáo chưa được gửi lên máy chủ.`],
      family: ['i-check', 'Đã gửi cho người thân', 'Người thân sẽ nhận được tin nhắn kèm nội dung bạn báo cáo.']
    }[mode];
    $(root, 'doneIcon').setAttribute('href', '#' + head[0]);
    $(root, 'doneTitle').textContent = head[1];
    $(root, 'doneText').innerHTML = head[2];

    const wait = mode === 'queued' || mode === 'demo';
    const later = mode === 'queued' ? 'sẽ gửi khi có mạng' : 'bản demo chưa gửi đi';
    const items = [];
    if (r.server) items.push([wait, wait ? `Danh sách cảnh báo cộng đồng: ${later}` : 'Máy chủ đã nhận. Sau khi kiểm duyệt, mọi người sẽ được cảnh báo.']);
    if (r.officials) items.push([wait, wait ? `Cán bộ, Công an xã/phường: ${later}` : 'Đã chuyển tới cán bộ, Công an xã/phường.']);
    if (r.family.length) items.push([false, `Đã nhắn tin cho ${r.family.join(', ')}${state.offline ? ' qua SMS' : ''}.`]);
    $(root, 'doneList').innerHTML = items
      .map(([w, t]) => `<li class="${w ? 'is-wait' : ''}">${icon(w ? 'i-clock' : 'i-check')}<span>${esc(t)}</span></li>`).join('');
  }

  function setReportDone(root, done) {
    root.querySelector('[data-screen="report"]').classList.toggle('is-done', done);
    if (done) setStep(root, 3, true);
  }

  /* ---------- 7. ĐIỀU HƯỚNG ---------- */
  function go(key) {
    if (!SCREENS[key]) return;
    stopMic(false);
    stopListen();
    closeSheet();

    if (key === 'report') prepareReport();
    if (key === 'volunteer') { loadModeration(); loadWarnings(); }
    if (key === 'settings') {
      if (state.screen !== 'settings') state.prevScreen = state.screen;
      renderSettings(device, state.settings, state.family);
      renderServerStatus(device);
    }

    state.screen = key;
    setScreen(device, key);
    ui.viewport.scrollTo({ top: 0, behavior: 'auto' });
    updateStageLabel();

    $$(inspector, '.ins-screen').forEach((b) => b.classList.toggle('is-active', b.dataset.target === key));
    if (isMobile()) inspector.classList.remove('is-open');
  }

  function updateStageLabel() {
    if (state.sheetOpen) {
      const mode = ui.sheet.dataset.mode;
      const labels = {
        family: ['03_HoiNguoiThan', 'Bottom sheet – Hỏi người thân'],
        poster: ['07_TinhNguyen', 'Bottom sheet – Ảnh tuyên truyền'],
        contact: ['08_CaiDat', state.contactEditId ? 'Bottom sheet – Sửa người thân' : 'Bottom sheet – Thêm người thân']
      };
      [stageCode.textContent, stageTitle.textContent] = labels[mode];
      return;
    }
    stageCode.textContent = SCREENS[state.screen].code;
    stageTitle.textContent = SCREENS[state.screen].title;
  }

  /* ---------- 8. TOAST ---------- */
  function toast({ type = 'success', title, desc = '', iconId }) {
    const icons = { success: 'i-check', info: 'i-info', warn: 'i-wifi-off', error: 'i-alert-circle' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <span class="toast-icon">${icon(iconId || icons[type])}</span>
      <span class="toast-body"><strong>${title}</strong>${desc ? `<small>${desc}</small>` : ''}</span>`;
    const host = ui.toastHost;
    while (host.children.length >= 2) host.firstElementChild.remove();
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      el.addEventListener('animationend', () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 600);
    }, 3400);
  }

  /* ---------- 9. TRANG CHỦ: KIỂM TRA VĂN BẢN, MICRO ---------- */
  async function runCheck() {
    if (ui.checkBtn.classList.contains('is-loading') || state.scanToken) return;
    if (state.file) { runFileScan(state.file); return; }
    stopMic(false);
    const value = ui.omniInput.value.trim();
    const err = validate(value);
    if (err) {
      setError(device, err);
      ui.omniInput.focus();
      return;
    }
    setError(device, null);
    ui.omni.classList.remove('is-scanning');
    void ui.omni.offsetWidth;
    ui.omni.classList.add('is-scanning');
    ui.checkBtn.classList.add('is-loading');

    const [info] = await Promise.all([lookupCommunity(value), delay(600)]);
    ui.omni.classList.remove('is-scanning');
    ui.checkBtn.classList.remove('is-loading');
    const base = analyze(value);
    state.level = bumpLevel(base, info);
    state.resultKind = 'text';
    state.checkedText = value;
    renderResult(device, state.level, value, state.level !== base ? communityReasons(info) : null);
    renderCommunity(device, info);
    syncLevelButtons();
    go('result');
    maybeAutoRead();
  }

  function maybeAutoRead() {
    if (state.settings.autoRead && state.level === 'danger') setTimeout(startListen, 450);
  }

  function startMic() {
    stopTyping();
    setError(device, null);
    ui.omni.classList.add('is-listening');
    timers.mic = setTimeout(() => {
      stopMic(false);
      typeInto(VOICE_TRANSCRIPT);
    }, 2600);
  }

  function stopMic(notify) {
    clearTimeout(timers.mic);
    if (ui.omni.classList.contains('is-listening')) {
      ui.omni.classList.remove('is-listening');
      if (notify) toast({ type: 'info', title: 'Đã dừng nghe', desc: 'Bạn có thể nói lại hoặc gõ nội dung.', iconId: 'i-mic' });
    }
  }

  function typeInto(text) {
    stopTyping();
    let i = 0;
    setInputValue(device, '');
    timers.typing = setInterval(() => {
      i += 2;
      setInputValue(device, text.slice(0, i));
      if (i >= text.length) {
        stopTyping();
        ui.omniInput.focus();
      }
    }, 16);
  }

  function stopTyping() { clearInterval(timers.typing); }

  /* ---------- 10. QUÉT TỆP (VirusTotal qua server.js) ---------- */
  function chooseFile(file) {
    const err = validateFile(file);
    if (err) {
      state.file = null;
      setFileChip(device, null);
      setError(device, err);
      return;
    }
    stopMic(false);
    stopTyping();
    setError(device, null);
    state.file = file;
    setFileChip(device, file);
  }

  function clearFile() {
    state.file = null;
    setFileChip(device, null);
    setError(device, null);
  }

  function endScan() {
    state.scanToken = null;
    ui.omni.classList.remove('is-file-scanning');
    setScanStep(device, 'hash', 0);
  }

  async function runFileScan(file, { demo = false } = {}) {
    const err = validateFile(file);
    if (err) { setError(device, err); return; }
    if (state.offline) {
      setError(device, 'Cần có mạng để quét tệp bằng VirusTotal. Hãy thử lại khi điện thoại có kết nối.');
      return;
    }
    setError(device, null);
    const token = { cancelled: false };
    state.scanToken = token;
    ui.omni.classList.add('is-file-scanning');
    setScanStep(device, 'hash', 8);
    $(device, 'vtAnalyzeText').textContent = 'Phân tích bằng các công cụ diệt virus';

    try {
      const [sha] = await Promise.all([sha256Hex(file).catch(() => null), delay(450)]);
      if (token.cancelled) return;
      setScanStep(device, 'lookup', 28);

      const useServer = !demo && api.online && api.vt;
      const result = useServer ? await scanViaServer(file, token) : await scanDemo(file, sha, token);
      if (token.cancelled) return;

      setScanStep(device, 'done', 100);
      await delay(450);
      if (token.cancelled) return;
      endScan();

      const info = result.sha256 ? await lookupCommunity(result.sha256) : null;
      if (token.cancelled) return;
      result.level = bumpLevel(result.level, info);
      state.resultKind = 'file';
      state.fileResult = result;
      state.level = result.level;
      state.checkedText = `Tệp “${result.name}” (SHA-256: ${result.sha256 ? result.sha256.slice(0, 16) + '…' : 'không rõ'}) – ${FILE_TEXT[result.level].title.toLowerCase()}`;
      renderFileResult(device, result);
      renderCommunity(device, info);
      syncLevelButtons();
      clearFile();
      go('result');
      maybeAutoRead();
    } catch (e) {
      if (token.cancelled) return;
      endScan();
      setError(device, esc(e.message || 'Không quét được tệp. Hãy thử lại.'));
    }
  }

  async function scanViaServer(file, token) {
    const first = await fetchJSON('/api/scan', {
      method: 'POST',
      body: file,
      headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }
    }, 120000);
    if (first.status === 'completed') {
      setScanStep(device, 'analyze', 85);
      return first.result;
    }
    // Tệp mới: VirusTotal cần thời gian phân tích. Gói miễn phí giới hạn 4 lượt/phút nên hỏi lại mỗi 15 giây.
    setScanStep(device, 'analyze', 40);
    for (let i = 1; i <= 10; i++) {
      $(device, 'vtAnalyzeText').textContent = `Đang phân tích… lần kiểm tra ${i}/10`;
      await delay(15000);
      if (token.cancelled) return null;
      const r = await fetchJSON(`/api/scan/${encodeURIComponent(first.analysisId)}`, {}, 20000);
      setScanStep(device, 'analyze', Math.min(95, 40 + i * 6));
      if (r.status === 'completed') return r.result;
    }
    throw new Error('VirusTotal vẫn đang phân tích tệp này. Hãy thử quét lại sau ít phút – kết quả sẽ có ngay vì tệp đã nằm trong kho.');
  }

  async function scanDemo(file, sha, token) {
    await delay(900);
    if (token.cancelled) return null;
    setScanStep(device, 'analyze', 55);
    for (let p = 60; p <= 90; p += 10) {
      await delay(300);
      if (token.cancelled) return null;
      setScanStep(device, 'analyze', p);
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    let level = 'safe';
    if (RISKY_EXT.includes(ext)) level = 'danger';
    else if (ARCHIVE_EXT.includes(ext)) level = 'warning';
    const stats = {
      danger: { malicious: 38, suspicious: 2, harmless: 0, undetected: 26 },
      warning: { malicious: 1, suspicious: 2, harmless: 0, undetected: 63 },
      safe: { malicious: 0, suspicious: 0, harmless: 0, undetected: 66 }
    }[level];
    return {
      name: file.name, size: file.size, typeDesc: file.type || '', sha256: sha,
      level, live: false, permalink: null, stats,
      detections: level === 'danger' ? DEMO_FILE_RESULT.detections
        : level === 'warning' ? [{ engine: 'Công cụ #1', result: 'Suspicious.Archive.Gen' }] : []
    };
  }

  /* ---------- 11. KẾT QUẢ: NGHE ĐỌC ---------- */
  const LISTEN_SECONDS = 12;
  function startListen() {
    clearInterval(timers.listen);
    ui.listen.classList.add('is-playing');
    ui.listen.setAttribute('aria-pressed', 'true');
    const start = Date.now();
    ui.listenBar.style.width = '0%';
    timers.listen = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / (LISTEN_SECONDS * 1000));
      ui.listenBar.style.width = (p * 100).toFixed(1) + '%';
      if (p >= 1) stopListen();
    }, 120);
  }
  function stopListen() {
    clearInterval(timers.listen);
    ui.listen.classList.remove('is-playing');
    ui.listen.setAttribute('aria-pressed', 'false');
    ui.listenBar.style.width = '0%';
  }

  /* ---------- 12. BOTTOM SHEET ---------- */
  function openSheet(mode = 'family') {
    ui.sheet.dataset.mode = mode;
    const labels = { family: 'Hỏi người thân', poster: 'Ảnh tuyên truyền', contact: 'Thông tin người thân' };
    ui.sheet.setAttribute('aria-label', labels[mode]);
    if (mode === 'family') {
      renderFamilySheet(device, state.family);
      setShare(device, state.level, state.resultKind === 'file' && state.fileResult
        ? `Tệp ${state.fileResult.name} – ${FILE_TEXT[state.fileResult.level].title.toLowerCase()}`
        : state.checkedText);
    }
    ui.sheet.scrollTop = 0;
    ui.sheetLayer.classList.add('is-open');
    ui.sheetLayer.setAttribute('aria-hidden', 'false');
    state.sheetOpen = true;
    updateStageLabel();
    setTimeout(() => {
      const target = mode === 'contact' ? ui.contactName : ui.sheet.querySelector(`.pane-${mode} [data-action="close-sheet"]`);
      if (target) target.focus({ preventScroll: true });
    }, 380);
  }

  function closeSheet() {
    if (!state.sheetOpen) return;
    ui.sheetLayer.classList.remove('is-open');
    ui.sheetLayer.setAttribute('aria-hidden', 'true');
    state.sheetOpen = false;
    disarmDelete();
    updateStageLabel();
  }

  /* ---------- 13. NGƯỜI THÂN: THÊM / SỬA / XOÁ ---------- */
  function saveFamily() {
    if (!state.emptyOverride) store.set('lcs.family', state.family);
    renderFamilySheet(device, state.family);
    renderSettings(device, state.settings, state.family);
  }

  function setContactRel(root, rel) {
    $$(root, '.rel-chip').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.rel === rel)));
  }

  function clearContactErrors(root) {
    ['name', 'phone'].forEach((k) => $(root, k + 'Wrap').classList.remove('is-error'));
    ['nameError', 'phoneError', 'relError'].forEach((k) => $(root, k).classList.remove('is-visible'));
  }

  function showFieldError(root, field, message) {
    const err = $(root, field + 'Error');
    err.textContent = message;
    err.classList.add('is-visible');
    const wrap = $(root, field + 'Wrap');
    if (wrap) {
      wrap.classList.remove('is-error');
      void wrap.offsetWidth;
      wrap.classList.add('is-error');
    }
  }

  function fillContactForm(root, contact) {
    const form = $(root, 'contactForm');
    form.classList.toggle('is-edit', !!contact);
    $(root, 'contactTitle').textContent = contact ? 'Sửa thông tin người thân' : 'Thêm người thân';
    $(root, 'contactSaveLabel').textContent = contact ? 'Lưu thay đổi' : 'Lưu người thân';
    $(root, 'contactName').value = contact ? contact.name : '';
    $(root, 'contactPhone').value = contact ? formatPhone(contact.phone) : '';
    setContactRel(root, contact ? contact.rel : null);
    clearContactErrors(root);
  }

  function openContactForm(id, from) {
    if (!id && state.family.length >= MAX_FAMILY && !state.emptyOverride) {
      toast({ type: 'info', title: 'Đã đủ 5 người thân', desc: 'Xoá bớt một người trong Cài đặt để thêm người mới.', iconId: 'i-users' });
      return;
    }
    const contact = id ? state.family.find((f) => f.id === id) : null;
    state.contactEditId = contact ? contact.id : null;
    state.contactFrom = from || null;
    state.contactRel = contact ? contact.rel : null;
    disarmDelete();
    fillContactForm(device, contact);
    openSheet('contact');
  }

  function submitContact() {
    clearContactErrors(device);
    const name = ui.contactName.value.trim().replace(/\s+/g, ' ');
    const phone = normalizePhone(ui.contactPhone.value);
    const rel = state.contactRel;
    let ok = true;

    if (name.length < 2) { showFieldError(device, 'name', 'Nhập họ tên người thân (ít nhất 2 ký tự).'); ok = false; }
    if (!rel) { showFieldError(device, 'rel', 'Chọn mối quan hệ với người này.'); ok = false; }
    if (!phone) { showFieldError(device, 'phone', 'Nhập số điện thoại để có thể gửi cảnh báo.'); ok = false; }
    else if (!isValidPhone(phone)) { showFieldError(device, 'phone', 'Số điện thoại chưa đúng. Nhập 10 chữ số, bắt đầu bằng 0 (VD: 0912 345 678).'); ok = false; }
    else {
      const pool = state.emptyOverride ? [] : state.family;
      const dup = pool.find((f) => f.phone === phone && f.id !== state.contactEditId);
      if (dup) { showFieldError(device, 'phone', `Số này đã có trong danh sách (${dup.name}).`); ok = false; }
    }
    if (!ok) return;

    const editing = !!state.contactEditId;
    if (state.emptyOverride) {
      // Đang ở trạng thái "danh sách trống": người vừa thêm trở thành người thân đầu tiên.
      state.emptyOverride = false;
      state.familyStash = null;
      state.family = [];
      syncToggles();
    }
    if (editing) {
      state.family = state.family.map((f) => (f.id === state.contactEditId ? { ...f, name, phone, rel } : f));
    } else {
      const used = state.family.map((f) => f.color);
      const color = [1, 2, 3, 4, 5].find((c) => !used.includes(c)) || 1;
      state.family = [...state.family, { id: 'f-' + uid(), name, rel, phone, color }];
    }
    saveFamily();
    toast({
      type: 'success',
      title: editing ? `Đã lưu thay đổi cho ${esc(name)}` : `Đã thêm ${esc(name)} vào danh sách người thân`,
      desc: `${esc(rel)} – ${formatPhone(phone)}`,
      iconId: editing ? 'i-check' : 'i-user-plus'
    });
    if (state.contactFrom === 'family') openSheet('family');
    else closeSheet();
  }

  function disarmDelete() {
    clearTimeout(timers.disarm);
    state.deleteArmed = false;
    const btn = $(device, 'contactDelete');
    btn.classList.remove('is-confirm');
    $(device, 'contactDeleteLabel').textContent = 'Xoá người thân này';
  }

  function deleteContact() {
    if (!state.contactEditId) return;
    if (!state.deleteArmed) {
      state.deleteArmed = true;
      $(device, 'contactDelete').classList.add('is-confirm');
      $(device, 'contactDeleteLabel').textContent = 'Bấm lần nữa để xoá';
      timers.disarm = setTimeout(disarmDelete, 3500);
      return;
    }
    const removed = state.family.find((f) => f.id === state.contactEditId);
    state.family = state.family.filter((f) => f.id !== state.contactEditId);
    saveFamily();
    closeSheet();
    toast({ type: 'info', title: `Đã xoá ${esc(removed ? removed.name : 'người thân')} khỏi danh sách`, iconId: 'i-trash' });
  }

  /* ---------- 14. BÁO CÁO: GỬI LÊN MÁY CHỦ, HÀNG ĐỢI KHI MẤT MẠNG ---------- */
  /* Điền sẵn báo cáo từ nội dung vừa kiểm tra */
  function reportDraft() {
    if (state.resultKind === 'file' && state.fileResult) {
      return { type: 'file', target: state.fileResult.sha256 || '', content: `Tệp “${state.fileResult.name}”` };
    }
    const t = state.checkedText;
    const kind = detectType(t).label;
    if (kind === 'Đường dẫn') return { type: 'link', target: t, content: '' };
    if (kind === 'Số điện thoại') return { type: 'phone', target: t, content: '' };
    if (kind === 'Số tài khoản') return { type: 'bank', target: t, content: '' };
    const url = t.match(URL_IN_TEXT);
    return url ? { type: 'link', target: url[0], content: t } : { type: null, target: '', content: t };
  }

  function prepareReport() {
    const screen = device.querySelector('[data-screen="report"]');
    if (screen.classList.contains('is-done') || state.reportPrefill !== state.checkedText) resetReport();
  }

  function resetReport() {
    const d = reportDraft();
    state.reportType = d.type;
    setReportDone(device, false);
    selectReportType(device, d.type);
    ui.reportTarget.value = d.target;
    ui.reportText.value = d.content;
    state.reportPrefill = state.checkedText;
    $(device, 'reportSubmit').classList.remove('is-loading');
    $(device, 'reportError').classList.remove('is-visible');
    clearTargetError();
  }

  function clearTargetError() {
    $(device, 'targetWrap').classList.remove('is-error');
    $(device, 'targetError').classList.remove('is-visible');
  }

  function showReportError(message) {
    $(device, 'reportErrorText').textContent = message;
    $(device, 'reportError').classList.add('is-visible');
  }

  function enqueue(payload) {
    state.queue = [...state.queue, { ...payload, queuedOffline: true }];
    store.set('lcs.queue', state.queue);
    renderServerStatus(device);
  }

  async function postReport(payload) {
    return fetchJSON('/api/reports', { method: 'POST', json: payload }, 10000);
  }

  async function submitReport() {
    const submit = $(device, 'reportSubmit');
    if (submit.classList.contains('is-loading')) return;
    $(device, 'reportError').classList.remove('is-visible');
    if (!state.reportType) {
      const grid = $(device, 'typeGrid');
      grid.classList.remove('is-error');
      void grid.offsetWidth;
      grid.classList.add('is-error');
      $(device, 'typeError').classList.add('is-visible');
      ui.viewport.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const targetErr = validateTarget(state.reportType, ui.reportTarget.value);
    if (targetErr) {
      showFieldError(device, 'target', targetErr);
      ui.reportTarget.focus();
      return;
    }
    const r = state.recipients;
    if (!r.server && !r.officials && !r.family) { showReportError('Chọn ít nhất 1 nơi nhận báo cáo.'); return; }
    if (r.family && !state.family.length) { showReportError('Bạn chưa có người thân nào. Thêm trong Cài đặt hoặc tắt mục Người thân.'); return; }

    const recipients = { server: r.server, officials: r.officials, family: r.family ? state.family.map((f) => f.name) : [] };
    // Tên người thân không gửi lên máy chủ – chỉ gửi số lượng
    const payload = {
      clientId: uid(),
      type: state.reportType,
      target: ui.reportTarget.value.trim(),
      content: ui.reportText.value.trim().slice(0, 2000),
      recipients: { server: r.server, officials: r.officials, family: recipients.family.length },
      riskLevel: state.level,
      clientCreatedAt: new Date().toISOString()
    };
    submit.classList.add('is-loading');
    setStep(device, 3);

    const finish = (mode, info) => {
      submit.classList.remove('is-loading');
      renderReportDone(device, mode, { recipients, ...info });
      setReportDone(device, true);
      ui.viewport.scrollTo({ top: 0, behavior: 'auto' });
    };

    if (!r.server && !r.officials) {
      await delay(500);
      finish('family');
      return;
    }
    if (state.offline) {
      await delay(500);
      enqueue(payload);
      finish('queued');
      return;
    }
    if (!api.online) {
      await delay(700);
      const d = new Date();
      const code = `DN-${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      finish('demo', { code });
      return;
    }
    try {
      const res = await postReport(payload);
      finish('sent', { code: res.code });
    } catch (e) {
      if (e.status && e.status < 500) {
        submit.classList.remove('is-loading');
        setStep(device, 2);
        showReportError(e.message);
        return;
      }
      // Máy chủ không phản hồi: giữ lại để tự gửi sau.
      enqueue(payload);
      finish('queued');
    }
  }

  async function pickReportFile(file) {
    const hash = await sha256Hex(file).catch(() => null);
    if (!hash) { showFieldError(device, 'target', 'Trình duyệt không tính được mã tệp. Hãy dán mã SHA-256 vào ô trên.'); return; }
    ui.reportTarget.value = hash;
    if (!ui.reportText.value.trim()) ui.reportText.value = `Tệp “${file.name}”`;
    clearTargetError();
    toast({ type: 'success', title: 'Đã lấy mã tệp', desc: `${esc(file.name)} – tệp không bị tải lên khi báo cáo.`, iconId: 'i-file-search' });
  }

  /* ---------- KIỂM DUYỆT & DANH SÁCH CẢNH BÁO ---------- */
  const MOD_KEY = 'lcs.modToken';
  const modToken = {
    get() { try { return sessionStorage.getItem(MOD_KEY) || ''; } catch { return ''; } },
    set(v) { try { if (v) sessionStorage.setItem(MOD_KEY, v); else sessionStorage.removeItem(MOD_KEY); } catch { /* bỏ qua */ } }
  };
  let demoPending = MOCK_PENDING.slice();

  function recipLabel(r) {
    const parts = [];
    if (r.server) parts.push('Cộng đồng');
    if (r.officials) parts.push('Cán bộ');
    if (r.family) parts.push(`${r.family} người thân`);
    return parts.join(', ') || 'Không rõ';
  }

  function renderModeration(root, items, demo) {
    const card = $(root, 'modCard');
    card.classList.remove('needs-login');
    card.classList.toggle('is-empty', !items.length);
    $(root, 'modCount').textContent = `${items.length} chờ duyệt${demo ? ' (demo)' : ''}`;
    $(root, 'modList').innerHTML = items.map((r) => {
      const t = REPORT_TYPES[r.type] || REPORT_TYPES.sms;
      return `
      <li class="mod-item">
        <div class="mod-top">
          <span class="hot-sev ${r.type === 'link' ? 'sev-warning' : 'sev-danger'}">${icon(t.icon)}</span>
          <span class="mod-meta"><strong>${esc(r.target || '(không có)')}</strong><small>${t.label} – ${relTime(r.created_at)}${r.code ? ` – #${esc(r.code)}` : ''}</small></span>
        </div>
        ${r.content ? `<button class="mod-content" data-action="mod-expand" aria-label="Đọc toàn bộ báo cáo">${esc(r.content)}</button>` : ''}
        <p class="mod-recip">Gửi tới: ${recipLabel(r.recipients || {})}</p>
        <div class="mod-actions">
          <button class="btn btn-outline" data-action="moderate" data-id="${esc(r.id)}" data-decision="reject">Từ chối</button>
          <button class="btn btn-approve" data-action="moderate" data-id="${esc(r.id)}" data-decision="approve" data-target="${esc(r.target || '')}">${icon('i-check')}Duyệt</button>
        </div>
      </li>`;
    }).join('');
  }

  function showModError(message) {
    const err = $(device, 'modError');
    err.textContent = message;
    err.classList.toggle('is-visible', !!message);
  }

  async function loadModeration() {
    const card = $(device, 'modCard');
    showModError('');
    if (!api.online) { renderModeration(device, demoPending, true); return; }
    const token = modToken.get();
    if (!token) { card.classList.add('needs-login'); $(device, 'modCount').textContent = ''; return; }
    try {
      const res = await fetchJSON('/api/moderation', { headers: { 'x-admin-token': token } }, 6000);
      renderModeration(device, res.items || [], false);
    } catch (e) {
      if (e.status === 401 || e.status === 403) { modToken.set(''); card.classList.add('needs-login'); }
      showModError(e.message);
    }
  }

  async function moderate(el) {
    const item = el.closest('.mod-item');
    const { id, decision } = el.dataset;
    $$(item, 'button').forEach((b) => (b.disabled = true));
    try {
      if (api.online) {
        await fetchJSON(`/api/moderation/${encodeURIComponent(id)}`, { method: 'POST', json: { action: decision }, headers: { 'x-admin-token': modToken.get() } }, 6000);
      } else {
        demoPending = demoPending.filter((x) => x.id !== id);
        if (decision === 'approve') MOCK_WARNINGS.push({ key: normalizeLoose(el.dataset.target), approved: 1, pending: 0, lastAt: new Date().toISOString() });
      }
    } catch (e) {
      $$(item, 'button').forEach((b) => (b.disabled = false));
      toast({ type: 'error', title: 'Chưa xử lý được báo cáo', desc: esc(e.message) });
      if (e.status === 401) { modToken.set(''); loadModeration(); }
      return;
    }
    item.classList.add('is-leaving');
    setTimeout(() => {
      item.remove();
      const left = $$(device, '.mod-item').length;
      $(device, 'modCard').classList.toggle('is-empty', !left);
      $(device, 'modCount').textContent = `${left} chờ duyệt${api.online ? '' : ' (demo)'}`;
    }, 300);
    toast(decision === 'approve'
      ? { type: 'success', title: 'Đã duyệt vào danh sách cảnh báo', desc: 'Ai kiểm tra nội dung này sẽ thấy cảnh báo từ cộng đồng.' }
      : { type: 'info', title: 'Đã từ chối báo cáo', iconId: 'i-x' });
    if (decision === 'approve') loadWarnings();
  }

  function renderWarnings(root, items) {
    $(root, 'hotTitle').textContent = 'Danh sách cảnh báo cộng đồng';
    $(root, 'hotList').innerHTML = items.slice(0, 6).map((w) => {
      const t = REPORT_TYPES[w.type] || REPORT_TYPES.sms;
      const fresh = Date.now() - Date.parse(w.lastAt) < 864e5;
      return `
      <li class="hot-item">
        <span class="hot-sev ${w.count >= 3 ? 'sev-danger' : 'sev-warning'}">${icon(t.icon)}</span>
        <span class="hot-body"><strong>${esc(w.target)}</strong><small>${t.label} – ${w.count} báo cáo – ${relTime(w.lastAt)}</small></span>
        ${fresh ? '<span class="badge-new">Mới</span>' : ''}
      </li>`;
    }).join('');
  }

  async function loadWarnings() {
    if (!api.online || state.offline) return;
    try {
      const res = await fetchJSON('/api/warnings', {}, 4000);
      if (res.items && res.items.length) renderWarnings(device, res.items);
    } catch { /* giữ danh sách hiện tại */ }
  }

  let flushing = false;
  async function flushQueue({ silent = false } = {}) {
    if (flushing || state.offline || !api.online || !state.queue.length) {
      if (!silent && !api.online) toast({ type: 'info', title: 'Chưa kết nối máy chủ', desc: 'Báo cáo sẽ được gửi khi máy chủ hoạt động.', iconId: 'i-server' });
      return;
    }
    flushing = true;
    let sent = 0;
    const remaining = [];
    for (const item of state.queue) {
      try {
        await postReport(item);
        sent += 1;
      } catch (e) {
        if (!(e.status && e.status < 500)) remaining.push(item); // lỗi mạng: giữ lại; lỗi dữ liệu: bỏ
      }
    }
    state.queue = remaining;
    store.set('lcs.queue', state.queue);
    flushing = false;
    renderServerStatus(device);
    if (sent) toast({ type: 'success', title: `Đã gửi ${sent} báo cáo đang chờ`, desc: 'Báo cáo đã được lưu vào cơ sở dữ liệu máy chủ.', iconId: 'i-server' });
  }

  async function detectServer() {
    if (location.protocol === 'file:') {
      api.checked = true;
    } else {
      try {
        const h = await fetchJSON('/api/health', {}, 2500);
        api.online = !!h.ok;
        api.vt = !!h.virustotal;
        api.db = h.database || null;
      } catch {
        api.online = false;
      }
      api.checked = true;
    }
    renderServerStatus(device);
    flushQueue({ silent: true });
    loadWarnings();
  }

  /* ---------- 15. QUIZ ---------- */
  function answerQuiz(choice) {
    if (state.quizAnswered) return;
    state.quizAnswered = true;
    const q = QUIZ[state.quizIndex];
    const correct = choice === q.answer;
    if (correct) state.quizScore += 20;
    renderQuiz(device, state.quizIndex, choice, state.quizScore);
    if (correct) {
      const badge = $(device, 'scoreBadge');
      badge.classList.remove('is-pop');
      void badge.offsetWidth;
      badge.classList.add('is-pop');
    }
    setTimeout(() => {
      const explain = $(device, 'explain');
      ui.viewport.scrollTo({ top: Math.max(0, explain.offsetTop - 120), behavior: 'smooth' });
    }, 250);
  }

  function nextQuiz() {
    if (state.quizIndex >= QUIZ.length - 1) { finishQuiz(); return; }
    state.quizIndex += 1;
    state.quizAnswered = false;
    renderQuiz(device, state.quizIndex, null, state.quizScore);
    ui.viewport.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function finishQuiz() {
    device.querySelector('[data-screen="quiz"]').classList.add('is-finished');
    $$(device, '[data-ref="quizBars"] i').forEach((b) => (b.className = 'is-done'));
    $(device, 'doneScore').textContent = state.quizScore;
    $(device, 'doneText').textContent = state.quizScore >= 80
      ? 'Tuyệt vời! Bạn nhận diện rất tốt các chiêu lừa phổ biến. Hãy chia sẻ cho người thân cùng luyện tập.'
      : 'Bạn đã nắm được một số dấu hiệu. Xem lại Bài học 1 phút để tự tin hơn nhé!';
    ui.viewport.scrollTo({ top: 0, behavior: 'auto' });
  }

  function restartQuiz() {
    state.quizIndex = 0;
    state.quizScore = 0;
    state.quizAnswered = false;
    renderQuiz(device, 0, null, 0);
    ui.viewport.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ---------- 16. CHẾ ĐỘ: A+, OFFLINE, TRỐNG ---------- */
  function syncToggles() {
    $$(document, '[data-action="toggle-senior"]').forEach((b) => b.setAttribute('aria-checked', String(state.senior)));
    $$(document, '[data-action="toggle-offline"]').forEach((b) => b.setAttribute('aria-checked', String(state.offline)));
    $$(document, '[data-action="toggle-empty"]').forEach((b) => b.setAttribute('aria-checked', String(state.emptyOverride)));
    device.classList.toggle('is-senior', state.senior);
    device.classList.toggle('is-offline', state.offline);
  }

  function syncLevelButtons() {
    $$(inspector, '.ins-level').forEach((b) => {
      const on = b.dataset.level === state.level;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  function toggleSenior() {
    state.senior = !state.senior;
    syncToggles();
    toast(state.senior
      ? { type: 'info', title: 'Đã bật chế độ Người cao tuổi', desc: 'Chữ to, nút lớn, chỉ giữ Kiểm tra – Bài học – Báo cáo.', iconId: 'i-eye' }
      : { type: 'info', title: 'Đã về chế độ hiển thị tiêu chuẩn', iconId: 'i-eye' });
    if (state.senior && state.screen === 'volunteer') go('home');
    if (state.senior && state.screen === 'quiz') go('learn');
    if (state.gallery) buildGallery();
  }

  function toggleOffline() {
    state.offline = !state.offline;
    syncToggles();
    renderServerStatus(device);
    toast(state.offline
      ? { type: 'warn', title: 'Mất kết nối mạng', desc: 'Đã chuyển sang kiểm tra bằng dữ liệu trên máy.' }
      : { type: 'success', title: 'Đã kết nối lại', desc: state.queue.length ? `Đang gửi ${state.queue.length} báo cáo lưu tạm…` : 'Mọi tính năng đã hoạt động bình thường.', iconId: 'i-wifi' });
    if (!state.offline) setTimeout(() => flushQueue({ silent: true }), 600);
    if (state.gallery) buildGallery();
  }

  function toggleEmpty() {
    if (!state.emptyOverride) {
      state.familyStash = state.family;
      state.family = [];
      state.emptyOverride = true;
    } else {
      state.family = state.familyStash || store.get('lcs.family', DEFAULT_FAMILY);
      state.familyStash = null;
      state.emptyOverride = false;
    }
    syncToggles();
    renderFamilySheet(device, state.family);
    renderSettings(device, state.settings, state.family);
  }

  /* ---------- 17. THẺ LẬT (BÀI HỌC) ---------- */
  function flipCard() {
    const flip = $(device, 'flip');
    if (flip.classList.contains('is-flipped')) {
      // Khôi phục trạng thái 3D (không hiệu ứng) rồi mới lật ngược lại
      flip.classList.add('no-anim');
      flip.classList.remove('is-settled');
      void flip.offsetWidth;
      flip.classList.remove('no-anim');
      requestAnimationFrame(() => flip.classList.remove('is-flipped'));
    } else {
      flip.classList.add('is-flipped');
      if (!state.learned.has(state.lesson)) {
        state.learned.add(state.lesson);
        $(device, 'learnProgress').innerHTML = `${icon('i-star')}${2 + state.learned.size}/12 bài`;
      }
    }
  }

  /* ---------- 18. GALLERY VIEW ---------- */
  let template = null;

  const GALLERY = [
    { code: '01_TrangChu', name: 'Trang chủ & Kiểm tra nhanh', screen: 'home' },
    { code: '01_TrangChu · Lỗi', name: 'Error State – nhập sai định dạng', screen: 'home',
      setup: (r) => { setInputValue(r, '09123'); setError(r, validate('09123')); } },
    { code: '01_TrangChu · Quét tệp', name: 'Quét tệp – đang phân tích VirusTotal', screen: 'home',
      setup: (r) => {
        setFileChip(r, { name: DEMO_FILE_RESULT.name, size: DEMO_FILE_RESULT.size });
        $(r, 'omni').classList.add('is-file-scanning');
        setScanStep(r, 'analyze', 70);
      } },
    { code: '02_KetQua · Nguy hiểm', name: 'Kết quả – mức Đỏ, kèm báo cáo cộng đồng', screen: 'result',
      setup: (r) => { renderResult(r, 'danger', SAMPLES.police.text); renderCommunity(r, MOCK_WARNINGS[0]); } },
    { code: '02_KetQua · Nghi ngờ', name: 'Kết quả – mức Vàng', screen: 'result',
      setup: (r) => renderResult(r, 'warning', SAMPLES.gift.text) },
    { code: '02_KetQua · An toàn', name: 'Kết quả – mức Xanh', screen: 'result',
      setup: (r) => renderResult(r, 'safe', SAMPLES.safe.text) },
    { code: '02_KetQua · Tệp', name: 'Kết quả quét tệp VirusTotal', screen: 'result',
      setup: (r) => renderFileResult(r, DEMO_FILE_RESULT) },
    { code: '03_HoiNguoiThan', name: 'Bottom sheet – danh sách người thân', screen: 'result',
      setup: (r) => { renderResult(r, 'danger', SAMPLES.police.text); openStaticSheet(r, 'family'); } },
    { code: '03_HoiNguoiThan · Trống', name: 'Empty State – chưa có người thân', screen: 'result',
      setup: (r) => { renderResult(r, 'danger', SAMPLES.police.text); renderFamilySheet(r, []); openStaticSheet(r, 'family'); } },
    { code: '04_BaoCao', name: 'Gửi báo cáo – loại, nội dung, nơi nhận', screen: 'report',
      setup: (r) => { selectReportType(r, 'phone'); $(r, 'reportTarget').value = '0857 219 446'; $(r, 'reportText').value = 'Gọi tự xưng cán bộ điện lực, đòi chuyển khoản ngay kẻo cắt điện.'; } },
    { code: '04_BaoCao · Hoàn tất', name: 'Báo cáo – đã gửi tới máy chủ, cán bộ, người thân', screen: 'report',
      setup: (r) => { renderReportDone(r, 'sent', { code: 'DN-2411-0482', recipients: { server: true, officials: true, family: ['Minh Anh', 'Hoàng Nam'] } }); setReportDone(r, true); } },
    { code: '04_BaoCao · Lưu tạm', name: 'Báo cáo – mất mạng, chờ gửi', screen: 'report',
      setup: (r) => { renderReportDone(r, 'queued', { recipients: { server: true, officials: true, family: [] } }); setReportDone(r, true); } },
    { code: '05_BaiHoc', name: 'Bài học – mặt trước thẻ', screen: 'learn',
      setup: (r) => renderLesson(r, 0, false) },
    { code: '05_BaiHoc · Mặt sau', name: 'Bài học – 3 bước xử lý', screen: 'learn',
      setup: (r) => renderLesson(r, 0, true) },
    { code: '06_ThiThu', name: 'Thi thử (trong Bài học) – câu hỏi', screen: 'quiz',
      setup: (r) => renderQuiz(r, 0, null, 0) },
    { code: '06_ThiThu · Giải thích', name: 'Thi thử – highlight bẫy & giải thích', screen: 'quiz',
      setup: (r) => renderQuiz(r, 0, 'scam', 20) },
    { code: '07_TinhNguyen', name: 'Dashboard đội tình nguyện', screen: 'volunteer' },
    { code: '07_TinhNguyen · Kiểm duyệt', name: 'Đọc & duyệt báo cáo vào danh sách cảnh báo', screen: 'volunteer',
      setup: (r) => { r.querySelector('.kpi-grid').style.display = 'none'; renderModeration(r, MOCK_PENDING, true); } },
    { code: '07_TinhNguyen · Ảnh', name: 'Xuất ảnh tuyên truyền nhanh', screen: 'volunteer',
      setup: (r) => openStaticSheet(r, 'poster') },
    { code: '08_CaiDat', name: 'Cài đặt – chạy ngầm, hiển thị, người thân', screen: 'settings' },
    { code: '08_CaiDat · Thêm người thân', name: 'Form thêm người thân – lỗi số điện thoại', screen: 'settings',
      setup: (r) => {
        fillContactForm(r, null);
        $(r, 'contactName').value = 'Nguyễn Thu Hà';
        setContactRel(r, 'Cháu');
        $(r, 'contactPhone').value = '0912 345';
        showFieldError(r, 'phone', 'Số điện thoại chưa đúng. Nhập 10 chữ số, bắt đầu bằng 0 (VD: 0912 345 678).');
        openStaticSheet(r, 'contact');
      } }
  ];

  function openStaticSheet(root, mode) {
    $(root, 'sheet').dataset.mode = mode;
    $(root, 'sheetLayer').classList.add('is-open');
  }

  function buildGallery() {
    galleryGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    GALLERY.forEach((item, i) => {
      const clone = template.cloneNode(true);
      clone.removeAttribute('id');
      $$(clone, '[id]').forEach((n) => n.removeAttribute('id'));
      $$(clone, '[for]').forEach((n) => n.removeAttribute('for'));
      $$(clone, 'button, textarea, input, a').forEach((n) => n.setAttribute('tabindex', '-1'));
      clone.setAttribute('aria-hidden', 'true');
      clone.classList.add('is-static');
      clone.classList.toggle('is-senior', state.senior);
      clone.classList.toggle('is-offline', state.offline);
      $(clone, 'clock').textContent = '9:41';
      renderFamilySheet(clone, DEFAULT_FAMILY);
      renderSettings(clone, DEFAULT_SETTINGS, DEFAULT_FAMILY);
      renderServerStatus(clone);
      setScreen(clone, item.screen);
      if (item.setup) item.setup(clone);

      const card = document.createElement('figure');
      card.className = 'g-card';
      card.style.animationDelay = `${Math.min(i, 10) * 0.03}s`;
      card.innerHTML = `
        <figcaption class="g-label">
          <span class="g-code">${item.code}</span>
          <span class="g-name">${item.name}</span>
        </figcaption>
        <div class="g-frame"></div>`;
      card.querySelector('.g-frame').appendChild(clone);
      frag.appendChild(card);
    });
    galleryGrid.appendChild(frag);
    galleryMeta.textContent = `${GALLERY.length} màn hình & trạng thái – Hiển thị: ${state.senior ? 'Người cao tuổi (A+)' : 'Tiêu chuẩn'} – Mạng: ${state.offline ? 'Ngoại tuyến' : 'Trực tuyến'}`;
  }

  function toggleGallery(force) {
    const on = typeof force === 'boolean' ? force : !state.gallery;
    state.gallery = on;
    if (on) {
      stopMic(false);
      stopListen();
      buildGallery();
    }
    workspace.classList.toggle('is-gallery', on);
    gallery.hidden = !on;
    const label = inspector.querySelector('.ins-gallery-btn strong');
    if (label) label.textContent = on ? 'Về chế độ Prototype' : 'Xem tất cả màn hình';
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (isMobile()) inspector.classList.remove('is-open');
    if (!on) fitDevice();
  }

  /* ---------- 19. ACTIONS (event delegation) ---------- */
  const familyById = (id) => state.family.find((f) => f.id === id);

  const ACTIONS = {
    go: (el) => go(el.dataset.target),
    back: () => go(state.prevScreen && state.prevScreen !== 'settings' ? state.prevScreen : 'home'),
    'toggle-senior': toggleSenior,
    'toggle-offline': toggleOffline,
    'toggle-empty': () => {
      if (state.gallery) toggleGallery(false);
      toggleEmpty();
      if (state.emptyOverride) openSheet('family');
    },
    'set-level': (el) => {
      if (state.gallery) toggleGallery(false);
      state.level = el.dataset.level;
      state.resultKind = 'text';
      state.checkedText = SAMPLE_BY_LEVEL[state.level].text;
      renderResult(device, state.level, state.checkedText);
      syncLevelButtons();
      go('result');
      const v = $(device, 'verdict');
      v.classList.remove('is-refresh');
      void v.offsetWidth;
      v.classList.add('is-refresh');
    },
    'edge-error': () => {
      if (state.gallery) toggleGallery(false);
      go('home');
      stopTyping();
      clearFile();
      setInputValue(device, '09123');
      setTimeout(runCheck, 220);
    },
    'edge-file': () => {
      if (state.gallery) toggleGallery(false);
      go('home');
      const sample = new File([new Uint8Array(2048).map((_, i) => (i * 37) % 251)], DEMO_FILE_RESULT.name, { type: 'application/vnd.android.package-archive' });
      chooseFile(sample);
      setTimeout(() => runFileScan(sample, { demo: true }), 350);
    },
    gallery: () => toggleGallery(),
    print: () => window.print(),

    check: runCheck,
    'clear-input': () => { stopTyping(); setInputValue(device, ''); setError(device, null); ui.omniInput.focus(); },
    'paste-sample': () => {
      const keys = ['police', 'gift', 'safe'];
      const s = SAMPLES[keys[state.sampleCursor % keys.length]];
      state.sampleCursor += 1;
      stopMic(false);
      clearFile();
      typeInto(s.text);
    },
    'pick-file': () => ui.fileInput.click(),
    'clear-file': clearFile,
    'cancel-scan': () => {
      if (state.scanToken) state.scanToken.cancelled = true;
      endScan();
      toast({ type: 'info', title: 'Đã huỷ quét tệp', iconId: 'i-x' });
    },
    mic: () => {
      if (ui.omni.classList.contains('is-listening')) { stopMic(true); return; }
      clearFile();
      startMic();
    },

    listen: () => (ui.listen.classList.contains('is-playing') ? stopListen() : startListen()),
    'open-family': () => openSheet('family'),
    'close-sheet': closeSheet,
    'send-family': (el) => {
      if (el.classList.contains('is-sent')) return;
      const f = familyById(el.dataset.id);
      if (!f) return;
      el.classList.add('is-sent');
      el.querySelector('.fr-send use').setAttribute('href', '#i-check');
      toast({
        type: 'success',
        title: `Đã gửi cảnh báo tới ${esc(f.name)} (${esc(f.rel)})${state.offline ? ' qua SMS' : ''}`,
        desc: `Kèm nội dung: “${esc(truncate(state.checkedText, 70))}”`
      });
      setTimeout(closeSheet, 900);
    },
    'call-family': (el) => {
      const f = familyById(el.dataset.id);
      if (!f) return;
      toast({
        type: 'info',
        title: `Đang gọi ${esc(f.name)} – ${formatPhone(f.phone)}`,
        desc: state.offline ? 'Gọi qua sóng di động thường, không cần Internet.' : 'Cuộc gọi sẽ mở trong ứng dụng Điện thoại.',
        iconId: 'i-phone'
      });
    },
    'add-contact': (el) => openContactForm(null, el.dataset.from),
    'edit-contact': (el) => openContactForm(el.dataset.id, 'settings'),
    'pick-rel': (el) => {
      state.contactRel = el.dataset.rel;
      setContactRel(device, state.contactRel);
      $(device, 'relError').classList.remove('is-visible');
    },
    'delete-contact': deleteContact,

    'toggle-background': () => {
      state.settings.background = !state.settings.background;
      store.set('lcs.settings', state.settings);
      renderSettings(device, state.settings, state.family);
      toast(state.settings.background
        ? { type: 'success', title: 'Đã bật bảo vệ chạy ngầm', desc: 'Lá Chắn Số sẽ cảnh báo cả khi bạn không mở ứng dụng.', iconId: 'i-shield-check' }
        : { type: 'info', title: 'Đã tắt bảo vệ chạy ngầm', desc: 'Bạn chỉ được bảo vệ khi đang mở ứng dụng.', iconId: 'i-shield' });
    },
    'toggle-option': (el) => {
      const key = el.dataset.option;
      state.settings[key] = !state.settings[key];
      store.set('lcs.settings', state.settings);
      renderSettings(device, state.settings, state.family);
    },
    'flush-queue': () => flushQueue(),

    'report-type': (el) => { state.reportType = el.dataset.type; selectReportType(device, state.reportType); },
    'toggle-recipient': (el) => {
      const k = el.dataset.recipient;
      state.recipients[k] = !state.recipients[k];
      el.setAttribute('aria-checked', String(state.recipients[k]));
      $(device, 'reportError').classList.remove('is-visible');
    },
    'report-pick-file': () => ui.reportFileInput.click(),
    'mod-expand': (el) => el.classList.toggle('is-open'),
    moderate: (el) => moderate(el),
    'report-submit': submitReport,
    'report-reset': () => { resetReport(); ui.viewport.scrollTo({ top: 0, behavior: 'auto' }); },

    flip: flipCard,
    'pick-lesson': (el) => {
      state.lesson = Number(el.dataset.index);
      renderLesson(device, state.lesson, false);
      const flip = $(device, 'flip');
      flip.classList.remove('is-swapping');
      void flip.offsetWidth;
      flip.classList.add('is-swapping');
      ui.viewport.scrollTo({ top: 0, behavior: 'smooth' });
    },

    answer: (el) => answerQuiz(el.dataset.choice),
    'quiz-next': nextQuiz,
    'quiz-restart': restartQuiz,

    'export-poster': () => {
      ui.exportBtn.classList.add('is-loading');
      setTimeout(() => {
        ui.exportBtn.classList.remove('is-loading');
        openSheet('poster');
      }, 850);
    },
    'poster-save': () => {
      closeSheet();
      toast({ type: 'success', title: 'Đã lưu ảnh vào Thư viện', desc: 'canh-bao-dien-luc-tam-hiep.png – 1080 × 1350', iconId: 'i-image' });
    },
    'poster-share': () => toast({ type: 'info', title: 'Đã mở bảng chia sẻ', desc: 'Gửi vào nhóm khu phố, tổ dân phố.', iconId: 'i-share' })
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.closest('.g-frame')) return;
    if (el.disabled) return;
    const fn = ACTIONS[el.dataset.action];
    if (fn) fn(el, e);
  });

  /* Input trang chủ */
  ui.omniInput.addEventListener('input', () => {
    ui.omni.classList.toggle('has-value', ui.omniInput.value.length > 0);
    if (ui.omni.classList.contains('is-error')) setError(device, null);
  });
  ui.omniInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runCheck(); }
  });
  ui.fileInput.addEventListener('change', () => {
    const f = ui.fileInput.files && ui.fileInput.files[0];
    if (f) chooseFile(f);
    ui.fileInput.value = ''; // cho phép chọn lại cùng một tệp
  });

  ui.reportFileInput.addEventListener('change', () => {
    const f = ui.reportFileInput.files && ui.reportFileInput.files[0];
    if (f) pickReportFile(f);
    ui.reportFileInput.value = '';
  });
  ui.reportTarget.addEventListener('input', clearTargetError);
  $(device, 'modLogin').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $(device, 'modToken').value.trim();
    if (!v) { showModError('Nhập mã kiểm duyệt.'); return; }
    modToken.set(v);
    $(device, 'modToken').value = '';
    loadModeration();
  });

  /* Kéo thả tệp vào khung kiểm tra */
  ui.omni.addEventListener('dragover', (e) => { e.preventDefault(); ui.omni.classList.add('is-drop'); });
  ui.omni.addEventListener('dragleave', () => ui.omni.classList.remove('is-drop'));
  ui.omni.addEventListener('drop', (e) => {
    e.preventDefault();
    ui.omni.classList.remove('is-drop');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) chooseFile(f);
  });

  /* Form người thân */
  ui.contactForm.addEventListener('submit', (e) => { e.preventDefault(); submitContact(); });
  ui.contactName.addEventListener('input', () => { $(device, 'nameWrap').classList.remove('is-error'); $(device, 'nameError').classList.remove('is-visible'); });
  ui.contactPhone.addEventListener('input', () => { $(device, 'phoneWrap').classList.remove('is-error'); $(device, 'phoneError').classList.remove('is-visible'); });

  /* Thẻ lật: khi lật xong thì "hạ" lớp 3D để chữ sắc nét */
  $(device, 'flipInner').addEventListener('transitionend', (e) => {
    if (e.propertyName !== 'transform') return;
    const flip = $(device, 'flip');
    if (flip.classList.contains('is-flipped')) flip.classList.add('is-settled');
  });

  /* Biểu đồ: hover/chạm */
  const donutSvg = $(device, 'donut');
  const legendEl = $(device, 'legend');
  const chartIndex = (t) => {
    const n = t.closest('[data-index]');
    return n ? Number(n.dataset.index) : null;
  };
  [donutSvg, legendEl].forEach((el) => {
    el.addEventListener('mouseover', (e) => { const i = chartIndex(e.target); if (i !== null) focusChart(device, i); });
    el.addEventListener('mouseleave', () => focusChart(device, null));
    el.addEventListener('click', (e) => { const i = chartIndex(e.target); if (i !== null) focusChart(device, i); });
  });

  /* Inspector trên di động */
  document.getElementById('insFab').addEventListener('click', () => inspector.classList.add('is-open'));
  document.getElementById('insClose').addEventListener('click', () => inspector.classList.remove('is-open'));

  /* Phím tắt */
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.key === 'Escape') {
      if (state.sheetOpen) closeSheet();
      else if (state.gallery) toggleGallery(false);
      else inspector.classList.remove('is-open');
      return;
    }
    if (tag === 'textarea' || tag === 'input' || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (/^[1-7]$/.test(k)) {
      if (state.gallery) toggleGallery(false);
      go(SCREEN_ORDER[Number(k) - 1]);
    } else if (k === 'g') toggleGallery();
    else if (k === 'a') toggleSenior();
    else if (k === 'o') toggleOffline();
  });

  /* Mạng thật quay lại → gửi hàng đợi */
  window.addEventListener('online', () => flushQueue({ silent: true }));

  /* ---------- 20. CO GIÃN KHUNG MÁY & ĐỒNG HỒ ---------- */
  function fitDevice() {
    if (isMobile()) {
      deviceWrap.style.setProperty('--dscale', '1');
      return;
    }
    const availH = window.innerHeight - 48 - 26 - 18 - 36 - 28;
    const availW = stage.clientWidth - 48 - 28;
    const s = Math.max(0.55, Math.min(1, availH / 844, availW / 390));
    deviceWrap.style.setProperty('--dscale', s.toFixed(3));
  }
  window.addEventListener('resize', fitDevice);

  function tickClock() {
    const d = new Date();
    $(device, 'clock').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  window.addEventListener('beforeprint', () => { if (!state.gallery) toggleGallery(true); });

  /* ---------- 21. KHỞI TẠO ---------- */
  function init() {
    renderResult(device, state.level, state.checkedText);
    renderLesson(device, 0, false);
    renderQuiz(device, 0, null, 0);
    renderChart(device);
    renderFamilySheet(device, state.family);
    renderSettings(device, state.settings, state.family);
    renderServerStatus(device);
    resetReport();
    renderModeration(device, demoPending, true);
    template = device.cloneNode(true);

    syncToggles();
    syncLevelButtons();
    updateStageLabel();
    fitDevice();
    tickClock();
    setInterval(tickClock, 30000);
    detectServer();
  }

  init();
})();
