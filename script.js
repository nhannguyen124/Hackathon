/* =============================================================
   LÁ CHẮN SỐ – Clickable Prototype & Client (v2.0)
   - Giao diện tối ưu vừa khít màn hình điện thoại, trang 1 tinh gọn.
   - Gộp Thi thử vào Bài học; thêm trang Báo cáo đa kênh (Người thân,
     Cán bộ, Máy chủ) cho SĐT, trang web, mã file độc, tài khoản/SMS.
   - Máy chủ tổng hợp Danh sách cảnh báo; đối chiếu & đọc báo cáo
     (cả hiển thị toàn văn lẫn giọng đọc tiếng Việt TTS) khi kiểm tra
     và khi cán bộ kiểm duyệt.
   - Chế độ Người cao tuổi tối giản triệt để những chức năng phức tạp.
   ============================================================= */
(() => {
  'use strict';

  /* ---------- 1. HELPERS ---------- */
  const $ = (root, ref) => root.querySelector(`[data-ref="${ref}"]`);
  const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));
  const icon = (id, cls = '') => `<svg class="ic ${cls}"><use href="#${id}"/></svg>`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stripHtml = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  const isMobile = () => window.matchMedia('(max-width: 860px)').matches;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* bộ nhớ bị chặn */ }
    }
  };

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  }

  function formatTimeAgo(iso) {
    if (!iso) return 'Vừa xong';
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  }

  const normalizePhone = (raw) => String(raw || '').replace(/[\s.\-()]/g, '').replace(/^\+?84/, '0');
  const isValidPhone = (p) => /^0(3|5|7|8|9)\d{8}$/.test(p) || /^02\d{9}$/.test(p);
  const formatPhone = (p) => (p.length === 10 ? `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}` : p);
  const maskPhone = (p) => (p.length >= 7 ? `${p.slice(0, 4)} •••${p.slice(-3)}` : p);

  function initials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
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

  /* ---------- 2. DỮ LIỆU & MẪU KHỞI TẠO ---------- */
  const SCREENS = {
    home:      { code: '01_TrangChu',  title: 'Trang chủ · Kiểm tra nhanh',      tab: 'check' },
    result:    { code: '02_KetQua',    title: 'Kết quả & Đọc báo cáo',           tab: 'check' },
    report:    { code: '03_BaoCao',    title: 'Gửi báo cáo đa kênh & Máy chủ',   tab: 'report' },
    learn:     { code: '04_BaiHoc',    title: 'Bài học & Thi thử nhận diện',     tab: 'learn' },
    volunteer: { code: '05_KiemDuyet', title: 'Kiểm duyệt & Danh sách cảnh báo', tab: 'volunteer' },
    settings:  { code: '06_CaiDat',    title: 'Cài đặt',                         tab: null }
  };
  const SCREEN_ORDER = ['home', 'result', 'report', 'learn', 'volunteer', 'settings'];

  const TYPE_META = {
    phone:   { label: 'Số điện thoại', icon: 'i-phone', cls: 't-phone', targetLabel: '3. Số điện thoại lừa đảo', placeholder: 'VD: 0916 882 341' },
    web:     { label: 'Trang web / Link', icon: 'i-globe', cls: 't-web', targetLabel: '3. Địa chỉ trang web / đường dẫn', placeholder: 'VD: dienluc-thanhtoan.top hoặc bit.ly/...' },
    malware: { label: 'Mã file độc', icon: 'i-file-warning', cls: 't-malware', targetLabel: '3. Mã file độc (SHA-256) hoặc tên tệp', placeholder: 'Dán mã SHA-256 hoặc bấm Chọn tệp bên dưới…' },
    bank:    { label: 'Tài khoản / SMS', icon: 'i-landmark', cls: 't-bank', targetLabel: '3. Số tài khoản hoặc nguồn phát tán', placeholder: 'VD: STK 190388492011 – Ngân hàng…' },
    sms:     { label: 'Tin nhắn', icon: 'i-message', cls: 't-bank', targetLabel: '3. Số gửi tin nhắn', placeholder: 'VD: +84 857 441 219' }
  };

  const SAMPLES = {
    police: {
      level: 'danger',
      text: 'Tôi là cán bộ Công an tỉnh Đồng Nai gọi từ số 0916 882 341. Tài khoản của bà liên quan đường dây rửa tiền, yêu cầu chuyển gấp vào tài khoản tạm giữ để xác minh, cấm báo cho người nhà.'
    },
    web: {
      level: 'danger',
      text: 'THÔNG BÁO: Hộ gia đình nợ tiền điện 2 tháng, sẽ bị cắt điện sau 2 giờ. Truy cập ngay dienluc-thanhtoan.top để thanh toán.'
    },
    gift: {
      level: 'warning',
      text: 'Chúc mừng quý khách nhận quà tri ân 2.000.000đ. Bấm vào đường dẫn nhận ngay trong hôm nay: bit.ly/qua-tri-an-dn'
    },
    safe: { level: 'safe', text: '0912 345 678' }
  };
  const SAMPLE_BY_LEVEL = { danger: SAMPLES.police, warning: SAMPLES.gift, safe: SAMPLES.safe };
  const VOICE_TRANSCRIPT = 'Có số 0916 882 341 tự xưng công an gọi bảo tôi chuyển tiền gấp để xác minh tài khoản, không được nói với con cháu.';
  const REPORT_VOICE_TRANSCRIPT = 'Số điện thoại lạ gọi tự xưng cán bộ điện lực doạ cắt điện, ép tôi bấm vào trang web lạ để nộp tiền.';

  const RESULTS = {
    danger: {
      icon: 'i-shield-alert', badge: 'Nguy hiểm',
      title: 'Có dấu hiệu lừa đảo rõ rệt',
      sub: 'Dừng lại ngay – không chuyển tiền, không đọc mã OTP.',
      conf: 'Độ tin cậy 96%',
      reasons: [
        'Phát hiện kịch bản <mark>giả danh cơ quan chức năng / điện lực</mark> gây hoang mang để ép chuyển tiền.',
        'Thúc giục khẩn cấp (<mark>chuyển gấp</mark>, <mark>cắt điện sau 2 giờ</mark>) và ngăn cản hỏi ý kiến người thân.',
        'Cơ quan Công an, Ngân hàng, Điện lực <strong>không bao giờ</strong> yêu cầu chuyển tiền hay thu phí qua link lạ.'
      ]
    },
    warning: {
      icon: 'i-shield-question', badge: 'Nghi ngờ',
      title: 'Cần xác minh kỹ trước khi làm theo',
      sub: 'Chưa bấm vào đường dẫn, chưa nhập mật khẩu hay OTP.',
      conf: 'Độ tin cậy 84%',
      reasons: [
        'Chứa <mark>đường dẫn rút gọn</mark> hoặc tên miền lạ che giấu địa chỉ trang web thật.',
        'Dùng mồi nhử <mark>nhận quà tri ân / việc nhẹ lương cao</mark> kèm giới hạn thời gian gấp.',
        'Hãy bấm <strong>Hỏi người thân</strong> hoặc kiểm tra với đơn vị chính thức trước.'
      ]
    },
    safe: {
      icon: 'i-shield-check', badge: 'An toàn',
      title: 'Chưa ghi nhận trong danh sách cảnh báo',
      sub: 'Vẫn cảnh giác nếu đối phương hối thúc chuyển tiền hoặc hỏi OTP.',
      conf: 'Độ tin cậy 92%',
      reasons: [
        'Chưa có báo cáo tiêu cực trong <strong>Danh sách cảnh báo máy chủ Đồng Nai</strong>.',
        'Không phát hiện đường dẫn giả mạo hay mã độc đã biết.',
        'Nếu bất ngờ bị yêu cầu <mark>chuyển tiền gấp</mark>, hãy gọi điện xác minh trực tiếp.'
      ]
    }
  };

  /* Dữ liệu báo cáo mẫu đồng bộ với server.js khi chạy chế độ demo/ngoại tuyến */
  const INITIAL_REPORTS = [
    {
      id: 1, code: 'DN-2311-0101', type: 'phone', targetValue: '0916882341', fileName: '', fileHash: '',
      content: 'Đối tượng tự xưng cán bộ Công an tỉnh Đồng Nai gọi từ số 0916 882 341 thông báo tài khoản liên quan đường dây rửa tiền, yêu cầu chuyển gấp 35 triệu đồng vào tài khoản tạm giữ và cấm báo cho người nhà.',
      channels: ['server', 'officer'], ward: 'Phường Tam Hiệp', forwardPolice: true, riskLevel: 'danger',
      status: 'verified', reportCount: 14,
      reviewerNote: 'Đã xác minh trùng khớp kịch bản giả danh cơ quan điều tra tại Biên Hòa.',
      createdAt: '2026-11-23T08:30:00.000Z'
    },
    {
      id: 2, code: 'DN-2311-0102', type: 'web', targetValue: 'dienluc-thanhtoan.top', fileName: '', fileHash: '',
      content: 'Tin nhắn giả danh Điện lực Đồng Nai báo nợ tiền điện 2 tháng, đe doạ cắt điện trong 2 giờ tới và ép bấm vào trang web dienluc-thanhtoan.top để thanh toán trực tuyến.',
      channels: ['server', 'officer'], ward: 'Phường Tam Hiệp', forwardPolice: true, riskLevel: 'danger',
      status: 'verified', reportCount: 9,
      reviewerNote: 'Tên miền giả mạo ngành điện, thu thập thông tin thẻ và chiếm quyền thiết bị.',
      createdAt: '2026-11-23T10:15:00.000Z'
    },
    {
      id: 3, code: 'DN-2311-0103', type: 'malware',
      targetValue: '9f2c4e81b7a05d36e1c8f4a2b9d07e53c6a18f20d4b97e6a3c5f81e02d9b7a46',
      fileName: 'nhan-qua-tri-an.apk',
      fileHash: '9f2c4e81b7a05d36e1c8f4a2b9d07e53c6a18f20d4b97e6a3c5f81e02d9b7a46',
      content: 'Tệp cài đặt Android nhan-qua-tri-an.apk gửi qua tin nhắn mạo danh chương trình tri ân khách hàng. Khi cài đặt đòi quyền Trợ năng để tự động đọc mã OTP ngân hàng.',
      channels: ['server', 'officer'], ward: 'Phường Trấn Biên', forwardPolice: true, riskLevel: 'danger',
      status: 'verified', reportCount: 7,
      reviewerNote: 'Mã độc Trojan-Banker.AndroidOS đã xác nhận trên VirusTotal (38/66 công cụ).',
      createdAt: '2026-11-23T13:20:00.000Z'
    },
    {
      id: 4, code: 'DN-2311-0104', type: 'bank', targetValue: '190388492011', fileName: '', fileHash: '',
      content: 'Chiếm đoạt tài khoản mạng xã hội của người quen rồi nhắn tin báo đang cấp cứu tại bệnh viện, yêu cầu chuyển gấp 10 triệu đồng vào STK lạ 190388492011 và từ chối nghe gọi video.',
      channels: ['server', 'officer', 'family'], ward: 'Phường Hố Nai', forwardPolice: true, riskLevel: 'danger',
      status: 'verified', reportCount: 5,
      reviewerNote: 'Tài khoản nhận tiền trung gian đã bị nhiều người dân phản ánh.',
      createdAt: '2026-11-23T15:05:00.000Z'
    },
    {
      id: 5, code: 'DN-2411-0105', type: 'phone', targetValue: '0857441219', fileName: '', fileHash: '',
      content: 'Số điện thoại lạ 0857 441 219 nhắn tin mời học sinh THPT làm cộng tác viên đặt đơn hàng online việc nhẹ lương cao 500.000đ/ngày, dẫn vào nhóm đóng tiền cọc nhận nhiệm vụ.',
      channels: ['server', 'officer'], ward: 'Phường Hố Nai', forwardPolice: true, riskLevel: 'warning',
      status: 'pending', reportCount: 3, reviewerNote: '',
      createdAt: '2026-11-24T01:10:00.000Z'
    },
    {
      id: 6, code: 'DN-2411-0106', type: 'web', targetValue: 'bit.ly/qua-tri-an-dn', fileName: '', fileHash: '',
      content: 'Đường dẫn rút gọn bit.ly/qua-tri-an-dn thông báo trúng quà tri ân 2.000.000đ trong ngày, yêu cầu người cao tuổi điền số CCCD, số thẻ và mã OTP để nhận tiền thưởng.',
      channels: ['server', 'officer', 'family'], ward: 'Xã Long Thành', forwardPolice: true, riskLevel: 'danger',
      status: 'pending', reportCount: 2, reviewerNote: '',
      createdAt: '2026-11-24T02:25:00.000Z'
    },
    {
      id: 7, code: 'DN-2411-0107', type: 'malware',
      targetValue: '4a7d1ed414474e4033ac29ccb8653d9b8e12c34f9076a51b2c8e190fa34d2109',
      fileName: 'hoa-don-dien-tu-T11.scr',
      fileHash: '4a7d1ed414474e4033ac29ccb8653d9b8e12c34f9076a51b2c8e190fa34d2109',
      content: 'Tệp đính kèm hoa-don-dien-tu-T11.scr giả dạng file PDF hoá đơn điện tử gửi cho hộ kinh doanh tại Trảng Bom. Nghi ngờ chứa mã thực thi đánh cắp dữ liệu máy tính.',
      channels: ['server', 'officer'], ward: 'Xã Trảng Bom', forwardPolice: false, riskLevel: 'danger',
      status: 'pending', reportCount: 1, reviewerNote: '',
      createdAt: '2026-11-24T03:05:00.000Z'
    }
  ];

  const LESSONS = [
    {
      icon: 'i-shield-alert', tone: 't-danger', tag: 'Phổ biến nhất tại Đồng Nai',
      title: 'Giả danh Công an yêu cầu chuyển tiền',
      quote: '“Tài khoản của bác liên quan vụ án rửa tiền. Chuyển gấp vào tài khoản tạm giữ để xác minh.”',
      steps: [
        ['Cúp máy ngay lập tức', 'Công an không làm việc, không đòi tiền qua điện thoại.'],
        ['Không chuyển tiền, không đọc OTP', 'Dù bị doạ bắt giữ hay yêu cầu giữ bí mật.'],
        ['Bấm gọi người thân hoặc Công an xã', 'Sau đó gửi báo cáo số điện thoại trên Lá Chắn Số.']
      ]
    },
    {
      icon: 'i-gift', tone: 't-warning', tag: 'Tăng mạnh dịp cuối năm',
      title: 'Trang web giả điện lực & quà tri ân',
      quote: '“Hộ gia đình sẽ bị cắt điện sau 2 giờ nếu không bấm vào link thanh toán ngay.”',
      steps: [
        ['Tuyệt đối không bấm trang web lạ', 'Tên miền .top, .xyz, bit.ly không phải trang nhà nước.'],
        ['Không cài đặt tệp .apk gửi qua tin nhắn', 'Tệp lạ có thể tự đọc mã OTP chiếm đoạt tiền.'],
        ['Dán đường dẫn vào mục Kiểm tra', 'Đối chiếu ngay với Danh sách cảnh báo máy chủ.']
      ]
    },
    {
      icon: 'i-briefcase', tone: 't-blue', tag: 'Nhắm vào học sinh, sinh viên',
      title: 'Tuyển CTV đặt đơn hàng việc nhẹ lương cao',
      quote: '“Làm tại nhà 1–2 giờ/ngày, thu nhập 500k, hoàn tiền gốc và hoa hồng sau 5 phút.”',
      steps: [
        ['Không nộp tiền cọc nhận nhiệm vụ', 'Việc làm thật không bao giờ bắt đóng tiền trước.'],
        ['Tỉnh táo với tiền thưởng mồi nhử', 'Trả thưởng vài đơn nhỏ để lừa nạp số tiền lớn.'],
        ['Báo cáo SĐT & trang web lên máy chủ', 'Giúp cảnh báo sớm cho các bạn học sinh khác.']
      ]
    },
    {
      icon: 'i-heart-pulse', tone: 't-sos', tag: 'Đánh vào tâm lý hoảng loạn',
      title: 'Giả người thân gặp nạn mượn tiền gấp',
      quote: '“Con đang cấp cứu ở bệnh viện, chuyển gấp 20 triệu vào STK mới này, đừng gọi máy bận.”',
      steps: [
        ['Bình tĩnh gọi lại số điện thoại quen', 'Không gọi qua tài khoản mạng xã hội vừa nhắn.'],
        ['Kiểm tra tên chủ tài khoản nhận tiền', 'Lừa đảo luôn dùng tài khoản tên người lạ.'],
        ['Bấm nút Hỏi người thân trên ứng dụng', 'Liên hệ người nhà xác minh chéo ngay lập tức.']
      ]
    }
  ];

  const QUIZ = [
    {
      sender: '+84 857 ••• 219', sub: 'Không có trong danh bạ', avatar: '?', contact: false, time: 'Hôm nay 08:15',
      text: 'Chào bạn! Bên mình tuyển CTV [[việc nhẹ lương cao]], làm 1–2 giờ/ngày thu nhập [[500k/ngày]], [[nhận lương ngay]]. Đăng ký tại [[bit.ly/viec-nhe-500k]]',
      answer: 'scam',
      explain: 'Chiêu <b>tuyển CTV chốt đơn ảo</b> nhắm vào học sinh:',
      points: ['Hứa hẹn thu nhập cao bất thường', 'Dùng link rút gọn che giấu trang giả mạo', 'Sau vài đơn nhỏ sẽ bắt nạp tiền triệu rồi khoá tài khoản']
    },
    {
      sender: 'NH-ThongBao', sub: 'Thương hiệu đã xác thực', avatar: 'NH', contact: true, time: 'Hôm nay 09:02',
      text: 'Mã OTP của Quý khách là 482913, hiệu lực 3 phút. [[Tuyệt đối KHÔNG cung cấp mã OTP cho bất kỳ ai]], kể cả nhân viên ngân hàng.',
      answer: 'safe',
      explain: 'Tin OTP chuẩn: <b>không chứa đường dẫn lạ</b> và cảnh báo rõ không chia sẻ mã. Chỉ nhập khi chính bạn đang giao dịch.',
      points: []
    },
    {
      sender: '+84 789 ••• 031', sub: 'Số lạ ngoài danh bạ', avatar: '?', contact: false, time: 'Hôm qua 19:40',
      text: 'THÔNG BÁO: Gia đình nợ tiền điện, [[sẽ bị cắt điện trong 2 giờ tới]]. Vui lòng [[thanh toán ngay tại]] [[dienluc-thanhtoan.top]]',
      answer: 'scam',
      explain: '<b>Giả danh nhân viên điện lực</b>:',
      points: ['Doạ cắt điện gấp để gây hoảng sợ', 'Tên miền “.top” giả mạo, đã nằm trong Danh sách cảnh báo máy chủ']
    },
    {
      sender: 'Hoàng Nam', sub: 'Con trai · Trong danh bạ', avatar: 'HN', contact: true, time: 'Hôm nay 17:26',
      text: 'Mẹ ơi tối nay con tăng ca về muộn một chút, mẹ ăn cơm trước nhé. [[Lát 8 giờ con gọi lại mẹ]] ạ.',
      answer: 'safe',
      explain: 'Tin từ số <b>người thân trong danh bạ</b>, nội dung sinh hoạt bình thường, không hối thúc tiền bạc.',
      points: []
    },
    {
      sender: 'Thu Hà', sub: 'Tài khoản mạng xã hội', avatar: 'TH', contact: true, time: 'Hôm nay 21:08',
      text: 'Hà đây, cho mình [[mượn gấp 5 triệu]] đang [[kẹt ở bệnh viện]]. [[Chuyển vào STK mới]] 1903 •••• 7788 nhé, [[đừng gọi]] mình không nghe được.',
      answer: 'scam',
      explain: 'Tài khoản quen có dấu hiệu <b>bị chiếm đoạt</b>:',
      points: ['Mượn tiền gấp kèm lý do cấp cứu', 'Chuyển vào STK tên người lạ', 'Né tránh gọi điện xác nhận giọng nói']
    }
  ];

  const CHART = [
    { name: 'Trang web / Link giả', value: 35, color: '#2563EB' },
    { name: 'SĐT giả danh Công an', value: 26, color: '#EA580C' },
    { name: 'Mã file độc (.apk/.scr)', value: 18, color: '#DC2626' },
    { name: 'Tuyển CTV & STK lừa đảo', value: 13, color: '#16A34A' },
    { name: 'Kịch bản khác', value: 8, color: '#64748B' }
  ];

  const DEFAULT_FAMILY = [
    { id: 'f-minh-anh', name: 'Minh Anh', rel: 'Con gái', phone: '0908123214', color: 1 },
    { id: 'f-hoang-nam', name: 'Hoàng Nam', rel: 'Con trai', phone: '0977450586', color: 2 }
  ];
  const MAX_FAMILY = 5;
  const DEFAULT_SETTINGS = { background: true, calls: true, links: true, files: false, autoRead: false };

  const MAX_FILE_BYTES = 32 * 1024 * 1024;
  const RISKY_EXT = ['apk', 'exe', 'scr', 'bat', 'cmd', 'js', 'vbs', 'msi', 'jar', 'ps1', 'dll'];
  const ARCHIVE_EXT = ['zip', 'rar', '7z', 'docm', 'xlsm', 'pptm', 'iso'];
  const FILE_TEXT = {
    danger:  { title: 'Phát hiện tệp chứa mã độc', sub: 'Tuyệt đối không mở, không cài đặt. Hãy xoá tệp ngay.' },
    warning: { title: 'Tệp có dấu hiệu đáng ngờ', sub: 'Chưa mở tệp khi chưa xác minh rõ người gửi.' },
    safe:    { title: 'Chưa phát hiện mã độc đã biết', sub: 'Vẫn cẩn trọng với tệp từ người lạ.' }
  };
  const DEMO_FILE_RESULT = {
    name: 'nhan-qua-tri-an.apk', size: 2516582, typeDesc: 'Ứng dụng Android (.apk)',
    sha256: '9f2c4e81b7a05d36e1c8f4a2b9d07e53c6a18f20d4b97e6a3c5f81e02d9b7a46',
    level: 'danger', live: false, permalink: null,
    stats: { malicious: 38, suspicious: 2, harmless: 0, undetected: 26 },
    detections: [
      { engine: 'Kaspersky', result: 'Trojan-Banker.AndroidOS.Agent' },
      { engine: 'BitDefender', result: 'Android.Trojan.SpyBanker' },
      { engine: 'ESET-NOD32', result: 'APK/Spy.Banker.VN' },
      { engine: 'Avast', result: 'Android:OtpStealer [Trj]' }
    ]
  };

  /* ---------- 3. TRẠNG THÁI ỨNG DỤNG ---------- */
  const state = {
    screen: 'home',
    prevScreen: 'home',
    senior: false,
    offline: false,
    level: 'danger',
    resultKind: 'text',
    fileResult: null,
    checkedText: SAMPLES.police.text,
    matchedItems: [],

    /* Báo cáo đa kênh */
    channels: new Set(['server', 'officer']),
    selectedFamilyIds: new Set(['f-minh-anh']),
    reportType: 'phone',
    reportWard: 'Phường Tam Hiệp',
    reportFileMeta: null,
    lastCreatedReportId: null,

    /* Bài học & Thi thử (gộp) */
    learnSubtab: 'lesson',
    lesson: 0,
    learned: new Set(),
    quizIndex: 0,
    quizScore: 0,
    quizAnswered: false,

    /* Kiểm duyệt & Danh sách cảnh báo */
    volTab: 'review',
    reviewFilter: 'all',
    watchlistType: 'all',
    watchlistQuery: '',
    reports: store.get('lcs.reports.v2', INITIAL_REPORTS),
    detailTargetReportId: null,
    detailReadText: '',
    detailIsOfficer: true,

    /* Danh bạ người thân & Cài đặt */
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
    sampleCursor: 0,
    gallery: false
  };
  if (!Array.isArray(state.family)) state.family = DEFAULT_FAMILY.slice();
  if (!Array.isArray(state.reports) || !state.reports.length) state.reports = INITIAL_REPORTS.slice();

  const api = { checked: false, online: false, vt: false, db: null };
  const timers = { mic: null, reportMic: null, typing: null, check: null, disarm: null };

  /* ---------- 4. DOM REFERENCES ---------- */
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
    reportFileInput: $(device, 'reportFileInput'),
    checkBtn: $(device, 'checkBtn'),
    listen: $(device, 'listen'),
    listenBar: $(device, 'listenBar'),
    sheetLayer: $(device, 'sheetLayer'),
    sheet: $(device, 'sheet'),
    toastHost: $(device, 'toastHost'),
    reportTarget: $(device, 'reportTarget'),
    reportText: $(device, 'reportText'),
    exportBtn: $(device, 'exportBtn'),
    contactForm: $(device, 'contactForm'),
    contactName: $(device, 'contactName'),
    contactPhone: $(device, 'contactPhone'),
    watchlistSearch: $(device, 'watchlistSearch'),
    reviewerNote: $(device, 'reviewerNote')
  };

  /* ---------- 5. TRÌNH ĐỌC BÁO CÁO BẰNG GIỌNG NÓI (TTS TIẾNG VIỆT) ---------- */
  const audioReader = {
    key: null,
    btn: null,
    bar: null,
    timer: null
  };

  function stopAudio() {
    clearInterval(audioReader.timer);
    audioReader.timer = null;
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch { /* bỏ qua */ }
    }
    if (audioReader.btn) {
      audioReader.btn.classList.remove('is-playing');
      audioReader.btn.setAttribute('aria-pressed', 'false');
    }
    if (audioReader.bar) audioReader.bar.style.width = '0%';
    audioReader.key = null;
    audioReader.btn = null;
    audioReader.bar = null;
  }

  function playAudio({ key, text, btn = null, bar = null, toastTitle = '' }) {
    if (audioReader.key === key) {
      stopAudio();
      return;
    }
    stopAudio();
    const clean = stripHtml(text);
    if (!clean) return;

    audioReader.key = key;
    audioReader.btn = btn;
    audioReader.bar = bar;
    if (btn) {
      btn.classList.add('is-playing');
      btn.setAttribute('aria-pressed', 'true');
    }
    if (bar) bar.style.width = '0%';
    if (toastTitle) {
      toast({ type: 'info', title: toastTitle, desc: truncate(clean, 88), iconId: 'i-volume' });
    }

    const words = clean.split(/\s+/).length;
    const estSeconds = Math.max(5, Math.min(22, words / (state.senior ? 2.7 : 3.3)));
    const startedAt = Date.now();

    audioReader.timer = setInterval(() => {
      const p = Math.min(1, (Date.now() - startedAt) / (estSeconds * 1000));
      if (audioReader.bar) audioReader.bar.style.width = `${(p * 100).toFixed(1)}%`;
      if (p >= 1) stopAudio();
    }, 100);

    if ('speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function') {
      try {
        const utter = new SpeechSynthesisUtterance(clean);
        utter.lang = 'vi-VN';
        utter.rate = state.senior ? 0.9 : 1.0;
        const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
        const viVoice = voices.find((v) => /^vi/i.test(v.lang));
        if (viVoice) utter.voice = viVoice;
        utter.onend = () => {
          // Chỉ dừng theo sự kiện speech nếu giọng đọc thật đã phát trên 1.2 giây
          if (audioReader.key === key && Date.now() - startedAt > 1200) stopAudio();
        };
        window.speechSynthesis.speak(utter);
      } catch { /* fallback sang thanh tiến trình trực quan */ }
    }
  }

  /* ---------- 6. TỔNG HỢP DANH SÁCH CẢNH BÁO & ĐỐI CHIẾU ---------- */
  const URL_RE = /(https?:\/\/|www\.|bit\.ly\/|[a-z0-9-]+\.(com|vn|net|top|xyz|info|link|online|site|org)\b)/i;

  function normalizeTargetKey(type, rawTarget, content, fileHash, fileName) {
    const src = String(rawTarget || '').trim();
    const body = String(content || '').trim();
    if (type === 'malware') {
      const h = String(fileHash || '').trim().toLowerCase();
      if (/^[a-f0-9]{32,64}$/.test(h)) return h;
      const mh = (src + ' ' + body).match(/\b[a-f0-9]{64}\b/i);
      if (mh) return mh[0].toLowerCase();
      return (src || String(fileName || '').trim() || body.slice(0, 60)).toLowerCase();
    }
    if (type === 'phone') {
      const d = normalizePhone(src);
      if (/^0\d{8,10}$/.test(d)) return d;
      const m = body.match(/(?:\+?84|0)(?:[\s.\-]?\d){8,10}/);
      if (m) return normalizePhone(m[0]);
      return src || body.slice(0, 40);
    }
    if (type === 'web') {
      const cand = src || ((body.match(/(?:https?:\/\/|www\.|bit\.ly\/|[a-z0-9-]+\.(?:com|vn|net|top|xyz|info|link|online|site|org)\b)[^\s"<>]*/i) || [])[0] || '');
      return cand.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '') || body.slice(0, 50).toLowerCase();
    }
    if (type === 'bank') {
      const d = src.replace(/[\s.\-]/g, '');
      if (/^\d{8,19}$/.test(d)) return d;
      const m = body.match(/\b\d[\d\s]{7,20}\d\b/);
      if (m) return m[0].replace(/\s+/g, '');
      return src || body.slice(0, 40);
    }
    return src || body.slice(0, 50);
  }

  function buildWatchlistFromReports(reports) {
    const map = new Map();
    const rank = { danger: 3, warning: 2, safe: 1 };
    for (const r of reports) {
      if (!r || r.status === 'dismissed') continue;
      const norm = normalizeTargetKey(r.type, r.targetValue, r.content, r.fileHash, r.fileName);
      if (!norm) continue;
      const key = `${r.type}:${norm}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          type: r.type,
          targetValue: r.targetValue || norm,
          normalizedTarget: norm,
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
        map.set(key, g);
      }
      g.reportCount += Number(r.reportCount) || 1;
      if (r.status === 'verified') {
        g.verified = true;
        g.status = 'verified';
        g.summary = r.content;
      }
      if ((rank[r.riskLevel] || 0) > (rank[g.riskLevel] || 0)) g.riskLevel = r.riskLevel;
      if (String(r.createdAt) > String(g.latestAt)) {
        g.latestAt = r.createdAt;
        if (r.ward) g.ward = r.ward;
      }
      if (!g.fileName && r.fileName) g.fileName = r.fileName;
      if (!g.fileHash && r.fileHash) g.fileHash = r.fileHash;
      g.reports.push(r);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return b.reportCount - a.reportCount;
    });
  }

  function findWatchlistMatches(query, reports = state.reports) {
    const q = String(query || '').trim();
    if (!q) return [];
    const qLower = q.toLowerCase();
    const qCompact = normalizePhone(qLower);
    return buildWatchlistFromReports(reports).filter((it) => {
      const norm = String(it.normalizedTarget || '').toLowerCase();
      if (!norm || norm.length < 4) return false;
      if (it.type === 'phone' || it.type === 'bank') {
        const clean = norm.replace(/[\s.\-()]/g, '');
        return clean.length >= 8 && qCompact.includes(clean);
      }
      if (it.type === 'malware') {
        const fn = String(it.fileName || '').toLowerCase();
        return qLower.includes(norm) || (fn && fn.length >= 5 && qLower.includes(fn));
      }
      return qLower.includes(norm);
    });
  }

  function detectType(text) {
    const t = String(text || '').trim();
    const compact = t.replace(/[\s.\-+()]/g, '');
    if (/^[a-f0-9]{64}$/i.test(compact)) return { key: 'malware', label: 'Mã file SHA-256', icon: 'i-file-warning' };
    if (URL_RE.test(t) && t.length < 90) return { key: 'web', label: 'Trang web / Link', icon: 'i-globe' };
    if (/^\d+$/.test(compact)) {
      if (/^(0|84)\d{9,10}$/.test(compact)) return { key: 'phone', label: 'Số điện thoại', icon: 'i-phone' };
      return { key: 'bank', label: 'Số tài khoản', icon: 'i-landmark' };
    }
    return { key: 'sms', label: 'Tin nhắn / Nội dung', icon: 'i-message' };
  }

  function validateInput(raw) {
    const text = raw.trim();
    if (!text) {
      return state.senior
        ? 'Mời bác nhập số điện thoại lạ hoặc bấm nút NÓI màu xanh để đọc nội dung.'
        : 'Hãy dán số điện thoại (10 số), trang web, số tài khoản, tin nhắn – hoặc chọn “Quét tệp”.';
    }
    const compact = text.replace(/[\s.\-+()]/g, '');
    if (/^\d+$/.test(compact)) {
      if (compact.length < 9) {
        return `Số “${esc(text)}” chưa đủ. Số điện thoại cần 10 chữ số bắt đầu bằng 0 (VD: 0912 345 678); số tài khoản từ 9–19 chữ số.`;
      }
      if (compact.length > 19) return 'Dãy số quá dài. Số tài khoản ngân hàng chỉ gồm 9–19 chữ số.';
      return null;
    }
    if (text.length < 6 && !URL_RE.test(text)) {
      return 'Nội dung quá ngắn để kiểm tra. Hãy nhập đầy đủ số điện thoại, tên trang web hoặc câu tin nhắn.';
    }
    return null;
  }

  function validateFile(file) {
    if (!file) return 'Chưa chọn tệp nào.';
    if (file.size === 0) return `Tệp “${esc(file.name)}” trống (0 byte).`;
    if (file.size > MAX_FILE_BYTES) return `Tệp vượt giới hạn 32 MB (${formatSize(file.size)}).`;
    return null;
  }

  function analyzeText(raw, matches = []) {
    if (matches.length) {
      if (matches.some((m) => m.riskLevel === 'danger' || m.verified)) return 'danger';
      return 'warning';
    }
    const t = raw.toLowerCase();
    const danger = ['công an', 'tạm giữ', 'rửa tiền', 'chuyển tiền', 'chuyển gấp', 'otp', 'bắt giữ', 'điều tra', 'viện kiểm sát', 'tòa án', 'cấp cứu', 'cắt điện', 'dienluc'];
    const warning = ['http', 'bit.ly', '.top', '.xyz', 'link', 'đường dẫn', 'quà', 'tri ân', 'trúng thưởng', 'việc nhẹ', 'ctv', 'hoàn tiền', '.apk', '.scr'];
    if (danger.some((k) => t.includes(k))) return 'danger';
    if (warning.some((k) => t.includes(k))) return 'warning';
    return 'safe';
  }

  function buildResultSpeechText() {
    if (state.resultKind === 'file' && state.fileResult) {
      const f = state.fileResult;
      const ft = FILE_TEXT[f.level];
      const flagged = f.stats.malicious + f.stats.suspicious;
      const total = flagged + f.stats.harmless + f.stats.undetected;
      const matchPart = state.matchedItems.length
        ? ` Tệp này cũng đã bị báo cáo ${state.matchedItems[0].reportCount} lần trên máy chủ cảnh báo Đồng Nai.`
        : '';
      return `Báo cáo kiểm tra tệp ${f.name}. Mức độ: ${RESULTS[f.level].badge}. ${ft.title}. Có ${flagged} trên ${total} công cụ bảo mật cảnh báo nguy hiểm.${matchPart} Khuyến cáo: ${ft.sub}`;
    }
    const r = RESULTS[state.level];
    const matchPart = state.matchedItems.length
      ? ` Cảnh báo từ máy chủ: nội dung này trùng khớp với ${state.matchedItems[0].reportCount} lượt báo cáo tại ${state.matchedItems[0].ward}. Tóm tắt hồ sơ: ${state.matchedItems[0].summary}`
      : '';
    const reasonsText = r.reasons.slice(0, state.senior ? 2 : 3).map((x, i) => `Lý do ${i + 1}: ${stripHtml(x)}`).join(' ');
    return `Báo cáo kết quả kiểm tra: Mức ${r.badge}. ${r.title}. ${r.sub}.${matchPart} ${reasonsText}`;
  }

  /* ---------- 7. RENDERERS (nhận root để dùng chung cho Gallery) ---------- */
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

  function setLearnTab(root, subtab) {
    $$(root, '[data-action="learn-tab"]').forEach((b) => {
      const on = b.dataset.subtab === subtab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    $$(root, '.learn-pane').forEach((p) => p.classList.toggle('is-active', p.dataset.subpane === subtab));
  }

  function setVolTab(root, vtab) {
    $$(root, '[data-action="vol-tab"]').forEach((b) => {
      const on = b.dataset.vtab === vtab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    $$(root, '.vol-pane').forEach((p) => p.classList.toggle('is-active', p.dataset.vpane === vtab));
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

  function renderMatchedCard(root, matches) {
    const card = $(root, 'matchedCard');
    if (!matches || !matches.length) {
      card.hidden = true;
      return;
    }
    const top = matches[0];
    const meta = TYPE_META[top.type] || TYPE_META.phone;
    card.hidden = false;
    $(root, 'matchedCount').textContent = `${top.reportCount} lượt báo`;
    $(root, 'matchedSummary').innerHTML = `<b>${esc(meta.label)}: ${esc(top.fileName || top.targetValue)}</b> (${esc(top.ward)}) – ${esc(truncate(top.summary, 130))}`;
  }

  function renderResult(root, level, text, matches = []) {
    const r = RESULTS[level];
    root.querySelector('[data-screen="result"]').classList.remove('is-file');
    renderVerdict(root, level, r.title, r.sub);
    renderMatchedCard(root, matches);

    const type = detectType(text);
    $(root, 'checkedType').innerHTML = icon(type.icon) + type.label;
    $(root, 'checkedText').textContent = text;

    const aiCard = root.querySelector('.ai-card');
    aiCard.dataset.level = level;
    $(root, 'conf').textContent = r.conf;

    const customReasons = matches.length
      ? [`Đã bị cộng đồng báo cáo <strong>${matches[0].reportCount} lần</strong> trong Danh sách cảnh báo máy chủ (${esc(matches[0].ward)}).`, ...r.reasons.slice(0, 2)]
      : r.reasons;
    $(root, 'reasons').innerHTML = customReasons.map((h, i) => `<li data-n="${i + 1}">${h}</li>`).join('');
    setShare(root, level, text);
  }

  function renderFileResult(root, f, matches = []) {
    root.querySelector('[data-screen="result"]').classList.add('is-file');
    const t = FILE_TEXT[f.level];
    renderVerdict(root, f.level, t.title, t.sub);
    renderMatchedCard(root, matches);

    $(root, 'rFileName').textContent = f.name;
    $(root, 'rFileInfo').textContent = formatSize(f.size) + (f.typeDesc ? ` · ${f.typeDesc}` : '');
    $(root, 'rFileHash').textContent = f.sha256 || 'Không rõ SHA-256';

    const card = root.querySelector('.vt-card');
    card.dataset.level = f.level;
    const demo = $(root, 'vtDemo');
    demo.textContent = f.live ? (f.source === 'cache' ? 'Đã đối chiếu VT' : 'Vừa quét xong') : 'Dữ liệu demo';
    demo.classList.toggle('is-live', !!f.live);

    const s = f.stats;
    const total = s.malicious + s.suspicious + s.harmless + s.undetected;
    $(root, 'vtFlagged').textContent = s.malicious + s.suspicious;
    $(root, 'vtTotal').textContent = total;
    const parts = [
      ['Nguy hiểm', s.malicious, 'var(--danger)'],
      ['Đáng ngờ', s.suspicious, 'var(--warn)'],
      ['An toàn', s.harmless, 'var(--safe)'],
      ['Chưa rõ', s.undetected, '#CBD5E1']
    ];
    $(root, 'vtBar').innerHTML = parts.filter((p) => p[1] > 0).map((p) => `<i style="flex:${p[1]};background:${p[2]}"></i>`).join('');
    $(root, 'vtLegend').innerHTML = parts.map((p) => `<li><i style="background:${p[2]}"></i>${p[0]}<b>${p[1]}</b></li>`).join('');

    const detect = $(root, 'vtDetect');
    detect.style.display = f.detections.length ? '' : 'none';
    $(root, 'vtDetectList').innerHTML = f.detections.slice(0, 4)
      .map((d) => `<li><span>${esc(d.engine)}</span><b>${esc(d.result)}</b></li>`).join('');

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
      void omni.offsetWidth;
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
    $(root, 'checkLabel').textContent = file ? 'Quét mã độc tệp này' : 'Kiểm tra ngay';
    $(root, 'checkIcon').setAttribute('href', file ? '#i-file-search' : '#i-shield-check');
    if (file) {
      $(root, 'fileName').textContent = file.name;
      $(root, 'fileInfo').textContent = `${formatSize(file.size)} · sẵn sàng kiểm tra`;
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

  /* ---------- Render Báo cáo đa kênh ---------- */
  function renderReportFormState(root, opts = {}) {
    const channels = opts.channels || state.channels;
    const rType = opts.type || state.reportType;
    const ward = opts.ward || state.reportWard;
    const family = opts.family || state.family;

    $$(root, '.channel-chip').forEach((btn) => {
      const on = channels.has(btn.dataset.channel);
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-checked', String(on));
    });

    const famPick = $(root, 'reportFamilyPick');
    famPick.hidden = !channels.has('family');
    $(root, 'reportFamilyChips').innerHTML = family.length
      ? family.map((f) => {
          const active = state.selectedFamilyIds.has(f.id);
          return `<button type="button" class="fam-pick-pill ${active ? 'is-active' : ''}" data-action="toggle-family-recipient" data-id="${f.id}">${esc(f.name)} (${esc(f.rel)})</button>`;
        }).join('')
      : `<button type="button" class="fam-pick-pill" data-action="add-contact" data-from="report">+ Thêm người thân</button>`;

    $$(root, '.type-card').forEach((c) => {
      const on = c.dataset.type === rType;
      c.classList.toggle('is-selected', on);
      c.setAttribute('aria-checked', String(on));
    });

    const meta = TYPE_META[rType] || TYPE_META.phone;
    $(root, 'reportTargetLabel').textContent = meta.targetLabel;
    $(root, 'reportTarget').placeholder = meta.placeholder;
    $(root, 'malwareTools').hidden = rType !== 'malware';

    $$(root, '.ward-chip').forEach((w) => {
      const on = w.dataset.ward === ward;
      w.classList.toggle('is-selected', on);
      w.setAttribute('aria-checked', String(on));
    });

    /* Khối gọi/nhắn người thân 1 chạm ở trang Báo cáo cho Người cao tuổi */
    const srList = $(root, 'seniorReportFamily');
    if (srList) {
      srList.innerHTML = family.length
        ? family.map((f) => renderFamilyRowHTML(f)).join('')
        : `<li class="contact-empty">Chưa có số con cháu. <button type="button" class="btn btn-sos btn-block" data-action="add-contact" data-from="report">+ Thêm người thân</button></li>`;
    }
  }

  function renderReportDone(root, mode, info = {}) {
    const panel = $(root, 'reportDone');
    panel.dataset.mode = mode;
    const code = info.code ? `<b>#${esc(info.code)}</b>` : '';
    const channels = info.channels || ['server'];
    $(root, 'doneIcon').setAttribute('href', mode === 'queued' ? '#i-clock' : '#i-check');
    $(root, 'doneTitle').textContent = mode === 'queued' ? 'Đã lưu tạm báo cáo' : 'Đã gửi báo cáo thành công';
    $(root, 'doneText').innerHTML = mode === 'queued'
      ? 'Điện thoại đang ngoại tuyến. Báo cáo sẽ <b>tự động đồng bộ lên máy chủ</b> ngay khi có mạng.'
      : `Mã tiếp nhận ${code}. Hệ thống đã ghi nhận để bảo vệ cộng đồng Đồng Nai.`;

    const receipts = [];
    if (channels.includes('server')) {
      receipts.push(`<li>${icon('i-check')}<span>Đã gửi lên <b>Máy chủ</b> để tổng hợp vào Danh sách cảnh báo</span></li>`);
    }
    if (channels.includes('officer')) {
      receipts.push(`<li>${icon('i-check')}<span>Đã chuyển tới <b>Cán bộ / Công an ${esc(info.ward || 'địa phương')}</b> kiểm duyệt</span></li>`);
    }
    if (channels.includes('family') && info.familyNames && info.familyNames.length) {
      receipts.push(`<li>${icon('i-check')}<span>Đã gửi tin cảnh báo tới người thân: <b>${esc(info.familyNames.join(', '))}</b></span></li>`);
    }
    $(root, 'doneReceipts').innerHTML = receipts.join('');
  }

  function setReportDone(root, done) {
    root.querySelector('[data-screen="report"]').classList.toggle('is-done', done);
  }

  /* ---------- Render Bài học & Thi thử ---------- */
  function renderLesson(root, index, flipped) {
    const l = LESSONS[index];
    $(root, 'lessonTag').textContent = l.tag;
    $(root, 'lessonTitle').textContent = l.title;
    $(root, 'lessonQuote').textContent = l.quote;
    const stepsHtml = l.steps.map((s, i) => `
      <span class="flip-step"><span class="flip-step-n">${i + 1}</span>
        <span class="flip-step-t"><strong>${esc(s[0])}</strong><small>${esc(s[1])}</small></span>
      </span>`).join('');
    $(root, 'lessonSteps').innerHTML = stepsHtml;

    /* Bản phẳng dễ đọc cho người cao tuổi */
    $(root, 'seniorLessonTitle').textContent = l.title;
    $(root, 'seniorLessonQuote').textContent = l.quote;
    $(root, 'seniorLessonSteps').innerHTML = stepsHtml;

    const flip = $(root, 'flip');
    flip.classList.toggle('is-flipped', !!flipped);
    flip.classList.toggle('is-settled', !!flipped);

    $(root, 'lessonList').innerHTML = LESSONS.map((x, i) => i === index ? '' : `
      <button class="lesson" data-action="pick-lesson" data-index="${i}">
        <span class="lesson-icon ${x.tone}">${icon(x.icon)}</span>
        <span class="lesson-body">
          <strong>${esc(x.title)}</strong>
          <span class="lesson-meta">
            <span class="min-badge">${icon('i-clock')}1 phút</span>
            ${state.learned.has(i) && root === device ? `<span class="lesson-done">${icon('i-check')}Đã xem</span>` : ''}
          </span>
        </span>
        ${icon('i-chevron-right', 'lesson-chev')}
      </button>`).join('');

    const learnedCount = root === device ? state.learned.size : 0;
    $(root, 'learnProgress').innerHTML = `${icon('i-star')}${3 + learnedCount}/12 bài`;
  }

  function buildBubble(q) {
    let n = 0;
    return esc(q.text).replace(/\[\[(.+?)\]\]/g, (_, t) => `<span class="trap" data-n="${++n}">${t}</span>`);
  }

  function renderQuiz(root, index, picked, score) {
    const q = QUIZ[index];
    const pane = $(root, 'quizSection');
    pane.classList.remove('is-finished');

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
    $$(root, '[data-ref="smsBubble"] .trap').forEach((t) => {
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
    $(root, 'nextLabel').textContent = index === QUIZ.length - 1 ? 'Xem điểm tổng kết' : 'Câu tiếp theo';
  }

  /* ---------- Render Kiểm duyệt, Danh sách cảnh báo & Thống kê ---------- */
  function renderVolunteerAndWatchlist(root, reports = state.reports) {
    const wl = buildWatchlistFromReports(reports);
    const pendingCount = reports.filter((r) => r.status === 'pending').length;
    const totalReports = wl.reduce((sum, x) => sum + x.reportCount, 0) + 82; // cộng số liệu lịch sử trong tháng tại địa phương

    $(root, 'pendingBadge').textContent = pendingCount;
    $(root, 'watchlistBadge').textContent = wl.length;
    const dot = $(root, 'tabPendingDot');
    if (dot) dot.hidden = pendingCount === 0;

    $(root, 'homeWatchlistSummary').textContent = `Danh sách cảnh báo máy chủ: ${wl.length} nguồn nguy hiểm (${pendingCount} chờ duyệt)`;
    $(root, 'kpiTotal').textContent = totalReports;
    $(root, 'kpiWatchCount').textContent = wl.length;

    /* 1. Danh sách Kiểm duyệt báo cáo */
    const rFilter = root === device ? state.reviewFilter : 'all';
    $$(root, '[data-action="filter-review"]').forEach((b) => b.classList.toggle('is-active', b.dataset.filter === rFilter));
    const filteredReports = reports.filter((r) => rFilter === 'all' || r.status === rFilter);

    const statusLabel = { pending: 'Chờ kiểm duyệt', verified: 'Đã xác minh', dismissed: 'Đã bỏ qua' };
    $(root, 'reviewList').innerHTML = filteredReports.length
      ? filteredReports.map((r) => {
          const m = TYPE_META[r.type] || TYPE_META.phone;
          const displayTarget = r.fileName ? `${r.fileName} (SHA-256: ${String(r.fileHash || r.targetValue).slice(0, 12)}…)` : (r.targetValue || 'Báo cáo nội dung');
          return `
            <article class="rv-card">
              <div class="rv-top">
                <span class="rv-type ${m.cls}">${icon(m.icon)}${esc(m.label)}</span>
                <span class="rv-badge st-${r.status}">${statusLabel[r.status] || 'Chờ duyệt'}</span>
              </div>
              <strong class="rv-target">${esc(displayTarget)}</strong>
              <p class="rv-desc">${esc(r.content)}</p>
              <div class="rv-meta">
                <span>#${esc(r.code)} · ${esc(r.ward || 'Đồng Nai')}</span>
                <span>${formatTimeAgo(r.createdAt)}</span>
              </div>
              <div class="rv-actions">
                <button type="button" class="mini-act mini-act-primary" data-action="open-report-detail" data-id="${r.id}">${icon('i-eye')}Đọc &amp; Duyệt</button>
                <button type="button" class="mini-act" data-action="speak-report-id" data-id="${r.id}">${icon('i-volume')}Đọc to</button>
                ${r.status === 'pending' ? `<button type="button" class="mini-act mini-act-ok" data-action="quick-approve" data-id="${r.id}">${icon('i-check')}Duyệt</button>` : ''}
              </div>
            </article>`;
        }).join('')
      : `<p class="rv-empty">Không có báo cáo nào trong mục này.</p>`;

    /* 2. Danh sách cảnh báo tổng hợp trên máy chủ */
    const wType = root === device ? state.watchlistType : 'all';
    const wQuery = root === device ? state.watchlistQuery.trim().toLowerCase() : '';
    $$(root, '[data-action="filter-watchlist"]').forEach((b) => b.classList.toggle('is-active', b.dataset.wtype === wType));

    const filteredWl = wl.filter((it) => {
      if (wType !== 'all' && it.type !== wType) return false;
      if (!wQuery) return true;
      return it.targetValue.toLowerCase().includes(wQuery) ||
             it.summary.toLowerCase().includes(wQuery) ||
             (it.fileName && it.fileName.toLowerCase().includes(wQuery));
    });

    $(root, 'watchlistItems').innerHTML = filteredWl.length
      ? filteredWl.map((it) => {
          const m = TYPE_META[it.type] || TYPE_META.phone;
          const title = it.fileName ? `${it.fileName}` : it.targetValue;
          return `
            <article class="rv-card">
              <div class="rv-top">
                <span class="rv-type ${m.cls}">${icon(m.icon)}${esc(m.label)}</span>
                <span class="rv-badge st-count">${it.reportCount} báo cáo · ${it.verified ? 'Đã xác minh' : 'Đang theo dõi'}</span>
              </div>
              <strong class="rv-target">${esc(title)}</strong>
              ${it.fileHash ? `<small class="rv-meta"><code>SHA-256: ${esc(it.fileHash.slice(0, 24))}…</code></small>` : ''}
              <p class="rv-desc">${esc(it.summary)}</p>
              <div class="rv-actions">
                <button type="button" class="mini-act mini-act-primary" data-action="open-watchlist-detail" data-key="${esc(it.key)}">${icon('i-eye')}Đọc báo cáo</button>
                <button type="button" class="mini-act" data-action="test-watchlist-item" data-key="${esc(it.key)}">${icon('i-search')}Kiểm tra thử</button>
              </div>
            </article>`;
        }).join('')
      : `<p class="rv-empty">Không tìm thấy mục cảnh báo phù hợp.</p>`;
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
      c.dataset.index = i;
      svg.appendChild(c);
      offset += d.value;
    });

    $(root, 'legend').innerHTML = CHART.map((d, i) => `
      <li class="legend-item" data-index="${i}">
        <span class="legend-swatch" style="background:${d.color}"></span>
        <span class="legend-name">${esc(d.name)}</span>
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
      $(root, 'donutValue').textContent = '35%';
      $(root, 'donutLabel').textContent = 'Web / Link giả';
    } else {
      $(root, 'donutValue').textContent = CHART[index].value + '%';
      $(root, 'donutLabel').textContent = CHART[index].name;
    }
  }

  /* ---------- Render Chi tiết Đọc & Kiểm duyệt Báo cáo (Bottom Sheet) ---------- */
  function populateReportDetailSheet(root, { report = null, watchlistItem = null, officerMode = false }) {
    const item = report || watchlistItem;
    if (!item) return '';
    const m = TYPE_META[item.type] || TYPE_META.phone;
    const statusMap = { pending: 'Chờ kiểm duyệt', verified: 'Đã xác minh cảnh báo', dismissed: 'Đã đánh dấu an toàn' };
    const st = item.status || (item.verified ? 'verified' : 'pending');

    $(root, 'detailCode').textContent = report ? `#${report.code}` : `Tổng hợp ${watchlistItem.reportCount} báo cáo`;
    $(root, 'detailTitle').textContent = officerMode ? 'Đọc & Kiểm duyệt báo cáo' : 'Hồ sơ báo cáo cảnh báo';
    $(root, 'detailTypeChip').innerHTML = icon(m.icon) + m.label;

    const stEl = $(root, 'detailStatus');
    stEl.textContent = statusMap[st] || 'Chờ duyệt';
    stEl.className = 'detail-status' + (st === 'verified' ? ' is-verified' : st === 'dismissed' ? ' is-dismissed' : '');

    $(root, 'detailTarget').textContent = item.fileName || item.targetValue || 'Nội dung phản ánh';
    const hashEl = $(root, 'detailHash');
    if (item.fileHash) {
      hashEl.hidden = false;
      hashEl.textContent = `SHA-256: ${item.fileHash}`;
    } else {
      hashEl.hidden = true;
    }

    const chNames = { server: 'Máy chủ cảnh báo', officer: 'Cán bộ cơ sở', family: 'Người thân' };
    const chList = report && report.channels ? report.channels.map((c) => chNames[c] || c).join(', ') : 'Máy chủ cảnh báo';
    $(root, 'detailSubmeta').innerHTML = `
      <span>Địa bàn: <b>${esc(item.ward || 'Đồng Nai')}</b></span>
      <span>Lượt báo: <b>${item.reportCount || 1}</b></span>
      <span>Kênh: <b>${esc(chList)}</b></span>`;

    const entries = watchlistItem && watchlistItem.reports ? watchlistItem.reports : [report];
    $(root, 'detailContentList').innerHTML = entries.map((e) => `
      <div class="detail-report-entry">
        <p>${esc(e.content)}</p>
        <small>#${esc(e.code)} · ${esc(e.ward || 'Đồng Nai')} · ${formatTimeAgo(e.createdAt)}</small>
        ${e.reviewerNote ? `<div class="detail-note-tag">Nhận xét kiểm duyệt: ${esc(e.reviewerNote)}</div>` : ''}
      </div>`).join('');

    const modBox = $(root, 'detailModeration');
    modBox.hidden = !officerMode || !report;
    if (officerMode && report && $(root, 'reviewerNote')) {
      $(root, 'reviewerNote').value = report.reviewerNote || '';
    }

    const speechParts = [
      `${officerMode ? 'Hồ sơ kiểm duyệt báo cáo' : 'Thông tin báo cáo cảnh báo'}.`,
      `Phân loại: ${m.label}.`,
      `Đối tượng: ${item.fileName || item.targetValue}.`,
      `Địa bàn: ${item.ward || 'Đồng Nai'}.`,
      `Trạng thái: ${statusMap[st]}.`,
      `Nội dung phản ánh: ${entries.map((e) => e.content).join('. ')}`,
      report && report.reviewerNote ? `Ghi chú cán bộ: ${report.reviewerNote}.` : ''
    ];
    return speechParts.filter(Boolean).join(' ');
  }

  /* ---------- Render Người thân & Cài đặt ---------- */
  function renderFamilyRowHTML(f) {
    return `
      <li class="family-row">
        <button type="button" class="fr-main" data-action="send-family" data-id="${f.id}">
          <span class="avatar av-${f.color}">${esc(initials(f.name))}</span>
          <span class="fr-body"><strong>${esc(f.name)}</strong><small>${esc(f.rel)} · ${maskPhone(f.phone)}</small></span>
          <span class="fr-send" aria-label="Gửi tin cảnh báo">${icon('i-send')}<span>Gửi</span></span>
        </button>
        <button type="button" class="fr-call" data-action="call-family" data-id="${f.id}" aria-label="Gọi ${esc(f.name)}">${icon('i-phone')}</button>
      </li>`;
  }

  function renderFamilySheet(root, family) {
    $(root, 'sheet').classList.toggle('is-empty', family.length === 0);
    $(root, 'familyList').innerHTML = family.map(renderFamilyRowHTML).join('');
    const more = $(root, 'familyAddMore');
    if (more) more.style.display = family.length >= MAX_FAMILY ? 'none' : '';
  }

  function renderSettings(root, settings, family) {
    const guard = $(root, 'guard');
    guard.classList.toggle('is-off', !settings.background);
    $(root, 'guardStatus').textContent = settings.background
      ? 'Đang tự động cảnh báo cuộc gọi và tin nhắn lạ'
      : 'Đang tắt bảo vệ tự động';
    $$(root, '[data-action="toggle-background"]').forEach((b) => b.setAttribute('aria-checked', String(settings.background)));
    $$(root, '[data-action="toggle-option"]').forEach((b) => b.setAttribute('aria-checked', String(!!settings[b.dataset.option])));

    $(root, 'familyCount').textContent = `${family.length}/${MAX_FAMILY}`;
    $(root, 'contactList').innerHTML = family.length
      ? family.map((f) => `
        <li class="contact-row">
          <button class="contact-main" data-action="edit-contact" data-id="${f.id}">
            <span class="avatar av-${f.color}">${esc(initials(f.name))}</span>
            <span class="set-text"><strong>${esc(f.name)}</strong><small>${esc(f.rel)} · ${formatPhone(f.phone)}</small></span>
          </button>
          <button class="contact-edit" data-action="edit-contact" data-id="${f.id}" aria-label="Sửa ${esc(f.name)}">${icon('i-pencil')}</button>
        </li>`).join('')
      : '<li class="contact-empty">Chưa có người thân nào. Thêm ít nhất 1 người để bấm gọi nhanh.</li>';

    const add = $(root, 'addContactBtn');
    add.disabled = family.length >= MAX_FAMILY;
    add.lastChild.textContent = family.length >= MAX_FAMILY ? 'Đã đủ 5 người thân' : 'Thêm người thân';
  }

  function renderServerStatus(root) {
    const serverDot = $(root, 'serverDot');
    const vtDot = $(root, 'vtDot');
    let serverText;
    if (!api.checked) serverText = 'Đang kiểm tra…';
    else if (state.offline) serverText = 'Đang ngoại tuyến – lưu tạm trên máy';
    else if (api.online) serverText = `Trực tuyến (${api.db === 'sqlite' ? 'SQLite' : 'JSON'}) · Tự động gom DS cảnh báo`;
    else serverText = 'Chế độ Demo cục bộ trên trình duyệt';
    $(root, 'serverText').textContent = serverText;
    serverDot.className = 'status-dot' + (api.online && !state.offline ? ' is-ok' : api.checked ? ' is-warn' : '');

    let vtText;
    if (!api.checked) vtText = 'Đang kiểm tra…';
    else if (api.online && api.vt) vtText = 'Đã kết nối VirusTotal API';
    else vtText = 'Chế độ mô phỏng kết quả quét tệp';
    $(root, 'vtText').textContent = vtText;
    vtDot.className = 'status-dot' + (api.online && api.vt && !state.offline ? ' is-ok' : api.checked ? ' is-warn' : '');

    const n = state.queue.length;
    $(root, 'queueText').textContent = n ? `${n} báo cáo đang chờ đồng bộ` : 'Không có báo cáo chờ gửi';
    $(root, 'flushBtn').disabled = !n || state.offline || !api.online;
  }

  /* ---------- 8. ĐIỀU HƯỚNG ---------- */
  function go(key) {
    if (!SCREENS[key]) return;
    if (state.senior && key === 'volunteer') key = 'home';

    stopMic(false);
    stopReportMic();
    stopAudio();
    closeSheet();

    if (key === 'report') {
      renderReportFormState(device);
    }
    if (key === 'volunteer') {
      renderVolunteerAndWatchlist(device);
      syncReportsFromServer();
    }
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
        'report-detail': ['05_DocBaoCao', state.detailIsOfficer ? 'Đọc & Kiểm duyệt báo cáo' : 'Đọc hồ sơ báo cáo cảnh báo'],
        poster: ['05_AnhTuyenTruyen', 'Xuất ảnh tuyên truyền nhanh'],
        contact: ['06_NguoiThan', state.contactEditId ? 'Sửa người thân' : 'Thêm người thân']
      };
      [stageCode.textContent, stageTitle.textContent] = labels[mode] || ['01_TrangChu', 'Lá Chắn Số'];
      return;
    }
    stageCode.textContent = SCREENS[state.screen].code;
    stageTitle.textContent = SCREENS[state.screen].title;
  }

  function toast({ type = 'success', title, desc = '', iconId }) {
    const icons = { success: 'i-check', info: 'i-info', warn: 'i-wifi-off', error: 'i-alert-circle' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <span class="toast-icon">${icon(iconId || icons[type])}</span>
      <span class="toast-body"><strong>${title}</strong>${desc ? `<small>${desc}</small>` : ''}</span>`;
    while (ui.toastHost.children.length >= 2) ui.toastHost.firstElementChild.remove();
    ui.toastHost.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  /* ---------- 9. KIỂM TRA NHANH & ĐỐI CHIẾU MÁY CHỦ ---------- */
  async function runCheck() {
    if (ui.checkBtn.classList.contains('is-loading') || state.scanToken) return;
    if (state.file) { runFileScan(state.file); return; }
    stopMic(false);
    const value = ui.omniInput.value.trim();
    const err = validateInput(value);
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

    let serverMatches = null;
    if (api.online && !state.offline) {
      try {
        const res = await fetchJSON(`/api/lookup?q=${encodeURIComponent(value)}`, {}, 3000);
        if (res && Array.isArray(res.matches)) serverMatches = res.matches;
      } catch { /* fallback đối chiếu cục bộ */ }
    }

    await delay(420);
    ui.omni.classList.remove('is-scanning');
    ui.checkBtn.classList.remove('is-loading');

    const matches = serverMatches !== null ? serverMatches : findWatchlistMatches(value);
    state.matchedItems = matches;
    state.level = analyzeText(value, matches);
    state.resultKind = 'text';
    state.checkedText = value;

    renderResult(device, state.level, value, matches);
    syncLevelButtons();
    go('result');

    if ((state.settings.autoRead || state.senior) && state.level === 'danger') {
      setTimeout(() => {
        if (state.screen === 'result') {
          playAudio({ key: 'result-main', text: buildResultSpeechText(), btn: ui.listen, bar: ui.listenBar });
        }
      }, 380);
    }
  }

  function startMic() {
    stopTyping();
    setError(device, null);
    ui.omni.classList.add('is-listening');

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      try {
        const rec = new SR();
        rec.lang = 'vi-VN';
        rec.interimResults = false;
        let resolved = false;
        rec.onresult = (ev) => {
          const text = ev.results && ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : '';
          if (text) {
            resolved = true;
            stopMic(false);
            setInputValue(device, text);
          }
        };
        rec.onerror = () => {
          if (!resolved && ui.omni.classList.contains('is-listening')) {
            stopMic(false);
            typeInto(VOICE_TRANSCRIPT);
          }
        };
        rec.start();
      } catch { /* fallback sang kịch bản giả lập */ }
    }

    timers.mic = setTimeout(() => {
      if (ui.omni.classList.contains('is-listening')) {
        stopMic(false);
        typeInto(VOICE_TRANSCRIPT);
      }
    }, 2400);
  }

  function stopMic(notify) {
    clearTimeout(timers.mic);
    if (ui.omni.classList.contains('is-listening')) {
      ui.omni.classList.remove('is-listening');
      if (notify) toast({ type: 'info', title: 'Đã dừng thu âm', iconId: 'i-mic' });
    }
  }

  function toggleReportMic() {
    const btn = $(device, 'reportMicBtn');
    if (btn.classList.contains('is-listening')) {
      stopReportMic();
      return;
    }
    btn.classList.add('is-listening');
    btn.innerHTML = `${icon('i-stop', 'ic-fill')}Đang nghe…`;
    timers.reportMic = setTimeout(() => {
      stopReportMic();
      ui.reportText.value = REPORT_VOICE_TRANSCRIPT;
      ui.reportText.focus();
      toast({ type: 'success', title: 'Đã chuyển giọng nói thành văn bản', iconId: 'i-mic' });
    }, 2000);
  }

  function stopReportMic() {
    clearTimeout(timers.reportMic);
    const btn = $(device, 'reportMicBtn');
    if (btn) {
      btn.classList.remove('is-listening');
      btn.innerHTML = `${icon('i-mic')}Nói để nhập`;
    }
  }

  function typeInto(text) {
    stopTyping();
    let i = 0;
    setInputValue(device, '');
    timers.typing = setInterval(() => {
      i += 3;
      setInputValue(device, text.slice(0, i));
      if (i >= text.length) {
        stopTyping();
        ui.omniInput.focus();
      }
    }, 16);
  }

  function stopTyping() { clearInterval(timers.typing); }

  /* ---------- 10. QUÉT TỆP (VirusTotal + Đối chiếu Mã độc Máy chủ) ---------- */
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
      setError(device, 'Cần kết nối mạng để quét tệp qua VirusTotal.');
      return;
    }
    setError(device, null);
    const token = { cancelled: false };
    state.scanToken = token;
    ui.omni.classList.add('is-file-scanning');
    setScanStep(device, 'hash', 12);
    $(device, 'vtAnalyzeText').textContent = 'Phân tích mã độc đa công cụ';

    try {
      const [sha] = await Promise.all([sha256Hex(file).catch(() => null), delay(400)]);
      if (token.cancelled) return;
      setScanStep(device, 'lookup', 35);

      const useServer = !demo && api.online && api.vt;
      const result = useServer ? await scanViaServer(file, token) : await scanDemo(file, demo ? DEMO_FILE_RESULT.sha256 : sha, token);
      if (token.cancelled) return;

      setScanStep(device, 'done', 100);
      await delay(350);
      if (token.cancelled) return;
      endScan();

      const matches = findWatchlistMatches(result.sha256 || result.name);
      state.matchedItems = matches;
      state.resultKind = 'file';
      state.fileResult = result;
      state.level = result.level;
      state.checkedText = `Tệp ${result.name} (SHA-256: ${(result.sha256 || '').slice(0, 16)}…)`;
      renderFileResult(device, result, matches);
      syncLevelButtons();
      clearFile();
      go('result');
    } catch (e) {
      if (token.cancelled) return;
      endScan();
      setError(device, esc(e.message || 'Không quét được tệp.'));
    }
  }

  async function scanViaServer(file, token) {
    const first = await fetchJSON('/api/scan', {
      method: 'POST',
      body: file,
      headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }
    }, 120000);
    if (first.status === 'completed') {
      setScanStep(device, 'analyze', 88);
      return first.result;
    }
    setScanStep(device, 'analyze', 45);
    for (let i = 1; i <= 10; i++) {
      $(device, 'vtAnalyzeText').textContent = `Đang chờ VirusTotal… (${i}/10)`;
      await delay(15000);
      if (token.cancelled) return null;
      const r = await fetchJSON(`/api/scan/${encodeURIComponent(first.analysisId)}`, {}, 20000);
      setScanStep(device, 'analyze', Math.min(95, 45 + i * 5));
      if (r.status === 'completed') return r.result;
    }
    throw new Error('VirusTotal vẫn đang phân tích. Vui lòng thử lại sau ít phút.');
  }

  async function scanDemo(file, sha, token) {
    await delay(650);
    if (token.cancelled) return null;
    setScanStep(device, 'analyze', 68);
    await delay(500);
    if (token.cancelled) return null;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const level = RISKY_EXT.includes(ext) ? 'danger' : ARCHIVE_EXT.includes(ext) ? 'warning' : 'safe';
    const stats = {
      danger: { malicious: 38, suspicious: 2, harmless: 0, undetected: 26 },
      warning: { malicious: 1, suspicious: 2, harmless: 0, undetected: 63 },
      safe: { malicious: 0, suspicious: 0, harmless: 0, undetected: 66 }
    }[level];
    return {
      name: file.name, size: file.size, typeDesc: file.type || '', sha256: sha,
      level, live: false, permalink: null, stats,
      detections: level === 'danger' ? DEMO_FILE_RESULT.detections
        : level === 'warning' ? [{ engine: 'Heuristic', result: 'Suspicious.Archive.Gen' }] : []
    };
  }

  /* ---------- 11. BOTTOM SHEET & NGƯỜI THÂN ---------- */
  function openSheet(mode = 'family') {
    stopAudio();
    ui.sheet.dataset.mode = mode;
    const labels = {
      family: 'Hỏi người thân',
      'report-detail': 'Đọc và kiểm duyệt báo cáo',
      poster: 'Ảnh tuyên truyền',
      contact: 'Thông tin người thân'
    };
    ui.sheet.setAttribute('aria-label', labels[mode] || 'Bảng thông tin');
    if (mode === 'family') {
      renderFamilySheet(device, state.family);
      setShare(device, state.level, state.checkedText);
    }
    ui.sheet.scrollTop = 0;
    ui.sheetLayer.classList.add('is-open');
    ui.sheetLayer.setAttribute('aria-hidden', 'false');
    state.sheetOpen = true;
    updateStageLabel();
  }

  function closeSheet() {
    if (!state.sheetOpen) return;
    stopAudio();
    ui.sheetLayer.classList.remove('is-open');
    ui.sheetLayer.setAttribute('aria-hidden', 'true');
    state.sheetOpen = false;
    disarmDelete();
    updateStageLabel();
  }

  function saveFamily() {
    if (!state.emptyOverride) store.set('lcs.family', state.family);
    renderFamilySheet(device, state.family);
    renderSettings(device, state.settings, state.family);
    renderReportFormState(device);
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
      toast({ type: 'info', title: 'Đã đủ 5 người thân', iconId: 'i-users' });
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

    if (name.length < 2) { showFieldError(device, 'name', 'Nhập họ tên (ít nhất 2 ký tự).'); ok = false; }
    if (!rel) { showFieldError(device, 'rel', 'Chọn mối quan hệ.'); ok = false; }
    if (!phone || !isValidPhone(phone)) { showFieldError(device, 'phone', 'Nhập số điện thoại 10 chữ số (VD: 0912 345 678).'); ok = false; }
    else {
      const pool = state.emptyOverride ? [] : state.family;
      const dup = pool.find((f) => f.phone === phone && f.id !== state.contactEditId);
      if (dup) { showFieldError(device, 'phone', `Số này đã lưu cho ${dup.name}.`); ok = false; }
    }
    if (!ok) return;

    const editing = !!state.contactEditId;
    if (state.emptyOverride) {
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
      const newId = 'f-' + uid();
      state.family = [...state.family, { id: newId, name, rel, phone, color }];
      state.selectedFamilyIds.add(newId);
    }
    saveFamily();
    toast({ type: 'success', title: editing ? `Đã cập nhật ${esc(name)}` : `Đã thêm ${esc(name)}`, desc: `${esc(rel)} · ${formatPhone(phone)}` });
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
      $(device, 'contactDeleteLabel').textContent = 'Bấm lần nữa để xác nhận xoá';
      timers.disarm = setTimeout(disarmDelete, 3500);
      return;
    }
    const removed = state.family.find((f) => f.id === state.contactEditId);
    state.family = state.family.filter((f) => f.id !== state.contactEditId);
    state.selectedFamilyIds.delete(state.contactEditId);
    saveFamily();
    closeSheet();
    toast({ type: 'info', title: `Đã xoá ${esc(removed ? removed.name : 'liên hệ')}`, iconId: 'i-trash' });
  }

  /* ---------- 12. GỬI BÁO CÁO ĐA KÊNH & ĐỒNG BỘ MÁY CHỦ ---------- */
  function prefillReportFromResult() {
    setReportDone(device, false);
    if (state.resultKind === 'file' && state.fileResult) {
      state.reportType = 'malware';
      state.reportFileMeta = { name: state.fileResult.name, sha256: state.fileResult.sha256 || '' };
      ui.reportTarget.value = state.fileResult.sha256 || state.fileResult.name;
      const badge = $(device, 'malwareBadge');
      badge.hidden = false;
      badge.textContent = `Tệp: ${state.fileResult.name} · SHA-256: ${(state.fileResult.sha256 || '').slice(0, 28)}…`;
      ui.reportText.value = `Phát hiện tệp nghi ngờ mã độc ${state.fileResult.name} (${FILE_TEXT[state.fileResult.level].title.toLowerCase()}).`;
    } else {
      const detected = detectType(state.checkedText);
      state.reportType = state.senior
        ? (detected.key === 'web' ? 'web' : 'phone')
        : (['phone', 'web', 'malware', 'bank'].includes(detected.key) ? detected.key : 'phone');
      ui.reportTarget.value = normalizeTargetKey(state.reportType, '', state.checkedText, '', '');
      ui.reportText.value = state.checkedText;
    }
    renderReportFormState(device);
    go('report');
  }

  async function pickMalwareReportFile(file) {
    if (!file) return;
    const sha = (await sha256Hex(file).catch(() => null)) || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    state.reportFileMeta = { name: file.name, sha256: sha };
    ui.reportTarget.value = sha;
    const badge = $(device, 'malwareBadge');
    badge.hidden = false;
    badge.textContent = `Đã trích xuất mã SHA-256 của "${file.name}": ${sha.slice(0, 24)}…`;
    if (!ui.reportText.value.trim()) {
      ui.reportText.value = `Báo cáo tệp đính kèm nghi chứa mã độc: ${file.name} (${formatSize(file.size)}).`;
    }
  }

  function resetReport() {
    setReportDone(device, false);
    state.reportFileMeta = null;
    ui.reportTarget.value = '';
    ui.reportText.value = '';
    $(device, 'malwareBadge').hidden = true;
    $(device, 'reportError').classList.remove('is-visible');
    $(device, 'reportSubmit').classList.remove('is-loading');
    renderReportFormState(device);
  }

  function persistLocalReports() {
    store.set('lcs.reports.v2', state.reports);
  }

  async function submitReport() {
    const submit = $(device, 'reportSubmit');
    if (submit.classList.contains('is-loading')) return;
    $(device, 'reportError').classList.remove('is-visible');

    const activeChannels = state.senior ? ['server', 'officer'] : Array.from(state.channels);
    if (!activeChannels.length) {
      $(device, 'reportErrorText').textContent = 'Hãy chọn ít nhất 1 nơi nhận báo cáo (Máy chủ, Cán bộ hoặc Người thân).';
      $(device, 'reportError').classList.add('is-visible');
      return;
    }

    const targetRaw = ui.reportTarget.value.trim();
    const contentRaw = ui.reportText.value.trim();
    if (!targetRaw && !contentRaw) {
      $(device, 'reportErrorText').textContent = state.senior
        ? 'Mời bác nhập hoặc bấm Nói để mô tả cuộc gọi / tin nhắn lừa đảo.'
        : 'Hãy nhập SĐT, trang web, mã file độc hoặc mô tả sự việc cần báo cáo.';
      $(device, 'reportError').classList.add('is-visible');
      return;
    }

    const fileName = state.reportType === 'malware' && state.reportFileMeta ? state.reportFileMeta.name : '';
    const fileHash = state.reportType === 'malware'
      ? ((state.reportFileMeta && state.reportFileMeta.sha256) || (/^[a-f0-9]{32,64}$/i.test(targetRaw) ? targetRaw.toLowerCase() : ''))
      : '';
    const normTarget = normalizeTargetKey(state.reportType, targetRaw, contentRaw, fileHash, fileName);
    const finalContent = contentRaw || `Báo cáo ${TYPE_META[state.reportType].label.toLowerCase()}: ${fileName || normTarget}`;

    const familyRecipients = activeChannels.includes('family')
      ? state.family.filter((f) => state.selectedFamilyIds.has(f.id)).map((f) => f.name)
      : [];

    const payload = {
      clientId: uid(),
      type: state.reportType,
      targetValue: normTarget,
      fileName: fileName || null,
      fileHash: fileHash || null,
      content: finalContent.slice(0, 2000),
      channels: activeChannels,
      ward: state.reportWard,
      forwardPolice: activeChannels.includes('officer'),
      riskLevel: state.reportType === 'malware' ? 'danger' : analyzeText(finalContent + ' ' + normTarget),
      clientCreatedAt: new Date().toISOString()
    };

    submit.classList.add('is-loading');

    const recordLocal = (code, mode) => {
      const newId = state.reports.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
      const newItem = {
        id: newId,
        code,
        type: payload.type,
        targetValue: payload.targetValue,
        fileName: payload.fileName || '',
        fileHash: payload.fileHash || '',
        content: payload.content,
        channels: payload.channels,
        ward: payload.ward,
        forwardPolice: payload.forwardPolice,
        riskLevel: payload.riskLevel,
        status: 'pending',
        reportCount: 1,
        reviewerNote: '',
        createdAt: new Date().toISOString()
      };
      state.reports = [newItem, ...state.reports];
      state.lastCreatedReportId = newItem.id;
      persistLocalReports();
      renderVolunteerAndWatchlist(device);
      submit.classList.remove('is-loading');
      renderReportDone(device, mode, { code, channels: activeChannels, ward: payload.ward, familyNames: familyRecipients });
      setReportDone(device, true);
      ui.viewport.scrollTo({ top: 0, behavior: 'auto' });
    };

    const d = new Date();
    const fallbackCode = `DN-${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 899) + 110).padStart(4, '0')}`;

    if (state.offline) {
      await delay(350);
      state.queue = [...state.queue, { ...payload, queuedOffline: true }];
      store.set('lcs.queue', state.queue);
      renderServerStatus(device);
      recordLocal(fallbackCode, 'queued');
      return;
    }

    if (api.online && (activeChannels.includes('server') || activeChannels.includes('officer'))) {
      try {
        const res = await fetchJSON('/api/reports', { method: 'POST', json: payload }, 8000);
        if (res.report) {
          state.reports = [res.report, ...state.reports.filter((x) => x.id !== res.report.id)];
          state.lastCreatedReportId = res.report.id;
          persistLocalReports();
          renderVolunteerAndWatchlist(device);
        }
        submit.classList.remove('is-loading');
        renderReportDone(device, 'sent', { code: res.code || fallbackCode, channels: activeChannels, ward: payload.ward, familyNames: familyRecipients });
        setReportDone(device, true);
        ui.viewport.scrollTo({ top: 0, behavior: 'auto' });
        return;
      } catch (e) {
        if (e.status && e.status < 500) {
          submit.classList.remove('is-loading');
          $(device, 'reportErrorText').textContent = e.message;
          $(device, 'reportError').classList.add('is-visible');
          return;
        }
        state.queue = [...state.queue, { ...payload, queuedOffline: true }];
        store.set('lcs.queue', state.queue);
        renderServerStatus(device);
        recordLocal(fallbackCode, 'queued');
        return;
      }
    }

    await delay(400);
    recordLocal(fallbackCode, 'sent');
  }

  /* ---------- 13. ĐỌC BÁO CÁO & KIỂM DUYỆT (CÁN BỘ) ---------- */
  function openReportDetailById(id, officerMode = true) {
    const r = state.reports.find((x) => Number(x.id) === Number(id));
    if (!r) return;
    state.detailTargetReportId = r.id;
    state.detailIsOfficer = officerMode;
    state.detailReadText = populateReportDetailSheet(device, { report: r, officerMode });
    openSheet('report-detail');
  }

  function openWatchlistDetailByKey(key, officerMode = false) {
    const wl = buildWatchlistFromReports(state.reports);
    const item = wl.find((x) => x.key === key);
    if (!item) return;
    const primaryReport = item.reports && item.reports[0] ? item.reports[0] : null;
    state.detailTargetReportId = primaryReport ? primaryReport.id : null;
    state.detailIsOfficer = officerMode;
    state.detailReadText = populateReportDetailSheet(device, { watchlistItem: item, report: officerMode ? primaryReport : null, officerMode });
    openSheet('report-detail');
  }

  async function applyReviewDecision(id, status, reviewerNote = '') {
    const idx = state.reports.findIndex((x) => Number(x.id) === Number(id));
    if (idx < 0) return;

    const note = reviewerNote.trim() || (status === 'verified' ? 'Cán bộ đã xác minh và đưa vào Danh sách cảnh báo máy chủ.' : 'Đã kiểm tra, không đủ dấu hiệu nguy hiểm.');
    state.reports[idx] = { ...state.reports[idx], status, reviewerNote: note };
    persistLocalReports();

    if (api.online && !state.offline) {
      try {
        const res = await fetchJSON(`/api/reports/${id}`, {
          method: 'PATCH',
          json: { status, reviewerNote: note }
        }, 6000);
        if (res && res.report) state.reports[idx] = res.report;
      } catch { /* giữ kết quả cập nhật cục bộ */ }
    }

    renderVolunteerAndWatchlist(device);
    if (state.sheetOpen && ui.sheet.dataset.mode === 'report-detail') {
      closeSheet();
    }
    toast({
      type: status === 'verified' ? 'success' : 'info',
      title: status === 'verified' ? 'Đã duyệt vào Danh sách cảnh báo máy chủ' : 'Đã đánh dấu bỏ qua báo cáo',
      desc: `#${state.reports[idx].code} · ${state.reports[idx].fileName || state.reports[idx].targetValue}`
    });
  }

  async function syncReportsFromServer() {
    if (!api.online || state.offline) return;
    try {
      const data = await fetchJSON('/api/reports?limit=80', {}, 4000);
      if (data && Array.isArray(data.items) && data.items.length) {
        state.reports = data.items;
        persistLocalReports();
        renderVolunteerAndWatchlist(device);
      }
    } catch { /* dùng dữ liệu trên máy */ }
  }

  let flushing = false;
  async function flushQueue({ silent = false } = {}) {
    if (flushing || state.offline || !api.online || !state.queue.length) {
      if (!silent && !api.online) toast({ type: 'info', title: 'Máy chủ chưa kết nối', iconId: 'i-server' });
      return;
    }
    flushing = true;
    let sent = 0;
    const rem = [];
    for (const item of state.queue) {
      try {
        await fetchJSON('/api/reports', { method: 'POST', json: item }, 8000);
        sent += 1;
      } catch (e) {
        if (!(e.status && e.status < 500)) rem.push(item);
      }
    }
    state.queue = rem;
    store.set('lcs.queue', state.queue);
    flushing = false;
    renderServerStatus(device);
    if (sent) {
      syncReportsFromServer();
      toast({ type: 'success', title: `Đã đồng bộ ${sent} báo cáo lên máy chủ`, iconId: 'i-server' });
    }
  }

  async function detectServer() {
    if (location.protocol !== 'file:') {
      try {
        const h = await fetchJSON('/api/health', {}, 2500);
        api.online = !!h.ok;
        api.vt = !!h.virustotal;
        api.db = h.database || null;
      } catch {
        api.online = false;
      }
    }
    api.checked = true;
    renderServerStatus(device);
    if (api.online) {
      await flushQueue({ silent: true });
      await syncReportsFromServer();
    }
  }

  /* ---------- 14. BÀI HỌC & QUIZ ---------- */
  function flipCard() {
    const flip = $(device, 'flip');
    if (flip.classList.contains('is-flipped')) {
      flip.classList.add('no-anim');
      flip.classList.remove('is-settled');
      void flip.offsetWidth;
      flip.classList.remove('no-anim');
      requestAnimationFrame(() => flip.classList.remove('is-flipped'));
    } else {
      flip.classList.add('is-flipped');
      if (!state.learned.has(state.lesson)) {
        state.learned.add(state.lesson);
        $(device, 'learnProgress').innerHTML = `${icon('i-star')}${3 + state.learned.size}/12 bài`;
      }
    }
  }

  function answerQuiz(choice) {
    if (state.quizAnswered) return;
    state.quizAnswered = true;
    const q = QUIZ[state.quizIndex];
    if (choice === q.answer) state.quizScore += 20;
    renderQuiz(device, state.quizIndex, choice, state.quizScore);
    setTimeout(() => {
      const explain = $(device, 'explain');
      ui.viewport.scrollTo({ top: Math.max(0, explain.offsetTop - 90), behavior: 'smooth' });
    }, 200);
  }

  function nextQuiz() {
    if (state.quizIndex >= QUIZ.length - 1) {
      $(device, 'quizSection').classList.add('is-finished');
      $$(device, '[data-ref="quizBars"] i').forEach((b) => (b.className = 'is-done'));
      $(device, 'doneScore').textContent = state.quizScore;
      $(device, 'quizDoneText').textContent = state.quizScore >= 80
        ? 'Xuất sắc! Bạn nhận diện rất nhạy bén các kịch bản lừa đảo trực tuyến.'
        : 'Bạn đã nắm được các dấu hiệu cơ bản. Hãy ôn lại Bài học 1 phút để đạt điểm tối đa nhé!';
      ui.viewport.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    state.quizIndex += 1;
    state.quizAnswered = false;
    renderQuiz(device, state.quizIndex, null, state.quizScore);
    ui.viewport.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function restartQuiz() {
    state.quizIndex = 0;
    state.quizScore = 0;
    state.quizAnswered = false;
    renderQuiz(device, 0, null, 0);
  }

  /* ---------- 15. CHẾ ĐỘ NGƯỜI CAO TUỔI TỐI GIẢN & OFFLINE ---------- */
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
    if (state.senior) {
      clearFile();
      if (state.learnSubtab === 'quiz') {
        state.learnSubtab = 'lesson';
        setLearnTab(device, 'lesson');
      }
      if (state.reportType === 'malware' || state.reportType === 'bank') {
        state.reportType = 'phone';
      }
      renderReportFormState(device);
      if (state.screen === 'volunteer') go('home');
    }
    syncToggles();
    toast(state.senior
      ? { type: 'info', title: 'Đã bật Chế độ Người cao tuổi tối giản', desc: 'Đã lược bỏ các tính năng kỹ thuật, chỉ giữ Kiểm tra, Giọng nói & Gọi người thân.', iconId: 'i-shield-check' }
      : { type: 'info', title: 'Đã về giao diện đầy đủ tiêu chuẩn', iconId: 'i-eye' });
    if (state.gallery) buildGallery();
  }

  function toggleOffline() {
    state.offline = !state.offline;
    syncToggles();
    renderServerStatus(device);
    toast(state.offline
      ? { type: 'warn', title: 'Đang giả lập mất mạng', desc: 'Đối chiếu dữ liệu lưu sẵn & xếp hàng đợi báo cáo.' }
      : { type: 'success', title: 'Đã kết nối mạng trở lại', iconId: 'i-wifi' });
    if (!state.offline) setTimeout(() => flushQueue({ silent: true }), 500);
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
    renderReportFormState(device);
  }

  /* ---------- 16. GALLERY VIEW (XUẤT PDF NỘP BÀI) ---------- */
  let template = null;

  const GALLERY = [
    { code: '01_TrangChu', name: 'Trang chủ tinh gọn – vừa khít màn hình di động', screen: 'home' },
    { code: '01_TrangChu · Cao tuổi', name: 'Chế độ Người cao tuổi – tối giản tính năng phụ', screen: 'home',
      setup: (r) => r.classList.add('is-senior') },
    { code: '01_TrangChu · Lỗi', name: 'Kiểm tra lỗi nhập sai định dạng SĐT', screen: 'home',
      setup: (r) => { setInputValue(r, '09123'); setError(r, validateInput('09123')); } },
    { code: '02_KetQua · Nguy hiểm', name: 'Kết quả + Đối chiếu DS Cảnh báo & Đọc báo cáo', screen: 'result',
      setup: (r) => renderResult(r, 'danger', SAMPLES.police.text, findWatchlistMatches(SAMPLES.police.text, INITIAL_REPORTS)) },
    { code: '02_KetQua · Mã độc', name: 'Kết quả quét tệp .apk & Nghe đọc báo cáo tệp', screen: 'result',
      setup: (r) => renderFileResult(r, DEMO_FILE_RESULT, findWatchlistMatches(DEMO_FILE_RESULT.sha256, INITIAL_REPORTS)) },
    { code: '03_HoiNguoiThan', name: 'Bottom sheet – Gửi nhanh & Gọi người thân', screen: 'result',
      setup: (r) => { renderResult(r, 'danger', SAMPLES.police.text, []); openStaticSheet(r, 'family'); } },
    { code: '04_BaoCao · Đa kênh', name: 'Báo cáo tới Người thân, Cán bộ & Máy chủ (File độc)', screen: 'report',
      setup: (r) => {
        renderReportFormState(r, { channels: new Set(['server', 'officer', 'family']), type: 'malware', ward: 'Phường Tam Hiệp', family: DEFAULT_FAMILY });
        $(r, 'reportTarget').value = DEMO_FILE_RESULT.sha256;
        $(r, 'reportText').value = INITIAL_REPORTS[2].content;
      } },
    { code: '04_BaoCao · Hoàn tất', name: 'Xác nhận gửi báo cáo đa kênh lên máy chủ', screen: 'report',
      setup: (r) => {
        renderReportDone(r, 'sent', { code: 'DN-2411-0108', channels: ['server', 'officer', 'family'], ward: 'Phường Tam Hiệp', familyNames: ['Minh Anh'] });
        setReportDone(r, true);
      } },
    { code: '05_BaiHoc · 1 Phút', name: 'Bài học tình huống 1 phút (mặt xử lý)', screen: 'learn',
      setup: (r) => { setLearnTab(r, 'lesson'); renderLesson(r, 0, true); } },
    { code: '05_BaiHoc · Thi thử', name: 'Thi thử nhận diện (đã gộp vào trang Bài học)', screen: 'learn',
      setup: (r) => { setLearnTab(r, 'quiz'); renderQuiz(r, 0, 'scam', 20); } },
    { code: '06_KiemDuyet · Danh sách', name: 'Cán bộ kiểm tra & kiểm duyệt báo cáo mới', screen: 'volunteer',
      setup: (r) => { renderVolunteerAndWatchlist(r, INITIAL_REPORTS); setVolTab(r, 'review'); } },
    { code: '06_KiemDuyet · Đọc báo cáo', name: 'Đọc toàn văn & Nghe giọng đọc báo cáo khi kiểm duyệt', screen: 'volunteer',
      setup: (r) => {
        renderVolunteerAndWatchlist(r, INITIAL_REPORTS);
        populateReportDetailSheet(r, { report: INITIAL_REPORTS[4], officerMode: true });
        openStaticSheet(r, 'report-detail');
      } },
    { code: '06_CanhBao · Máy chủ', name: 'Danh sách cảnh báo tổng hợp trên máy chủ', screen: 'volunteer',
      setup: (r) => { renderVolunteerAndWatchlist(r, INITIAL_REPORTS); setVolTab(r, 'watchlist'); } },
    { code: '06_ThongKe · Địa phương', name: 'Thống kê kiểu lừa đảo & Xuất ảnh tuyên truyền', screen: 'volunteer',
      setup: (r) => { renderVolunteerAndWatchlist(r, INITIAL_REPORTS); setVolTab(r, 'stats'); } },
    { code: '07_CaiDat', name: 'Cài đặt chế độ sử dụng, giọng đọc & người thân', screen: 'settings' }
  ];

  function openStaticSheet(root, mode) {
    $(root, 'sheet').dataset.mode = mode;
    $(root, 'sheetLayer').classList.add('is-open');
  }

  function buildGallery() {
    galleryGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    GALLERY.forEach((item) => {
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
      renderVolunteerAndWatchlist(clone, INITIAL_REPORTS);
      setScreen(clone, item.screen);
      if (item.setup) item.setup(clone);

      const card = document.createElement('figure');
      card.className = 'g-card';
      card.innerHTML = `
        <figcaption class="g-label">
          <span class="g-code">${esc(item.code)}</span>
          <span class="g-name">${esc(item.name)}</span>
        </figcaption>
        <div class="g-frame"></div>`;
      card.querySelector('.g-frame').appendChild(clone);
      frag.appendChild(card);
    });
    galleryGrid.appendChild(frag);
    galleryMeta.textContent = `${GALLERY.length} màn hình & trạng thái · Chế độ: ${state.senior ? 'Người cao tuổi' : 'Tiêu chuẩn'}`;
  }

  function toggleGallery(force) {
    const on = typeof force === 'boolean' ? force : !state.gallery;
    state.gallery = on;
    if (on) {
      stopMic(false);
      stopAudio();
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

  /* ---------- 17. EVENT DELEGATION ---------- */
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
      state.matchedItems = findWatchlistMatches(state.checkedText);
      renderResult(device, state.level, state.checkedText, state.matchedItems);
      syncLevelButtons();
      go('result');
    },
    'edge-review': () => {
      if (state.gallery) toggleGallery(false);
      if (state.senior) { state.senior = false; syncToggles(); }
      state.volTab = 'review';
      setVolTab(device, 'review');
      go('volunteer');
      const target = state.reports.find((r) => r.status === 'pending') || state.reports[0];
      if (target) setTimeout(() => openReportDetailById(target.id, true), 220);
    },
    'edge-error': () => {
      if (state.gallery) toggleGallery(false);
      go('home');
      stopTyping();
      clearFile();
      setInputValue(device, '09123');
      setTimeout(runCheck, 180);
    },
    'edge-file': () => {
      if (state.gallery) toggleGallery(false);
      if (state.senior) { state.senior = false; syncToggles(); }
      go('home');
      const sample = new File([new Uint8Array(2048).map((_, i) => (i * 37) % 251)], DEMO_FILE_RESULT.name, { type: 'application/vnd.android.package-archive' });
      chooseFile(sample);
      setTimeout(() => runFileScan(sample, { demo: true }), 260);
    },
    gallery: () => toggleGallery(),
    print: () => window.print(),

    /* Trang chủ */
    check: runCheck,
    'clear-input': () => { stopTyping(); setInputValue(device, ''); setError(device, null); ui.omniInput.focus(); },
    'paste-sample': () => {
      const keys = ['police', 'web', 'gift', 'safe'];
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
    quick: (el) => {
      stopTyping();
      clearFile();
      setError(device, null);
      const sample = SAMPLES[el.dataset.sample] || SAMPLES.police;
      setInputValue(device, sample.text);
      runCheck();
    },
    'open-watchlist': () => {
      state.volTab = 'watchlist';
      setVolTab(device, 'watchlist');
      go('volunteer');
    },

    /* Kết quả & Đọc báo cáo */
    listen: () => playAudio({
      key: 'result-main',
      text: buildResultSpeechText(),
      btn: ui.listen,
      bar: ui.listenBar
    }),
    'read-matched-report': () => {
      if (state.matchedItems.length) {
        openWatchlistDetailByKey(state.matchedItems[0].key, false);
      }
    },
    'speak-matched-report': () => {
      if (!state.matchedItems.length) return;
      const top = state.matchedItems[0];
      const text = `Báo cáo từ Danh sách cảnh báo máy chủ: ${TYPE_META[top.type].label} ${top.fileName || top.targetValue}, ghi nhận ${top.reportCount} lượt báo cáo tại ${top.ward}. Nội dung: ${top.summary}`;
      playAudio({ key: 'matched-' + top.key, text, toastTitle: 'Đang đọc hồ sơ báo cáo' });
    },
    'report-from-result': prefillReportFromResult,

    /* Người thân */
    'open-family': () => openSheet('family'),
    'close-sheet': closeSheet,
    'send-family': (el) => {
      const f = familyById(el.dataset.id);
      if (!f) return;
      el.classList.add('is-sent');
      const useEl = el.querySelector('.fr-send use');
      if (useEl) useEl.setAttribute('href', '#i-check');
      toast({
        type: 'success',
        title: `Đã gửi báo cáo tới ${esc(f.name)} (${esc(f.rel)})${state.offline ? ' qua SMS' : ''}`,
        desc: `Nội dung: “${esc(truncate(state.checkedText, 64))}”`
      });
      if (state.sheetOpen) setTimeout(closeSheet, 800);
    },
    'call-family': (el) => {
      const f = familyById(el.dataset.id);
      if (!f) return;
      toast({
        type: 'info',
        title: `Đang gọi ${esc(f.name)} · ${formatPhone(f.phone)}`,
        desc: 'Kết nối trực tiếp qua sóng di động.',
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

    /* Báo cáo đa kênh */
    'toggle-channel': (el) => {
      const ch = el.dataset.channel;
      if (state.channels.has(ch)) state.channels.delete(ch);
      else state.channels.add(ch);
      renderReportFormState(device);
    },
    'toggle-family-recipient': (el) => {
      const id = el.dataset.id;
      if (state.selectedFamilyIds.has(id)) state.selectedFamilyIds.delete(id);
      else state.selectedFamilyIds.add(id);
      renderReportFormState(device);
    },
    'report-type': (el) => {
      state.reportType = el.dataset.type;
      $(device, 'reportError').classList.remove('is-visible');
      renderReportFormState(device);
    },
    'pick-report-file': () => ui.reportFileInput.click(),
    'sample-malware': () => {
      state.reportFileMeta = { name: DEMO_FILE_RESULT.name, sha256: DEMO_FILE_RESULT.sha256 };
      ui.reportTarget.value = DEMO_FILE_RESULT.sha256;
      const badge = $(device, 'malwareBadge');
      badge.hidden = false;
      badge.textContent = `Mẫu tệp độc: ${DEMO_FILE_RESULT.name} · SHA-256: ${DEMO_FILE_RESULT.sha256.slice(0, 24)}…`;
      ui.reportText.value = 'Tệp cài đặt .apk giả mạo quà tri ân yêu cầu cấp quyền đọc tin nhắn OTP ngân hàng.';
    },
    'report-mic': toggleReportMic,
    'pick-ward': (el) => {
      state.reportWard = el.dataset.ward;
      renderReportFormState(device);
    },
    'report-submit': submitReport,
    'report-reset': () => { resetReport(); ui.viewport.scrollTo({ top: 0, behavior: 'auto' }); },
    'view-in-moderation': () => {
      state.volTab = 'review';
      state.reviewFilter = 'all';
      setVolTab(device, 'review');
      go('volunteer');
      if (state.lastCreatedReportId) {
        setTimeout(() => openReportDetailById(state.lastCreatedReportId, true), 260);
      }
    },

    /* Bài học & Thi thử */
    'learn-tab': (el) => {
      stopAudio();
      state.learnSubtab = el.dataset.subtab;
      setLearnTab(device, state.learnSubtab);
      ui.viewport.scrollTo({ top: 0, behavior: 'auto' });
    },
    flip: flipCard,
    'listen-lesson': () => {
      const l = LESSONS[state.lesson];
      const steps = l.steps.map((s, i) => `Bước ${i + 1}: ${s[0]}. ${s[1]}`).join(' ');
      const text = `Bài học phòng chống lừa đảo: ${l.title}. Tình huống thường gặp: ${l.quote} Ba bước xử lý an toàn: ${steps}`;
      playAudio({
        key: 'lesson-' + state.lesson,
        text,
        btn: $(device, 'lessonListenBtn'),
        bar: $(device, 'lessonListenBar')
      });
    },
    'pick-lesson': (el) => {
      stopAudio();
      state.lesson = Number(el.dataset.index);
      renderLesson(device, state.lesson, false);
      ui.viewport.scrollTo({ top: 0, behavior: 'smooth' });
    },
    answer: (el) => answerQuiz(el.dataset.choice),
    'quiz-next': nextQuiz,
    'quiz-restart': restartQuiz,

    /* Kiểm duyệt, Đọc báo cáo & Danh sách cảnh báo */
    'vol-tab': (el) => {
      stopAudio();
      state.volTab = el.dataset.vtab;
      setVolTab(device, state.volTab);
      ui.viewport.scrollTo({ top: 0, behavior: 'auto' });
    },
    'filter-review': (el) => {
      state.reviewFilter = el.dataset.filter;
      renderVolunteerAndWatchlist(device);
    },
    'open-report-detail': (el) => openReportDetailById(el.dataset.id, true),
    'speak-report-id': (el) => {
      const r = state.reports.find((x) => Number(x.id) === Number(el.dataset.id));
      if (!r) return;
      const m = TYPE_META[r.type] || TYPE_META.phone;
      const text = `Đọc báo cáo mã ${r.code} tại ${r.ward}. Loại: ${m.label}. Đối tượng: ${r.fileName || r.targetValue}. Nội dung: ${r.content}`;
      playAudio({ key: 'rv-' + r.id, text, toastTitle: `Đang đọc báo cáo #${r.code}` });
    },
    'quick-approve': (el) => applyReviewDecision(el.dataset.id, 'verified'),
    'listen-detail': () => playAudio({
      key: 'sheet-detail',
      text: state.detailReadText,
      btn: $(device, 'detailListenBtn'),
      bar: $(device, 'detailListenBar')
    }),
    'review-decision': (el) => {
      if (!state.detailTargetReportId) return;
      applyReviewDecision(state.detailTargetReportId, el.dataset.status, ui.reviewerNote.value);
    },
    'filter-watchlist': (el) => {
      state.watchlistType = el.dataset.wtype;
      renderVolunteerAndWatchlist(device);
    },
    'open-watchlist-detail': (el) => openWatchlistDetailByKey(el.dataset.key, false),
    'test-watchlist-item': (el) => {
      const wl = buildWatchlistFromReports(state.reports);
      const item = wl.find((x) => x.key === el.dataset.key);
      if (!item) return;
      go('home');
      setInputValue(device, item.targetValue);
      runCheck();
    },
    'export-poster': () => {
      ui.exportBtn.classList.add('is-loading');
      setTimeout(() => {
        ui.exportBtn.classList.remove('is-loading');
        openSheet('poster');
      }, 650);
    },
    'poster-save': () => {
      closeSheet();
      toast({ type: 'success', title: 'Đã lưu ảnh tuyên truyền vào máy', iconId: 'i-image' });
    },
    'poster-share': () => toast({ type: 'info', title: 'Đã mở chia sẻ nhóm khu phố, tổ dân phố', iconId: 'i-share' }),

    /* Cài đặt */
    'toggle-background': () => {
      state.settings.background = !state.settings.background;
      store.set('lcs.settings', state.settings);
      renderSettings(device, state.settings, state.family);
    },
    'toggle-option': (el) => {
      const key = el.dataset.option;
      state.settings[key] = !state.settings[key];
      store.set('lcs.settings', state.settings);
      renderSettings(device, state.settings, state.family);
    },
    'flush-queue': () => flushQueue()
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.closest('.g-frame')) return;
    if (el.disabled) return;
    const fn = ACTIONS[el.dataset.action];
    if (fn) fn(el, e);
  });

  /* Sự kiện ô nhập */
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
    ui.fileInput.value = '';
  });
  ui.reportFileInput.addEventListener('change', () => {
    const f = ui.reportFileInput.files && ui.reportFileInput.files[0];
    if (f) pickMalwareReportFile(f);
    ui.reportFileInput.value = '';
  });
  ui.watchlistSearch.addEventListener('input', () => {
    state.watchlistQuery = ui.watchlistSearch.value;
    renderVolunteerAndWatchlist(device);
  });

  /* Kéo thả tệp */
  ui.omni.addEventListener('dragover', (e) => { e.preventDefault(); ui.omni.classList.add('is-drop'); });
  ui.omni.addEventListener('dragleave', () => ui.omni.classList.remove('is-drop'));
  ui.omni.addEventListener('drop', (e) => {
    e.preventDefault();
    ui.omni.classList.remove('is-drop');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && !state.senior) chooseFile(f);
  });

  /* Form người thân */
  ui.contactForm.addEventListener('submit', (e) => { e.preventDefault(); submitContact(); });
  ui.contactName.addEventListener('input', () => { $(device, 'nameWrap').classList.remove('is-error'); $(device, 'nameError').classList.remove('is-visible'); });
  ui.contactPhone.addEventListener('input', () => { $(device, 'phoneWrap').classList.remove('is-error'); $(device, 'phoneError').classList.remove('is-visible'); });

  /* Thẻ lật */
  $(device, 'flipInner').addEventListener('transitionend', (e) => {
    if (e.propertyName !== 'transform') return;
    const flip = $(device, 'flip');
    if (flip.classList.contains('is-flipped')) flip.classList.add('is-settled');
  });

  /* Biểu đồ */
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

  /* Phím tắt nhanh */
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
    if (/^[1-6]$/.test(k)) {
      if (state.gallery) toggleGallery(false);
      go(SCREEN_ORDER[Number(k) - 1]);
    } else if (k === 'g') toggleGallery();
    else if (k === 'a') toggleSenior();
    else if (k === 'o') toggleOffline();
  });

  window.addEventListener('online', () => flushQueue({ silent: true }));
  window.addEventListener('beforeprint', () => { if (!state.gallery) toggleGallery(true); });

  /* ---------- 18. CO GIÃN VỪA MÀN HÌNH & ĐỒNG HỒ ---------- */
  function fitDevice() {
    if (isMobile()) {
      deviceWrap.style.setProperty('--dscale', '1');
      return;
    }
    const availH = window.innerHeight - 92;
    const availW = stage.clientWidth - 48;
    const s = Math.max(0.6, Math.min(1, availH / 812, availW / 390));
    deviceWrap.style.setProperty('--dscale', s.toFixed(3));
  }
  window.addEventListener('resize', fitDevice);

  function tickClock() {
    const d = new Date();
    $(device, 'clock').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /* ---------- 19. KHỞI TẠO ---------- */
  function init() {
    state.matchedItems = findWatchlistMatches(state.checkedText);
    renderResult(device, state.level, state.checkedText, state.matchedItems);
    renderReportFormState(device);
    renderLesson(device, 0, false);
    renderQuiz(device, 0, null, 0);
    renderChart(device);
    renderVolunteerAndWatchlist(device);
    renderFamilySheet(device, state.family);
    renderSettings(device, state.settings, state.family);
    renderServerStatus(device);

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
