# Lá Chắn Số – Prototype phòng chống lừa đảo trực tuyến (Đồng Nai)

Ứng dụng web mobile-first hỗ trợ kiểm tra nhanh, gửi báo cáo đa kênh, tổng hợp danh sách cảnh báo trên máy chủ và kiểm duyệt báo cáo cho cán bộ cơ sở.

## Chạy nhanh (chế độ demo)

Mở trực tiếp `index.html` bằng trình duyệt. Mọi màn hình đều tương tác đầy đủ; đối chiếu danh sách cảnh báo, quét tệp, đọc báo cáo bằng giọng nói và kiểm duyệt hoạt động ngay trên dữ liệu mẫu.

## Chạy đầy đủ (VirusTotal + cơ sở dữ liệu SQLite / JSON)

Yêu cầu Node.js 18 trở lên, không cần `npm install`.

```bash
cp .env.example .env      # tuỳ chọn điền VIRUSTOTAL_API_KEY, ADMIN_TOKEN
npm start                 # mở http://localhost:3000
```

- **Giao diện vừa khít màn hình điện thoại**: Trang 1 tinh gọn trên một màn hình đơn, không cần cuộn dài; trên thiết bị cảm ứng hỗ trợ mở trực tiếp ứng dụng gọi điện (`tel:`) và nhắn tin (`sms:`).
- **Báo cáo đa kênh & lưu trữ ngoại tuyến**: Gửi tới **Người thân**, **Cán bộ / Công an xã phường**, hoặc gửi **Số điện thoại, Trang web, Mã file độc (SHA-256), Tài khoản** lên **Máy chủ** để tự động tổng hợp vào **Danh sách cảnh báo** (`data/reports.db` dùng `node:sqlite`, hoặc `data/reports.json`). Khi mất mạng, báo cáo được giữ trên máy và tự đồng bộ khi có mạng lại.
- **Bài học & Thi thử gộp gọn**: Chuyển đổi mượt giữa Bài học 1 phút và Thi thử nhận diện (5 câu) trong cùng một trang kỹ năng.
- **Chế độ Người cao tuổi tối giản**: Không chỉ tăng cỡ chữ mà ẩn triệt để các tính năng kỹ thuật không cần thiết (quét mã băm, thi thử chấm điểm, kiểm duyệt cán bộ, cấu hình máy chủ), chỉ giữ kiểm tra, giọng nói và gọi/nhắn người thân 1 chạm.
- **Đọc báo cáo khi kiểm tra & kiểm duyệt**: Xem toàn văn hồ sơ báo cáo và phát giọng đọc tiếng Việt (Text-to-Speech) cả ở màn hình Kết quả kiểm tra lẫn màn hình Cán bộ kiểm duyệt (hỗ trợ xác thực `ADMIN_TOKEN` qua header `x-admin-token` khi cấu hình).

### API

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/health` | Trạng thái máy chủ, khoá VirusTotal, loại cơ sở dữ liệu |
| POST | `/api/scan` | Thân yêu cầu là nội dung tệp (≤ 32 MB); header `X-File-Name` |
| GET | `/api/scan/:id` | Hỏi kết quả phân tích tệp đang chờ |
| POST | `/api/reports` | Gửi báo cáo (`type`, `targetValue`/`target`, `fileHash`, `channels`/`recipients`, `ward`, `content`, `clientId`) |
| GET | `/api/lookup?q=...` | Đối chiếu nhanh SĐT / trang web / mã file SHA-256 / STK với danh sách cảnh báo |
| GET | `/api/watchlist` (`/api/warnings`) | Danh sách cảnh báo tổng hợp trên máy chủ |
| GET | `/api/reports` (`/api/moderation`) | Danh sách báo cáo phục vụ kiểm tra, kiểm duyệt (hỗ trợ `x-admin-token`) |
| PATCH / POST | `/api/reports/:id` (`/api/moderation/:id`) | Cán bộ kiểm duyệt báo cáo (`verified`/`approve` hoặc `dismissed`/`reject` + ghi chú) |
| GET | `/api/stats` | Thống kê tổng hợp số lượng báo cáo |

## Cấu trúc

- `index.html`, `style.css`, `script.js` – giao diện (HTML/CSS/JS thuần, font Be Vietnam Pro)
- `server.js` – máy chủ API không phụ thuộc thư viện ngoài
- `.env.example` – mẫu cấu hình (tệp `.env` và thư mục `data/` không được commit)
