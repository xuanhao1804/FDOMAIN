# Hướng dẫn thiết lập cho Admin (Setup Guide)

Tài liệu này hướng dẫn cấu hình **Vercel Fullstack**, **Name.com API**, **Namecheap / Cloudflare**, và **GitHub Actions** cho FDOMAIN v2.

---

## 1. Cấu hình Domain & Nhà cung cấp DNS

Trong [`config.json`](../config.json), khai báo các domain gốc bạn sở hữu tại mảng `rootDomains[]`:

- **`namecom`** (ví dụ `harrylee.dev` mua tại Name.com):
  1. Vào **Name.com → Account Settings → Security → API Tokens** và tạo API Token.
  2. Nếu tài khoản bật 2FA, bật tùy chọn **Name.com API Access = On** trong phần Security.
  3. Chế độ này hỗ trợ tạo / xem / xóa DNS trực tiếp từ Vercel Serverless (không cần IP cố định).
- **`namecheap-manual`** (ví dụ `vinamuse.store` dùng Namecheap BasicDNS):
  1. Giữ nguyên Nameserver mặc định ở Namecheap → dùng bảng record Copy 1-click trên trang `/claim/` dán vào **Domain List → Manage → Advanced DNS**, rồi bấm **Verify Live DNS** ngay trên web.
  2. *(Tùy chọn tự động hóa hoàn toàn)*: Nếu bạn trỏ 2 Nameserver của `vinamuse.store` sang **Cloudflare Free**, chỉ cần đổi `"dnsProvider": "cloudflare-api"` trong `config.json` là tạo/xóa tự động 1-click giống hệt Name.com.
- **`cloudflare-api` / `cloudflare-gitops`**:
  1. Vào Cloudflare Dashboard → *My Profile → API Tokens → Create Token* → **Edit zone DNS** (`Zone:Read`, `Zone:DNS:Edit`).

---

## 2. Cấu hình Vercel Project (Bắt buộc cho API Routes v2)

Vì FDOMAIN v2 chạy Next.js App Router với Route Handlers (`/api/auth/*`, `/api/dns/*`, `/api/health`):

1. Trong **Vercel Dashboard → Project `fdomain` → Settings → General → Root Directory**: đặt là **`site`**, Framework Preset: **Next.js**. *(Mở rộng: bật "Include source files outside of the Root Directory", mặc định đã bật.)*
2. Vào **Settings → Git**: kết nối tới GitHub repo `xuanhao1804/FDOMAIN` (Production Branch: `main`).
3. Vào **Settings → Environment Variables**, thêm các biến sau (tham khảo [`.env.example`](../.env.example), **không bao giờ commit secret lên Git**):
   - `ADMIN_PASSWORD`: mật khẩu dùng để mở khóa nút tạo/xóa DNS trên web.
   - `SESSION_SECRET`: chuỗi ngẫu nhiên ≥ 32 ký tự để ký `HttpOnly` session cookie.
   - `NAMECOM_USERNAME` & `NAMECOM_TOKEN`: thông tin Name.com API cho `harrylee.dev`.
   - *(Tùy chọn)* `CLOUDFLARE_API_TOKEN`: nếu dùng `cloudflare-api` cho các zone trỏ qua Cloudflare.

---

## 3. Chạy thử trên máy local

```bash
cp .env.example site/.env.local
# Điền ADMIN_PASSWORD, NAMECOM_USERNAME, NAMECOM_TOKEN vào site/.env.local
npm install && npm --prefix site install
npm run site:data
npm --prefix site run dev
```

Mở `http://localhost:3000/`, bấm **Unlock Admin Mode** ở góc dưới sidebar để kiểm tra tạo/xóa DNS.

---

## 4. Dùng CLI nhanh cho GitOps (`domains/`)

```bash
# Xem danh sách
npm run sub -- list

# Thêm subdomain cho domain mặc định (harrylee.dev)
npm run sub -- add notes --cname cname.vercel-dns.com --push

# Thêm subdomain cho domain khác trong config.json (vinamuse.store)
npm run sub -- add shop --domain vinamuse.store --cname cname.vercel-dns.com --push

# Xóa subdomain
npm run sub -- remove shop --domain vinamuse.store --push
```
