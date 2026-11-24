// DỮ LIỆU MÔ PHỎNG 3 MỨC CẢNH BÁO
const RISK_TEMPLATES = {
  danger: {
    badge: "🛡️ NGUY HIỂM",
    title: "Có dấu hiệu lừa đảo rõ rệt",
    reasons: [
      "Cơ quan Công an <strong>không làm việc</strong> hoặc yêu cầu chuyển tiền qua điện thoại.",
      "Phát hiện từ khóa thúc giục: <em>\"chuyển tiền gấp\", \"tạm giữ tài khoản\"</em>.",
      "Số điện thoại trùng khớp với <strong>12 lượt báo cáo</strong> tại địa phương."
    ]
  },
  warning: {
    badge: "⚠️ NGHI NGỜ",
    title: "Cần xác minh trước khi bấm",
    reasons: [
      "Đường dẫn rút gọn không phải tên miền chính thức của cơ quan/ngân hàng.",
      "Nội dung chứa lời mời nhận quà miễn phí hoặc yêu cầu cung cấp mã OTP.",
      "Nên hỏi ý kiến người thân trước khi thao tác tiếp."
    ]
  },
  safe: {
    badge: "✅ AN TOÀN",
    title: "Chưa phát hiện dấu hiệu bất thường",
    reasons: [
      "Không nằm trong danh sách báo cáo lừa đảo tại Đồng Nai.",
      "Không phát hiện đường dẫn độc hại hay từ khóa thúc ép chuyển tiền.",
      "Vẫn luôn giữ cảnh giác nếu được yêu cầu chuyển tiền gấp."
    ]
  }
};

// TRẠNG THÁI ỨNG DỤNG
let isSeniorMode = false;
let isOfflineMode = false;
let isSpeaking = false;

const phoneFrame = document.getElementById("phoneFrame");
const insSeniorToggle = document.getElementById("insSeniorToggle");
const insOfflineToggle = document.getElementById("insOfflineToggle");
const offlineBanner = document.getElementById("offlineBanner");
const offlineResultNote = document.getElementById("offlineResultNote");

// 1. ĐIỀU HƯỚNG MÀN HÌNH
function navigateTo(screenId) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  const target = document.getElementById(`screen-${screenId}`);
  if (target) target.classList.add("active");

  // Đồng bộ trạng thái active trên Bottom Nav & Inspector
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.goto === screenId);
  });
}

document.querySelectorAll("[data-goto]").forEach((btn) => {
  btn.addEventListener("click", () => navigateTo(btn.dataset.goto));
});

// 2. CHẾ ĐỘ NGƯỜI CAO TUỔI (ADAPTIVE UI)
function setSeniorMode(enabled) {
  isSeniorMode = enabled;
  phoneFrame.classList.toggle("senior-mode", enabled);
  insSeniorToggle.checked = enabled;
  showToast(enabled ? "Đã bật Chế độ Người cao tuổi (Chữ lớn)" : "Đã chuyển về Chế độ Tiêu chuẩn");
}

document.getElementById("btnSeniorMode").addEventListener("click", () => {
  setSeniorMode(!isSeniorMode);
});
insSeniorToggle.addEventListener("change", (e) => setSeniorMode(e.target.checked));

// 3. CHẾ ĐỘ MẤT MẠNG (OFFLINE-FIRST)
function setOfflineMode(enabled) {
  isOfflineMode = enabled;
  insOfflineToggle.checked = enabled;
  offlineBanner.classList.toggle("hidden", !enabled);
  offlineResultNote.classList.toggle("hidden", !enabled);

  const meta = document.getElementById("resultMeta");
  meta.textContent = enabled
    ? "Kiểm tra NGOẠI TUYẾN bằng bộ nhớ trên máy • Cập nhật 08:00"
    : "Phân tích bởi AI trực tuyến • Cập nhật hôm nay";

  const submitBtn = document.getElementById("btnSubmitReport");
  submitBtn.textContent = enabled
    ? "💾 Lưu báo cáo (Tự gửi khi có mạng)"
    : "Gửi báo cáo ngay";
}

insOfflineToggle.addEventListener("change", (e) => setOfflineMode(e.target.checked));

// 4. LUỒNG KIỂM TRA NHANH & XỬ LÝ LỖI NHẬP LIỆU
function pasteSampleText() {
  clearInputError();
  document.getElementById("checkInput").value =
    "Cơ quan Công an thông báo tài khoản của bạn liên quan vụ án. Yêu cầu chuyển tiền gấp để xác minh.";
  showToast("Đã dán tin nhắn mẫu giả lập");
}

function simulateVoiceInput() {
  clearInputError();
  document.getElementById("checkInput").value =
    "Có số lạ gọi nói con tôi gặp tai nạn cần chuyển tiền gấp vào số tài khoản 1900xxxx";
  showToast("🎙️ Đã nhận diện giọng nói");
}

function triggerInputError() {
  navigateTo("home");
  document.getElementById("omniBox").classList.add("error");
  document.getElementById("inputErrorMsg").classList.remove("hidden");
}

function clearInputError() {
  document.getElementById("omniBox").classList.remove("error");
  document.getElementById("inputErrorMsg").classList.add("hidden");
}

function runCheck() {
  const val = document.getElementById("checkInput").value.trim();
  if (val.length < 4) {
    triggerInputError();
    return;
  }
  clearInputError();

  // Phân loại nhanh cho mục đích mô phỏng
  const lower = val.toLowerCase();
  if (lower.includes("công an") || lower.includes("chuyển tiền gấp") || lower.includes("tai nạn")) {
    setRiskLevel("danger");
  } else if (lower.includes("link") || lower.includes("quà") || lower.includes("http")) {
    setRiskLevel("warning");
  } else {
    setRiskLevel("safe");
  }
}

function fillAndCheck(level) {
  clearInputError();
  setRiskLevel(level);
}

// 5. HIỂN THỊ KẾT QUẢ 3 MỨC ĐỘ (ĐÈN GIAO THÔNG)
function setRiskLevel(level) {
  const data = RISK_TEMPLATES[level] || RISK_TEMPLATES.danger;
  const card = document.getElementById("resultCard");
  card.className = `result-card ${level}`;

  document.getElementById("resultBadge").textContent = isOfflineMode
    ? `${data.badge} (NGOẠI TUYẾN)`
    : data.badge;
  document.getElementById("resultTitle").textContent = data.title;
  document.getElementById("resultReasons").innerHTML = data.reasons
    .map((r) => `<li>${r}</li>`)
    .join("");

  navigateTo("result");
}

function toggleSpeak() {
  const btn = document.getElementById("btnSpeakResult");
  isSpeaking = !isSpeaking;
  btn.textContent = isSpeaking ? "⏹️ Đang đọc cảnh báo... (Chạm để dừng)" : "🔊 Nghe đọc cảnh báo";
  if (isSpeaking) showToast("🔊 Đang phát giọng nói đọc kết quả");
}

// 6. BÁO CÁO LỪA ĐẢO
function selectReportType(el) {
  document.querySelectorAll(".type-card").forEach((c) => c.classList.remove("active"));
  el.classList.add("active");
}

function submitReport() {
  if (isOfflineMode) {
    showToast("💾 Đã lưu tạm. Hệ thống sẽ tự gửi khi có mạng trở lại.");
  } else {
    showToast("✅ Đã gửi báo cáo & chuyển tiếp tới kênh Công an.");
  }
  setTimeout(() => navigateTo("dashboard"), 900);
}

// 7. QUIZ NHẬN DIỆN LỪA ĐẢO
function answerQuiz(choseScam) {
  const bubble = document.getElementById("smsBubble");
  const fb = document.getElementById("quizFeedback");
  bubble.classList.add("revealed");
  fb.classList.remove("hidden");

  if (choseScam) {
    document.getElementById("quizScore").textContent = "Điểm: 10";
    fb.style.background = "#dcfce7";
    fb.style.color = "#14532d";
    fb.textContent = "✅ Chính xác! Đây là bẫy tuyển CTV \"việc nhẹ lương cao\" kèm link rút gọn đáng ngờ.";
  } else {
    fb.style.background = "#fee2e2";
    fb.style.color = "#7f1d1d";
    fb.textContent = "❌ Chưa đúng! Hãy chú ý các từ khóa bôi đỏ: hứa lương cao bất thường và link lạ.";
  }
}

// 8. MODAL HỎI NGƯỜI THÂN & TRẠNG THÁI TRỐNG (EMPTY STATE)
function openFamilyModal(forceEmpty = false) {
  document.getElementById("familyModal").classList.remove("hidden");
  document.getElementById("familyListView").classList.toggle("hidden", forceEmpty);
  document.getElementById("familyEmptyView").classList.toggle("hidden", !forceEmpty);
}

function closeFamilyModal() {
  document.getElementById("familyModal").classList.add("hidden");
}

function sendFamilyAlert(name) {
  closeFamilyModal();
  const method = isOfflineMode ? "mở gọi/SMS không cần mạng tới" : "gửi cảnh báo tới";
  showToast(`📞 Đã ${method} ${name}`);
}

// 9. TOAST THÔNG BÁO
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2500);
}