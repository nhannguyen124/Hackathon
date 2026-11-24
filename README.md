# Lá Chắn Số – Prototype phòng chống lừa đảo trực tuyến (Đồng Nai)

Clickable prototype mobile-first cho vòng sơ loại Hackathon UX/UI.

## Chạy nhanh (chế độ demo)

Mở trực tiếp `index.html` bằng trình duyệt. Mọi màn hình đều bấm được; quét tệp và gửi báo cáo chạy bằng dữ liệu mẫu và được ghi rõ là **demo** trên giao diện.

## Chạy đầy đủ (VirusTotal + cơ sở dữ liệu)

Yêu cầu Node.js 18 trở lên, không cần `npm install`.

```bash
cp .env.example .env      # điền VIRUSTOTAL_API_KEY (và ADMIN_TOKEN nếu cần)
npm start                 # mở http://localhost:3000
```

- **Quét tệp**: trình duyệt gửi tệp (≤ 32 MB) tới `server.js`; máy chủ tra cứu mã SHA-256 trên VirusTotal, nếu tệp chưa có thì tải lên để phân tích. Khoá API chỉ nằm trên máy chủ, không bao giờ gửi xuống trình duyệt. Lưu ý: tệp tải lên VirusTotal có thể được chia sẻ với cộng đồng bảo mật.
- **Kiểm duyệt**: cán bộ/tình nguyện viên nhập `ADMIN_TOKEN` ở tab Tình nguyện để đọc và duyệt báo cáo. Chỉ báo cáo đã duyệt (và người gửi chọn chia sẻ cộng đồng) mới vào danh sách cảnh báo và hiện khi người khác kiểm tra.
- **Báo cáo lừa đảo**: lưu vào SQLite (`data/reports.db`, dùng `node:sqlite` có sẵn từ Node 22.5); Node cũ hơn sẽ tự lưu vào `data/reports.json`. Khi mất mạng, báo cáo được giữ trên máy và tự gửi khi có mạng lại (không bị trùng nhờ `clientId`).

### API

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/health` | Trạng thái máy chủ, đã có khoá VirusTotal chưa, loại cơ sở dữ liệu |
| POST | `/api/scan` | Thân yêu cầu là nội dung tệp; header `X-File-Name` |
| GET | `/api/scan/:id` | Hỏi kết quả phân tích đang chờ |
| POST | `/api/reports` | `{ type: phone/link/file/bank, target, content, recipients: { server, officials, family }, clientId }` – vào hàng chờ duyệt |
| GET | `/api/lookup?q=…` | Tra SĐT / đường dẫn / mã tệp / STK: số báo cáo đã duyệt và đang chờ (dùng khi Kiểm tra) |
| GET | `/api/warnings` | Danh sách cảnh báo cộng đồng (báo cáo đã duyệt, gộp theo đối tượng) |
| GET | `/api/moderation` | Báo cáo chờ duyệt – cần header `x-admin-token` |
| POST | `/api/moderation/:id` | `{ action: "approve" \| "reject" }` – cần header `x-admin-token` |
| GET | `/api/reports` | Toàn bộ báo cáo – cần header `x-admin-token` |
| GET | `/api/stats` | Tổng số báo cáo theo loại |

## Cấu trúc

- `index.html`, `style.css`, `script.js` – giao diện (HTML/CSS/JS thuần, font Be Vietnam Pro)
- `server.js` – máy chủ API không phụ thuộc thư viện ngoài
- `.env.example` – mẫu cấu hình (tệp `.env` và thư mục `data/` không được commit)
