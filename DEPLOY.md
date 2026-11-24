# Triển khai công khai (để VirusTotal chạy thật)

Bản mở từ GitHub (mở thẳng `index.html` hoặc GitHub Pages) **luôn ở chế độ demo**: GitHub Pages chỉ phục vụ tệp tĩnh, không chạy được `server.js`, mà `script.js` chỉ dùng VirusTotal thật khi gọi được `/api/health` và nhận `virustotal: true`. Muốn quét tệp thật trên bản public thì phải deploy `server.js` lên một nơi chạy được Node và khai báo `VIRUSTOTAL_API_KEY` ở đó.

Dưới đây là cách deploy bằng **Render** (có sẵn `render.yaml` trong repo, không cần thư viện ngoài, không cần Docker).

## 1. Deploy bằng Render Blueprint

1. Đẩy repo này lên GitHub (nhánh `main`).
2. Vào [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
3. Chọn repo → Render đọc `render.yaml` và hiện service `la-chan-so`.
4. Render hỏi 2 biến bí mật (`sync: false`), điền:
   - `VIRUSTOTAL_API_KEY`: khoá lấy tại [virustotal.com](https://www.virustotal.com) → đăng nhập → **API Key**.
   - `ADMIN_PASSWORD`: mật khẩu Quản trị viên bạn muốn dùng (tài khoản là `admin`, đổi tên bằng `ADMIN_USERNAME`).
5. Bấm **Apply** → đợi build xong, Render cấp URL dạng `https://la-chan-so.onrender.com`.

`AUTH_SECRET` do Render tự sinh một lần và giữ nguyên qua các lần deploy, không cần nhập tay.

## 2. Các biến môi trường

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `VIRUSTOTAL_API_KEY` | Có, để quét thật | Thiếu biến này `/api/health` trả `virustotal: false` và giao diện quay về demo. |
| `HOST` | **Có trên Render** | Phải là `0.0.0.0`. `server.js` mặc định `127.0.0.1` (chỉ máy local), nếu không ghi đè thì service chạy nhưng không nhận được request → Render báo health check thất bại. |
| `PORT` | Không | Render tự cấp; `server.js` đọc `process.env.PORT`. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Nên đặt | Tạo tài khoản Quản trị viên ở lần chạy đầu tiên. Để trống thì rơi về `admin / admin123` (chỉ để demo, server có cảnh báo trong log). |
| `AUTH_SECRET` | Không | Khoá ký token đăng nhập (7 ngày). Để trống thì server tự sinh và lưu `data/.auth_secret` — nhưng trên Render ổ đĩa là tạm, nên để Render sinh qua `generateValue: true` sẽ ổn định hơn. |
| `DATA_DIR` | Không | Thư mục dữ liệu, mặc định `data`. Chỉ đặt khi gắn đĩa vĩnh viễn (xem mục 4). |
| `ADMIN_TOKEN` | Không | Mã cũ cho script gọi `x-admin-token`; không cần nếu đã dùng đăng nhập admin. |
| `NODE_VERSION` | Không | Đã ghim `22` trong `render.yaml`; từ Node 22.13 trở lên `node:sqlite` chạy không cần flag. Máy chủ vẫn tự chuyển sang `data/reports.json` nếu không có `node:sqlite`. |

## 3. Kiểm tra sau khi deploy

1. Mở `https://<tên-service>.onrender.com/api/health` → phải thấy:
   ```json
   {"ok":true,"virustotal":true,"database":"sqlite"}
   ```
   Nếu `virustotal` là `false`: biến `VIRUSTOTAL_API_KEY` chưa được lưu (sửa ở **Environment** rồi **Manual Deploy** lại).
2. Mở trang chủ, vào phần quét tệp: dòng trạng thái phải ghi **“Đã kết nối VirusTotal API”** thay vì nhãn demo.
3. Quét thử một tệp nhỏ bất kỳ → kết quả trả về có `nguồn: VirusTotal`, số công cụ cảnh báo và link `virustotal.com/gui/file/...`.
4. Đăng nhập `admin` + `ADMIN_PASSWORD` → mở màn Kiểm duyệt để chắc chắn quyền admin hoạt động.

## 4. Giới hạn của gói Free và cách khắc phục

- **Ổ đĩa tạm**: free plan không gắn được đĩa, nên `data/reports.db` và `data/users.json` **mất mỗi lần deploy/restart** (báo cáo về 0, tài khoản về mặc định). Muốn giữ dữ liệu: đổi `plan: free` → `plan: starter`, bỏ comment khối `DATA_DIR=/var/data` + `disk:` trong `render.yaml` (mountPath `/var/data`, `sizeGB: 1`).
- **Ngủ sau ~15 phút không truy cập**: request đầu tiên sau đó chậm vài chục giây. Không ảnh hưởng kết quả quét.
- **Hạn mức VirusTotal free**: khoảng 4 lượt/phút và 500 lượt/ngày cho mỗi khoá. `server.js` đã giới hạn 6 lượt quét/phút mỗi IP, nhưng nếu nhiều người dùng cùng lúc vẫn có thể bị `429` từ VirusTotal.
- **Đổi mật khẩu admin sau khi đã có dữ liệu**: `ADMIN_PASSWORD` chỉ có tác dụng khi tạo `data/users.json` lần đầu. Muốn đổi, phải xoá `data/users.json` (hoặc `DATA_DIR` trên Render) rồi deploy lại — thao tác này xoá luôn các tài khoản đã đăng ký.

## 5. Dùng nền tảng khác (Railway, Fly.io, VPS…)

Không cần đổi code, chỉ cần: chạy `npm start`, đặt `VIRUSTOTAL_API_KEY`, `ADMIN_PASSWORD`, `AUTH_SECRET`, và **`HOST=0.0.0.0`** (cùng `PORT` do nền tảng cấp nếu có). Nhớ đặt `DATA_DIR` vào thư mục có ổ đĩa vĩnh viễn nếu muốn giữ báo cáo.

## 6. Bảo mật

- Không commit `.env` và không dán khoá VirusTotal vào mã nguồn hay `render.yaml`; chỉ nhập ở mục **Environment** của dashboard (đúng như `render.yaml` đang cấu hình `sync: false`).
- Nếu khoá từng bị lộ (dán vào chat, ảnh chụp, commit), vào VirusTotal thu hồi và tạo khoá mới.
