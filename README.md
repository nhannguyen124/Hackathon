# Lá Chắn Số – Prototype phòng chống lừa đảo trực tuyến (Đồng Nai)

Ứng dụng web mobile-first hỗ trợ kiểm tra nhanh, gửi báo cáo đa kênh, tổng hợp danh sách cảnh báo trên máy chủ và kiểm duyệt báo cáo cho cán bộ cơ sở.

## Chạy nhanh (chế độ demo)

Mở trực tiếp `index.html` bằng trình duyệt. Mọi màn hình đều tương tác đầy đủ; đối chiếu danh sách cảnh báo, quét tệp, đọc báo cáo bằng giọng nói và kiểm duyệt hoạt động ngay trên dữ liệu mẫu.

## Chạy đầy đủ với máy chủ (`server.js` + SQLite / JSON + VirusTotal)

Yêu cầu Node.js 18 trở lên, không cần `npm install`.

```bash
cp .env.example .env      # tuỳ chọn điền VIRUSTOTAL_API_KEY, ADMIN_TOKEN
npm start                 # mở http://localhost:3000
```

- **Giao diện vừa khít màn hình điện thoại**: Trang 1 tinh gọn trên một màn hình đơn, không cần cuộn dài.
- **Báo cáo đa kênh**: Gửi tới **Người thân**, **Cán bộ / Công an xã phường**, hoặc gửi **Số điện thoại, Trang web, Mã file độc (SHA-256), Tài khoản** lên **Máy chủ** để tự động tổng hợp vào **Danh sách cảnh báo**.
- **Bài học & Thi thử gộp gọn**: Chuyển đổi mượt ngay trong cùng một trang kỹ năng.
- **Chế độ Người cao tuổi tối giản**: Không chỉ tăng cỡ chữ mà ẩn triệt để các tính năng kỹ thuật không cần thiết (quét mã băm, thi thử chấm điểm, kiểm duyệt cán bộ, cấu hình máy chủ), chỉ giữ kiểm tra, giọng nói và gọi/nhắn người thân 1 chạm.
- **Đọc báo cáo khi kiểm tra & kiểm duyệt**: Xem toàn văn hồ sơ báo cáo và phát giọng đọc tiếng Việt (Text-to-Speech) cả ở màn hình Kết quả kiểm tra lẫn màn hình Cán bộ kiểm duyệt.

### API

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/health` | Trạng thái máy chủ, khoá VirusTotal, loại cơ sở dữ liệu |
| POST | `/api/scan` | Quét tệp (≤ 32 MB) qua VirusTotal |
| GET | `/api/scan/:id` | Hỏi kết quả phân tích tệp đang chờ |
| POST | `/api/reports` | Gửi báo cáo (`type: phone\|web\|malware\|bank\|sms`, `targetValue`, `fileHash`, `channels`, `ward`, `content`) |
| GET | `/api/reports` | Danh sách báo cáo phục vụ kiểm tra, kiểm duyệt |
| PATCH | `/api/reports/:id` | Cán bộ kiểm duyệt báo cáo (`verified` / `dismissed` + ghi chú) |
| GET | `/api/watchlist` | Danh sách cảnh báo tổng hợp trên máy chủ |
| GET | `/api/lookup?q=...` | Đối chiếu nhanh nội dung kiểm tra với danh sách cảnh báo |
| GET | `/api/stats` | Thống kê tổng hợp số lượng báo cáo |
