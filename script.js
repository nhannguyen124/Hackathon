/* =============================================================
   LÁ CHẮN SỐ – Clickable Prototype
   Toàn bộ dữ liệu là giả lập (mock), không gọi API thật.
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

  /* ---------- 2. DỮ LIỆU GIẢ LẬP ---------- */
  const SCREENS = {
    home:      { code: '01_TrangChu',   title: 'Trang chủ & Kiểm tra nhanh', tab: 'check' },
    result:    { code: '02_KetQua',     title: 'Kết quả kiểm tra',           tab: 'check' },
    report:    { code: '04_BaoCao',     title: 'Báo cáo lừa đảo',            tab: 'check' },
    learn:     { code: '05_BaiHoc',     title: 'Bài học 01 phút',            tab: 'learn' },
    quiz:      { code: '06_Quiz',       title: 'Bài kiểm tra nhận diện',     tab: 'quiz' },
    volunteer: { code: '07_TinhNguyen', title: 'Dashboard Đội tình nguyện',  tab: 'volunteer' }
  };
  const SCREEN_ORDER = ['home', 'result', 'report', 'learn', 'quiz', 'volunteer'];

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

  /* ---------- 3. TRẠNG THÁI ---------- */
  const state = {
    screen: 'home',
    senior: false,
    offline: false,
    level: 'danger',
    checkedText: SAMPLES.police.text,
    familyEmpty: false,
    sheetOpen: false,
    reportType: null,
    forward: true,
    lesson: 0,
    learned: new Set(),
    quizIndex: 0,
    quizScore: 0,
    quizAnswered: false,
    sampleCursor: 0,
    gallery: false
  };

  const timers = { mic: null, typing: null, listen: null, check: null };

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
    checkBtn: $(device, 'checkBtn'),
    listen: $(device, 'listen'),
    listenBar: $(device, 'listenBar'),
    sheetLayer: $(device, 'sheetLayer'),
    sheet: $(device, 'sheet'),
    toastHost: $(device, 'toastHost'),
    reportText: $(device, 'reportText'),
    exportBtn: $(device, 'exportBtn')
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
      return 'Bạn chưa nhập nội dung. Hãy dán tin nhắn, số điện thoại (10 số) hoặc đường dẫn cần kiểm tra.';
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

  function analyze(raw) {
    const t = raw.toLowerCase();
    const danger = ['công an', 'tạm giữ', 'rửa tiền', 'chuyển tiền', 'chuyển gấp', 'otp', 'bắt giữ', 'điều tra', 'viện kiểm sát', 'tòa án', 'cấp cứu'];
    const warning = ['http', 'bit.ly', '.top', '.xyz', 'link', 'đường dẫn', 'quà', 'tri ân', 'trúng thưởng', 'nhận thưởng', 'việc nhẹ', 'ctv', 'hoàn tiền'];
    if (danger.some((k) => t.includes(k))) return 'danger';
    if (warning.some((k) => t.includes(k))) return 'warning';
    return 'safe';
  }

  /* ---------- 6. RENDERERS (nhận root để dùng lại cho Gallery) ---------- */
  function setScreen(root, key) {
    $$(root, '.screen').forEach((s) => s.classList.toggle('is-active', s.dataset.screen === key));
    const tab = SCREENS[key].tab;
    $$(root, '.tab').forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle('is-active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
  }

  function renderResult(root, level, text) {
    const r = RESULTS[level];
    const verdict = $(root, 'verdict');
    verdict.dataset.level = level;
    $(root, 'verdictIcon').setAttribute('href', '#' + r.icon);
    $(root, 'verdictBadge').textContent = r.badge;
    $(root, 'verdictTitle').textContent = r.title;
    $(root, 'verdictSub').textContent = r.sub;

    const type = detectType(text);
    $(root, 'checkedType').innerHTML = icon(type.icon) + type.label;
    $(root, 'checkedText').textContent = text;

    root.querySelector('.ai-card').dataset.level = level;
    $(root, 'conf').textContent = r.conf;
    $(root, 'reasons').innerHTML = r.reasons.map((h, i) => `<li data-n="${i + 1}">${h}</li>`).join('');

    const dot = $(root, 'shareDot');
    dot.className = 'lv-dot lv-' + level;
    $(root, 'shareText').textContent = truncate(text, 80);
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
    $(root, 'flip').classList.toggle('is-flipped', !!flipped);
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

  function setFamilyEmpty(root, empty) {
    $(root, 'sheet').classList.toggle('is-empty', empty);
  }

  function selectReportType(root, type) {
    $$(root, '.type-card').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.type === type)));
    $(root, 'typeError').classList.remove('is-visible');
    setStep(root, type ? 2 : 1);
  }

  function setStep(root, step, allDone = false) {
    $$(root, '[data-ref="stepper"] .step').forEach((s) => {
      const n = Number(s.dataset.step);
      s.classList.toggle('is-done', allDone || n < step);
      s.classList.toggle('is-active', !allDone && n === step);
    });
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

    state.screen = key;
    setScreen(device, key);
    ui.viewport.scrollTo({ top: 0, behavior: 'auto' });
    updateStageLabel();

    $$(inspector, '.ins-screen').forEach((b) => b.classList.toggle('is-active', b.dataset.target === key));
    if (isMobile()) inspector.classList.remove('is-open');
  }

  function updateStageLabel() {
    if (state.sheetOpen) {
      const poster = ui.sheet.dataset.mode === 'poster';
      stageCode.textContent = poster ? '07_TinhNguyen' : '03_HoiNguoiThan';
      stageTitle.textContent = poster ? 'Bottom sheet – Ảnh tuyên truyền' : 'Bottom sheet – Hỏi người thân';
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
    }, 3200);
  }

  /* ---------- 9. TRANG CHỦ: KIỂM TRA, MICRO ---------- */
  function runCheck() {
    if (ui.checkBtn.classList.contains('is-loading')) return;
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

    timers.check = setTimeout(() => {
      ui.omni.classList.remove('is-scanning');
      ui.checkBtn.classList.remove('is-loading');
      state.level = analyze(value);
      state.checkedText = value;
      renderResult(device, state.level, value);
      syncLevelButtons();
      go('result');
    }, 600);
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

  /* ---------- 10. KẾT QUẢ: NGHE ĐỌC ---------- */
  const LISTEN_SECONDS = 12;
  function startListen() {
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

  /* ---------- 11. BOTTOM SHEET ---------- */
  function openSheet(mode = 'family') {
    ui.sheet.dataset.mode = mode;
    ui.sheet.setAttribute('aria-label', mode === 'poster' ? 'Ảnh tuyên truyền' : 'Hỏi người thân');
    setFamilyEmpty(device, state.familyEmpty);
    $(device, 'shareText').textContent = truncate(state.checkedText, 80);
    $(device, 'shareDot').className = 'lv-dot lv-' + state.level;
    $$(device, '.fr-main').forEach(resetSendRow);
    ui.sheet.scrollTop = 0;
    ui.sheetLayer.classList.add('is-open');
    ui.sheetLayer.setAttribute('aria-hidden', 'false');
    state.sheetOpen = true;
    updateStageLabel();
    setTimeout(() => {
      const close = ui.sheet.querySelector(`.pane-${mode} [data-action="close-sheet"]`);
      if (close) close.focus({ preventScroll: true });
    }, 350);
  }

  function closeSheet() {
    if (!state.sheetOpen) return;
    ui.sheetLayer.classList.remove('is-open');
    ui.sheetLayer.setAttribute('aria-hidden', 'true');
    state.sheetOpen = false;
    updateStageLabel();
  }

  function resetSendRow(btn) {
    btn.classList.remove('is-sent');
    const label = btn.querySelector('.fr-send span');
    const use = btn.querySelector('.fr-send use');
    if (label) label.textContent = 'Gửi';
    if (use) use.setAttribute('href', '#i-send');
  }

  /* ---------- 12. BÁO CÁO ---------- */
  function prepareReport() {
    if (device.querySelector('[data-screen="report"]').classList.contains('is-done')) resetReport();
    if (!ui.reportText.value.trim()) ui.reportText.value = state.checkedText;
  }

  function resetReport() {
    state.reportType = null;
    setReportDone(device, false);
    selectReportType(device, null);
    ui.reportText.value = state.checkedText;
    const submit = $(device, 'reportSubmit');
    submit.classList.remove('is-loading');
  }

  function submitReport() {
    const submit = $(device, 'reportSubmit');
    if (!state.reportType) {
      const grid = $(device, 'typeGrid');
      grid.classList.remove('is-error');
      void grid.offsetWidth;
      grid.classList.add('is-error');
      $(device, 'typeError').classList.add('is-visible');
      ui.viewport.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!ui.reportText.value.trim()) ui.reportText.value = state.checkedText;
    submit.classList.add('is-loading');
    setStep(device, 3);
    setTimeout(() => {
      submit.classList.remove('is-loading');
      $(device, 'doneMeta').style.display = state.forward ? '' : 'none';
      setReportDone(device, true);
      ui.viewport.scrollTo({ top: 0, behavior: 'auto' });
    }, 750);
  }

  /* ---------- 13. QUIZ ---------- */
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
      const top = explain.offsetTop - 120;
      ui.viewport.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 250);
  }

  function nextQuiz() {
    if (state.quizIndex >= QUIZ.length - 1) {
      finishQuiz();
      return;
    }
    state.quizIndex += 1;
    state.quizAnswered = false;
    renderQuiz(device, state.quizIndex, null, state.quizScore);
    ui.viewport.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function finishQuiz() {
    const screen = device.querySelector('[data-screen="quiz"]');
    screen.classList.add('is-finished');
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

  /* ---------- 14. CHẾ ĐỘ: A+, OFFLINE, TRỐNG ---------- */
  function syncToggles() {
    $$(document, '[data-action="toggle-senior"]').forEach((b) => b.setAttribute('aria-checked', String(state.senior)));
    $$(document, '[data-action="toggle-offline"]').forEach((b) => b.setAttribute('aria-checked', String(state.offline)));
    $$(document, '[data-action="toggle-empty"]').forEach((b) => b.setAttribute('aria-checked', String(state.familyEmpty)));
    device.classList.toggle('is-senior', state.senior);
    device.classList.toggle('is-offline', state.offline);
    setFamilyEmpty(device, state.familyEmpty);
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
      ? { type: 'info', title: 'Đã bật chế độ Người cao tuổi', desc: 'Chữ to, nút lớn, ẩn bớt chi tiết phụ.', iconId: 'i-eye' }
      : { type: 'info', title: 'Đã về chế độ hiển thị tiêu chuẩn', iconId: 'i-eye' });
    if (state.gallery) buildGallery();
  }

  function toggleOffline() {
    state.offline = !state.offline;
    syncToggles();
    toast(state.offline
      ? { type: 'warn', title: 'Mất kết nối mạng', desc: 'Đã chuyển sang kiểm tra bằng dữ liệu trên máy.' }
      : { type: 'success', title: 'Đã kết nối lại', desc: 'Báo cáo lưu tạm sẽ được gửi tự động.', iconId: 'i-wifi' });
    if (state.gallery) buildGallery();
  }

  /* ---------- 15. GALLERY VIEW ---------- */
  let template = null;

  const GALLERY = [
    { code: '01_TrangChu', name: 'Trang chủ & Kiểm tra nhanh', screen: 'home' },
    { code: '01_TrangChu · Lỗi', name: 'Error State – nhập sai định dạng', screen: 'home',
      setup: (r) => { setInputValue(r, '09123'); setError(r, validate('09123')); } },
    { code: '02_KetQua · Nguy hiểm', name: 'Kết quả – mức Đỏ', screen: 'result',
      setup: (r) => renderResult(r, 'danger', SAMPLES.police.text) },
    { code: '02_KetQua · Nghi ngờ', name: 'Kết quả – mức Vàng', screen: 'result',
      setup: (r) => renderResult(r, 'warning', SAMPLES.gift.text) },
    { code: '02_KetQua · An toàn', name: 'Kết quả – mức Xanh', screen: 'result',
      setup: (r) => renderResult(r, 'safe', SAMPLES.safe.text) },
    { code: '03_HoiNguoiThan', name: 'Bottom sheet – danh sách người thân', screen: 'result',
      setup: (r) => { renderResult(r, 'danger', SAMPLES.police.text); setFamilyEmpty(r, false); openStaticSheet(r, 'family'); } },
    { code: '03_HoiNguoiThan · Trống', name: 'Empty State – chưa có người thân', screen: 'result',
      setup: (r) => { renderResult(r, 'danger', SAMPLES.police.text); setFamilyEmpty(r, true); openStaticSheet(r, 'family'); } },
    { code: '04_BaoCao', name: 'Báo cáo – chọn loại & thông tin', screen: 'report',
      setup: (r) => { selectReportType(r, 'call'); $(r, 'reportText').value = SAMPLES.police.text; } },
    { code: '04_BaoCao · Hoàn tất', name: 'Báo cáo – gửi thành công / lưu tạm', screen: 'report',
      setup: (r) => { selectReportType(r, 'call'); setReportDone(r, true); } },
    { code: '05_BaiHoc', name: 'Bài học – mặt trước thẻ', screen: 'learn',
      setup: (r) => renderLesson(r, 0, false) },
    { code: '05_BaiHoc · Mặt sau', name: 'Bài học – 3 bước xử lý', screen: 'learn',
      setup: (r) => renderLesson(r, 0, true) },
    { code: '06_Quiz', name: 'Quiz – câu hỏi nhận diện', screen: 'quiz',
      setup: (r) => renderQuiz(r, 0, null, 0) },
    { code: '06_Quiz · Giải thích', name: 'Quiz – highlight bẫy & giải thích', screen: 'quiz',
      setup: (r) => renderQuiz(r, 0, 'scam', 20) },
    { code: '07_TinhNguyen', name: 'Dashboard đội tình nguyện', screen: 'volunteer' },
    { code: '07_TinhNguyen · Ảnh', name: 'Xuất ảnh tuyên truyền nhanh', screen: 'volunteer',
      setup: (r) => openStaticSheet(r, 'poster') }
  ];

  function openStaticSheet(root, mode) {
    const layer = $(root, 'sheetLayer');
    $(root, 'sheet').dataset.mode = mode;
    layer.classList.add('is-open');
  }

  function buildGallery() {
    galleryGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    GALLERY.forEach((item, i) => {
      const clone = template.cloneNode(true);
      clone.removeAttribute('id');
      $$(clone, '[id]').forEach((n) => n.removeAttribute('id'));
      $$(clone, '[for]').forEach((n) => n.removeAttribute('for'));
      $$(clone, 'button, textarea').forEach((n) => n.setAttribute('tabindex', '-1'));
      clone.setAttribute('aria-hidden', 'true');
      clone.classList.add('is-static');
      clone.classList.toggle('is-senior', state.senior);
      clone.classList.toggle('is-offline', state.offline);
      $(clone, 'clock').textContent = '9:41';
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
    galleryMeta.textContent = `${GALLERY.length} màn hình & trạng thái · Hiển thị: ${state.senior ? 'Người cao tuổi (A+)' : 'Tiêu chuẩn'} · Mạng: ${state.offline ? 'Ngoại tuyến' : 'Trực tuyến'}`;
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
    $$(inspector, '[data-action="gallery"]').forEach((b) => b.classList.toggle('is-on', on));
    const label = inspector.querySelector('.ins-gallery-btn strong');
    if (label) label.textContent = on ? 'Về chế độ Prototype' : 'Xem tất cả màn hình';
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (isMobile()) inspector.classList.remove('is-open');
    if (!on) fitDevice();
  }

  /* ---------- 16. ACTIONS (event delegation) ---------- */
  const ACTIONS = {
    go: (el) => go(el.dataset.target),
    'toggle-senior': toggleSenior,
    'toggle-offline': toggleOffline,
    'toggle-empty': () => {
      state.familyEmpty = !state.familyEmpty;
      syncToggles();
      if (state.gallery) toggleGallery(false);
      if (state.familyEmpty) openSheet('family');
    },
    'set-level': (el) => {
      if (state.gallery) toggleGallery(false);
      state.level = el.dataset.level;
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
      setInputValue(device, '09123');
      setTimeout(runCheck, 220);
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
      setError(device, null);
      typeInto(s.text);
    },
    mic: () => (ui.omni.classList.contains('is-listening') ? stopMic(true) : startMic()),
    quick: (el) => {
      stopTyping();
      setError(device, null);
      setInputValue(device, SAMPLES[el.dataset.sample].text);
      runCheck();
    },

    listen: () => (ui.listen.classList.contains('is-playing') ? stopListen() : startListen()),
    'open-family': () => openSheet('family'),
    'close-sheet': closeSheet,
    'send-family': (el) => {
      if (el.classList.contains('is-sent')) return;
      el.classList.add('is-sent');
      el.querySelector('.fr-send span').textContent = 'Đã gửi';
      el.querySelector('.fr-send use').setAttribute('href', '#i-check');
      const name = el.dataset.name;
      const rel = el.dataset.rel;
      toast({
        type: 'success',
        title: `Đã gửi cảnh báo tới ${name} (${rel})${state.offline ? ' qua SMS' : ''}`,
        desc: `Kèm nội dung: “${esc(truncate(state.checkedText, 70))}”`
      });
      setTimeout(closeSheet, 900);
    },
    'call-family': (el) => toast({
      type: 'info',
      title: `Đang gọi ${el.dataset.name}…`,
      desc: state.offline ? 'Gọi qua sóng di động thường, không cần Internet.' : 'Cuộc gọi sẽ mở trong ứng dụng Điện thoại.',
      iconId: 'i-phone'
    }),
    'add-family': () => {
      if (state.familyEmpty) {
        state.familyEmpty = false;
        syncToggles();
        toast({ type: 'success', title: 'Đã thêm 2 người thân từ danh bạ', desc: 'Minh Anh (Con gái) · Hoàng Nam (Con trai)', iconId: 'i-user-plus' });
      } else {
        toast({ type: 'info', title: 'Mở danh bạ để chọn người thân', desc: 'Tối đa 5 người thân tin cậy.', iconId: 'i-user-plus' });
      }
    },

    'report-type': (el) => { state.reportType = el.dataset.type; selectReportType(device, state.reportType); },
    'toggle-forward': (el) => { state.forward = !state.forward; el.setAttribute('aria-checked', String(state.forward)); },
    'report-submit': submitReport,
    'report-reset': () => { resetReport(); ui.viewport.scrollTo({ top: 0, behavior: 'auto' }); },

    flip: () => {
      const flip = $(device, 'flip');
      const on = !flip.classList.contains('is-flipped');
      flip.classList.toggle('is-flipped', on);
      if (on && !state.learned.has(state.lesson)) {
        state.learned.add(state.lesson);
        $(device, 'learnProgress').innerHTML = `${icon('i-star')}${2 + state.learned.size}/12 bài`;
      }
    },
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
      toast({ type: 'success', title: 'Đã lưu ảnh vào Thư viện', desc: 'canh-bao-dien-luc-tam-hiep.png · 1080 × 1350', iconId: 'i-image' });
    },
    'poster-share': () => toast({ type: 'info', title: 'Đã mở bảng chia sẻ', desc: 'Gửi vào nhóm khu phố, tổ dân phố.', iconId: 'i-share' })
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.closest('.g-frame')) return;
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
    if (/^[1-6]$/.test(k)) {
      if (state.gallery) toggleGallery(false);
      go(SCREEN_ORDER[Number(k) - 1]);
    } else if (k === 'g') toggleGallery();
    else if (k === 'a') toggleSenior();
    else if (k === 'o') toggleOffline();
  });

  /* ---------- 17. CO GIÃN KHUNG MÁY & ĐỒNG HỒ ---------- */
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

  /* ---------- 18. KHỞI TẠO ---------- */
  function init() {
    renderResult(device, state.level, state.checkedText);
    renderLesson(device, 0, false);
    renderQuiz(device, 0, null, 0);
    renderChart(device);
    ui.reportText.value = state.checkedText;
    template = device.cloneNode(true);

    syncToggles();
    syncLevelButtons();
    updateStageLabel();
    fitDevice();
    tickClock();
    setInterval(tickClock, 30000);
  }

  init();
})();
