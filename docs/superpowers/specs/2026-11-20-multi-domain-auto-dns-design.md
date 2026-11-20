# FDOMAIN v2 — Multi-Domain Fullstack Portal & Auto-DNS

Ngày: 2026-11-20 · Trạng thái: **Approved** · Thay thế cho mô hình chỉ 1 domain tĩnh ở v1 khi vận hành cho chủ sở hữu.

## 1. Mục đích & Lý do nâng cấp

Ở v1 ([2026-11-20-subdomain-registry-design.md](./2026-11-20-subdomain-registry-design.md)), FDOMAIN mới chỉ hỗ trợ **một** domain mẫu (`harrylee.dev`), build ra site tĩnh (`output: 'export'`), và bắt buộc mở Pull Request GitHub mỗi lần thêm subdomain. Cách này gây chậm trễ cho chính chủ dự án khi muốn tạo subdomain nhanh cho nhiều dự án cá nhân trên **nhiều root domain đang sở hữu**:
- **`harrylee.dev`** (mua tại **Name.com**)
- **`vinamuse.store`** (mua tại **Namecheap**)

Mục tiêu v2: biến cổng web Next.js (`site/`) thành bảng điều khiển **Multi-Domain Fullstack chạy ngay trên Vercel**: chọn root domain đang mở → nhập subdomain (ô nhập tự đổi đuôi `.domain` sát phải) → tự sinh sẵn bảng record `CNAME / A / TXT` có nút Copy **và** cho phép admin bấm 1 nút tạo/xóa record DNS thật ngay lập tức qua API (không cần PR thủ công), trong khi vẫn giữ nguyên tính tương thích GitOps / CLI cho cộng tác viên ngoài nếu cần.

---

## 2. Ràng buộc kỹ thuật đã xác minh

1. **Nameserver thực tế hiện tại (truy vấn DNS `1.1.1.1`):**
   - `harrylee.dev` đang dùng NS của Name.com (`ns1psw.name.com`..`ns4sxy.name.com`) → gọi trực tiếp **Name.com Core API (`core/v1`)** được ngay.
   - `vinamuse.store` đang dùng Namecheap BasicDNS (`dns1.registrar-servers.com`, `dns2.registrar-servers.com`).
2. **Name.com Core API (`https://api.name.com/core/v1`):**
   - Xác thực HTTP Basic Auth (`NAMECOM_USERNAME:NAMECOM_TOKEN`), **không khóa IP**, hỗ trợ tạo/liệt kê/xóa từng record (`GET/POST/DELETE /core/v1/domains/{domainName}/records`) → an toàn, không ghi đè zone, chạy trực tiếp từ Vercel Serverless Functions.
   - *Lưu ý:* tài khoản Name.com có bật 2FA cần bật toggle *Name.com API Access = On*.
   - Name.com sử dụng `host` là subdomain label (`""` cho apex, `"blog"` cho `blog.harrylee.dev`), `type`, `answer`, `ttl`.
3. **Cloudflare API (`https://api.cloudflare.com/client/v4`):**
   - Dùng `CLOUDFLARE_API_TOKEN` (Bearer), **không khóa IP**, sửa/tạo/xóa từng record DNS-only (`proxied: false`), chạy mượt trên Vercel Serverless.
   - Nếu sau này chủ dự án chuyển NS của `vinamuse.store` hoặc `harrylee.dev` sang Cloudflare miễn phí, chỉ cần đổi `provider` của domain đó trong config là tự động 100%.
4. **Namecheap API (`setHosts`):**
   - Yêu cầu tài khoản đủ điều kiện (`≥ 20 domains` hoặc số dư/chi tiêu `$50`), **khóa chặt theo IPv4 whitelist (`ClientIp`)** trong khi Vercel Functions dùng IP động, và lệnh `setHosts` ghi đè toàn bộ zone.
   - Do đó, khi domain ở chế độ Namecheap BasicDNS (`provider: "namecheap-manual"`), hệ thống **không** gọi `setHosts` mù từ Vercel mà hiển thị bảng record Copy 1-click chuẩn Namecheap *Advanced DNS* (`Host = label`, không kèm root domain) + nút **Verify Live DNS** qua DNS-over-HTTPS (`https://cloudflare-dns.com/dns-query` / `dns.google`).
5. **Next.js Fullstack trên Vercel (`site/`):**
   - Bỏ `output: "export"` khỏi `site/next.config.ts` để Route Handlers (`/api/...`) hoạt động trên Vercel Functions.
   - Vì app Next.js nằm trong thư mục `site/`, cấu hình deploy Vercel chuẩn cho Fullstack Next.js dùng `Root Directory = site` trên Vercel Project Settings (hoặc `vercel.json` đồng bộ không làm gãy auto-detection `"No Next.js version detected"`), và build payload tĩnh fallback nằm sẵn trong `site/src/data/registry.json` để Serverless Functions không lệ thuộc đường dẫn đọc file ngoài bundle.

---

## 3. Goals / Non-goals / Anti-goals

**Goals**
- Cấu hình nhiều root domain trong `config.json` (`rootDomains[]`: hỗ trợ `harrylee.dev` + `vinamuse.store` + mở rộng thêm domain mới chỉ bằng 1 mục config), vẫn giữ tương thích cho test/scripts hiện tại.
- Chuyển `/claim/` (và card quick-add) thành **Multi-Domain Claim & Instant DNS Studio**:
  - Bộ chọn domain đang available (`harrylee.dev` · `Name.com Auto`, `vinamuse.store` · `Namecheap Copy` / `Cloudflare Auto`).
  - Ô nhập label với đuôi **`.<selectedDomain>`** gắn sát bên phải tự động thay đổi theo domain đang chọn.
  - Preset (`Vercel`, `GitHub Pages`, `Netlify`, `VPS`) + tùy chọn `_vercel` TXT / `extra` TXT/CNAME.
  - Bảng **Generated DNS Records (`Type | Host | Value | TTL`)** tự cập nhật real-time theo từng nhà cung cấp DNS (hiển thị đúng `Host` ngắn gọn kiểu `blog` hoặc `_vercel` kèm FQDN đầy đủ), nút **Copy** từng dòng và nút **Copy All**.
  - Khi Admin đăng nhập: nút **Create DNS Record Now** ghi thẳng vào Name.com / Cloudflare API cho domain hỗ trợ auto-DNS, báo kết quả tức thì và đồng bộ lại danh sách.
  - Nút **Check Live DNS (DoH)** kiểm tra xem record trên mạng (`A`/`CNAME`/`TXT`) đã trỏ khớp giá trị vừa tạo hay chưa (rất hữu ích khi bạn vừa dán tay sang Namecheap).
- Trang `/directory/` hỗ trợ:
  - Lọc theo **Domain** (`All domains`, `harrylee.dev`, `vinamuse.store`), theo trạng thái và tìm kiếm.
  - Khách vãng lai xem được dữ liệu từ Git `domains/` cộng với tập bản ghi công khai an toàn (`A`/`AAAA`/`CNAME` của các subdomain thường, cache TTL ~60s phía server và loại bỏ apex `@`, `MX`, `TXT`, `_vercel`, `unmanaged`). Khi Admin đăng nhập sẽ xem được đầy đủ bản ghi live từ Name.com / Cloudflare API (kèm `TXT` và trạng thái bảo vệ) và có nút xóa trực tiếp đối với subdomain không thuộc diện khóa cứng.
- Bảo mật Admin gọn nhẹ không cần database: `ADMIN_PASSWORD` + `SESSION_SECRET` (fallback HMAC key từ secret) qua `HttpOnly`, `SameSite=Lax`, `Secure` cookie; không bao giờ lộ token/password ra client hoặc file commit.
- Giữ giao diện **anime-chibi tươi sáng**, nới nhẹ container desktop (`max-w-6xl`) để cân đối hơn trên màn hình rộng (≥ 1440px) trong khi vẫn bảo toàn 0 tràn ngang trên mobile `390px`.

**Non-goals (v2)**
- Không mua domain mới qua API registrar.
- Không lưu thông tin thẻ thanh toán hay thêm/sửa NS tại registrar.
- Không dùng external database (Postgres/Redis) — nguồn sự thật cho Auto-DNS là chính API nhà cung cấp DNS (Name.com / Cloudflare) + `config.json` + `domains/`.
- Không duy trì song song bản static mirror trên GitHub Pages: app chạy thống nhất dưới dạng Next.js Fullstack trên Vercel.
- Không cho phép user ẩn danh chưa đăng nhập tự ý ghi/xóa DNS thật (khách chỉ xem thư mục công khai, tạo JSON PR, hoặc dùng bảng Generate & Copy local).

**Anti-goals**
- Gửi hoặc lưu API token (Name.com, Cloudflare, Admin password) ở `NEXT_PUBLIC_*`, Git, hoặc trả về trong API response cho client.
- Cho phép xóa hoặc ghi đè bản ghi bảo vệ cứng (`@`, `MX`, `NS`, `SOA`, và các mục `unmanaged` như `www`, `mail`, `_dmarc`, `_domainkey`).
- Cho phép thao tác lên `reservedLabels` (`domains`, `status`, `admin`, ...) mà không qua xác nhận Admin tường minh (`allowReserved: true`).
- Dùng `namecheap.domains.dns.setHosts` gây mất toàn bộ record hiện hữu của `vinamuse.store`.
- Làm gãy responsive mobile (`390x844`) hoặc phá vỡ bộ test `npm test` / `npm run validate` của repository.

---

## 4. Kiến trúc đề xuất (Hướng A) & Các điểm đã chốt sau rà soát

### 4.0 Các quyết định kiến trúc đã chốt (chờ chủ dự án kiểm tra/duyệt)
1. **Ghi DNS trực tiếp qua API, không dual-write ngược về GitHub:** Khi Admin bấm **Create DNS Record Now** hoặc **Delete** trên web, hệ thống chỉ gọi thẳng Name.com / Cloudflare API (không yêu cầu `GITHUB_TOKEN` trên Vercel và tránh kích hoạt Vercel rebuild mỗi lần thêm/xóa 1 subdomain). Để không xung đột, `config.json` đánh dấu rõ domain nào dùng GitOps (`dnsProvider: "cloudflare-gitops"` vs `"namecom"` / `"cloudflare-api"` / `"namecheap-manual"`), và `.github/workflows/deploy-dns.yml` chỉ đẩy DNSControl cho đúng zone `"cloudflare-gitops"` để **không bao giờ xóa nhầm** bản ghi tạo qua Web UI; `scripts/status-check.ts` giữ phạm vi kiểm tra các entry có trong Git `domains/` (còn kiểm tra live record tạo qua Web UI thực hiện qua `/api/dns/lookup` DoH).
2. **Ngừng static export GitHub Pages, chạy thống nhất Vercel Fullstack:** Bỏ `output: "export"`, `trailingSlash: true` giữ tùy chọn sạch nếu cần nhưng chuyển sang SSR/Route Handlers; ngừng `.github/workflows/deploy-site.yml` (thay bằng Vercel Git Auto-Deploy đã kết nối), cập nhật `domains/domains.json` trỏ về Vercel (`cname.vercel-dns.com.`), và hướng dẫn đặt `Root Directory = site` trên Vercel Settings.
3. **Phân cấp quyền `GET /api/dns/records`:** Tách rõ chế độ public safe subset (chỉ trả `A`/`AAAA`/`CNAME` của subdomain ngoài `unmanaged`/`@`/`MX`/`TXT`, cache 60s) và chế độ Admin (`200` đầy đủ mọi record kèm `id` để xóa, không cache) để khách xem được trang mà vẫn bảo vệ toàn bộ TXT xác minh / MX / rate-limit.
4. **Phân 2 tầng bảo vệ bản ghi (Hard-block vs Confirm):** Khóa cứng hoàn toàn không cho Web UI tạo/xóa apex (`@`), `MX`/`NS`/`SOA` và danh sách `unmanaged` (`www`, `mail`, `_dmarc`, `_domainkey`, ...). Riêng `reservedLabels` (`domains`, `status`, `admin`, ...) thuộc nhóm *Admin-only*: vẫn cho phép Admin đang đăng nhập tạo/xóa khi gửi kèm cờ xác nhận `allowReserved: true` và hộp thoại cảnh báo trên UI.

### 4.1 Cấu trúc dữ liệu Multi-Domain (`config.json` & compiler)
Cập nhật `config.json` hỗ trợ mảng `rootDomains` (vẫn giữ `rootDomain` trỏ tới domain mặc định đầu tiên hoặc suy ra từ `rootDomains[0].domain` để tương thích ngược):

```json
{
  "rootDomain": "harrylee.dev",
  "rootDomains": [
    {
      "domain": "harrylee.dev",
      "registrar": "Name.com",
      "dnsProvider": "namecom",
      "note": "Primary personal dev domain (Name.com API Auto)"
    },
    {
      "domain": "vinamuse.store",
      "registrar": "Namecheap",
      "dnsProvider": "namecheap-manual",
      "note": "Store & app domain (Copy to Namecheap BasicDNS, or switch NS to Cloudflare for Auto)"
    }
  ]
}
```

- **Cấu trúc `domains/` tương thích ngược:** Cho phép cả layout phẳng `domains/<label>.json` (mặc định thuộc `config.rootDomain` chính là `harrylee.dev`) **VÀ** thư mục theo domain `domains/<rootDomain>/<label>.json` (ví dụ `domains/vinamuse.store/shop.json`). Nhờ vậy không trùng tên `blog` giữa hai domain, đồng thời `validate` & `build-dns-manifest` giữ 100% tương thích với 2 file cũ (`domains/blog.json`, `domains/domains.json`).

### 4.2 Lớp DNS Provider Drivers (`site/src/lib/dns-providers/`)
Tạo interface thống nhất `DnsProviderAdapter`:
- `listRecords(domain: string): Promise<LiveDnsRecord[]>`
- `createRecord(domain: string, input: CreateDnsRecordInput): Promise<LiveDnsRecord[]>` (hỗ trợ tạo record chính + tùy chọn `_vercel` / `extra` TXT/CNAME)
- `deleteRecord(domain: string, recordId: string): Promise<void>`

Ba adapter cụ thể:
1. **`namecom.ts`** — Gọi `https://api.name.com/core/v1/domains/${domain}/records` với Basic Auth `NAMECOM_USERNAME` + `NAMECOM_TOKEN` (tùy chọn `NAMECOM_API_BASE` để trỏ sandbox `api.dev.name.com` khi test). Chặn tạo/xóa record trùng apex `@`, `MX`, `NS`, hoặc label bị bảo vệ trừ khi label hợp lệ subdomain.
2. **`cloudflare.ts`** — Gọi `https://api.cloudflare.com/client/v4/zones` (tự lookup `zoneId` từ tên domain hoặc map env `CLOUDFLARE_ZONE_ID_<NORMALIZED>` / `CLOUDFLARE_ZONE_ID`) với `CLOUDFLARE_API_TOKEN`, luôn đặt `proxied: false`.
3. **`manual.ts`** — Cho `namecheap-manual`: không thực thi ghi API mà trả về trạng thái `manual-copy-only` + hướng dẫn copy theo từng trường chuẩn Namecheap (`Host`, `Type`, `Value`, `TTL`).

### 4.3 API Routes trên Next.js (`site/src/app/api/...`)
- `GET /api/health` — Kiểm tra trạng thái cấu hình provider nào đã nạp env (`namecom: configured/missing`, `cloudflare: configured/missing`), tuyệt đối **không** trả về giá trị secret.
- `POST /api/auth/login` / `POST /api/auth/logout` / `GET /api/auth/session` — Kiểm tra `ADMIN_PASSWORD` (constant-time comparison), ký token `HMAC-SHA256` (`exp` + `nonce`) vào cookie `fdomain_admin`. Nếu chưa cấu hình `ADMIN_PASSWORD` trên server, nút Admin login báo hướng dẫn thêm env trên Vercel (tránh mở khóa bừa bãi).
- `GET /api/domains` — Trả danh sách `rootDomains[]` + trạng thái capability từng domain (`auto` / `manual` / `unconfigured`).
- `GET /api/dns/records?domain=harrylee.dev` — Phân 2 chế độ: nếu chưa đăng nhập Admin chỉ trả **safe public subset** (`A`/`AAAA`/`CNAME` ngoài apex, `unmanaged`, `TXT`, được cache ~60s trên server); nếu đã đăng nhập Admin trả toàn bộ record live kèm cờ `protected: boolean` (`unmanaged` / `MX` / `NS` / `@` khóa cứng; `reservedLabels` đánh dấu cảnh báo) để quản trị tạo/xóa an toàn.
- `POST /api/dns/records` — **Admin-only**, validate payload bằng Zod (`rootDomain` thuộc `config.rootDomains`, `label` hợp lệ, không thuộc `unmanaged`, `reservedLabels` yêu cầu `allowReserved: true`, type thuộc `CNAME | A | AAAA | TXT`), thực thi qua provider driver tương ứng.
- `DELETE /api/dns/records` — **Admin-only**, từ chối xóa record có `host`/`type` nằm trong `unmanaged`, `@`, hoặc `MX`/`NS`/`SOA`; với `reservedLabels` yêu cầu `allowReserved: true`.
- `GET /api/dns/lookup?fqdn=...&type=CNAME|A|TXT` — Công khai (rate-limited nhẹ / chỉ cho phép query tên thuộc `rootDomains[]` đã cấu hình để tránh open DNS proxy abuse!), gọi Cloudflare/Google DoH trả kết quả thực tế ngoài Internet.

### 4.4 Giao diện người dùng (`site/src/app/...` & `site/src/components/...`)
- **Sidebar & Header ([app-shell.tsx](file:///e:/INDIE_CODE/FDOMAIN/site/src/components/app-shell.tsx)):**
  - Hiển thị huy hiệu số domain quản lý (`2 domains`) thay vì khóa cứng 1 domain `*.harrylee.dev`.
  - Hiển thị trạng thái **Admin Lock / Unlocked** nhỏ gọn ở sidebar footer: bấm để mở dialog đăng nhập/đăng xuất Admin bằng `ADMIN_PASSWORD`.
  - Tăng `max-w-5xl` → `max-w-6xl` cho header/main để rộng rãi, cân xứng trên màn hình 1440px–1920px.
- **`/claim/` — Multi-Domain Instant Claim & Copy Studio:**
  - **Bước 1: Chọn Root Domain sẵn có:** Các thẻ/pills chọn `harrylee.dev` (Name.com Auto) hoặc `vinamuse.store` (Namecheap Copy), hiển thị trạng thái sẵn sàng của API ngay trên thẻ.
  - **Bước 2: Nhập Subdomain:** `[ label ] [ .harrylee.dev ]` — phần đuôi bên phải tự động đổi thành `.harrylee.dev` hoặc `.vinamuse.store` ngay khi đổi lựa chọn ở Bước 1!
  - **Bước 3: Chọn Hosting (`Vercel`, `GitHub Pages`, `Netlify`, `VPS`):** Tự điền target chuẩn (`cname.vercel-dns.com.`, `*.github.io.`, ...) + ô nhập `_vercel` verification hoặc `extra` TXT.
  - **Bước 4: Kết quả 2 chế độ dùng ngay:**
    - **Bảng Preview DNS chuẩn (luôn hiện real-time):** liệt kê rõ từng row `Host` (theo quy ước registrar), `FQDN đầy đủ`, `Type`, `Value` + nút Copy từng giá trị.
    - **Hành động 1-Click:**
      - Nếu domain có Auto API (`harrylee.dev` hoặc domain gắn Cloudflare) & đã đăng nhập Admin → nút **Create DNS Record Now** ghi thật ngay lập tức + nút **Verify Live DNS (DoH)** kiểm tra đã thông mạng chưa!
      - Nếu domain đang là Manual (`vinamuse.store` Namecheap BasicDNS) → nút **Copy Record cho Namecheap Advanced DNS** + nút **Verify Live DNS (DoH)** để xác nhận sau khi dán!
    - **Tab phụ thu gọn (`GitOps PR JSON`):** giữ lại đoạn JSON + nút mở GitHub PR cho cộng tác viên ngoài hoặc lưu backup vào Git.
- **`/directory/` — Multi-Domain Directory + Live Records:**
  - Thêm pill lọc theo từng root domain (`All Domains`, `harrylee.dev`, `vinamuse.store`).
  - Khi Admin đăng nhập: hiển thị thêm tab/chế độ xem **Live Provider DNS** kéo trực tiếp từ Name.com / Cloudflare API, có nút **Check DoH** và nút **Delete** (chỉ bật với record không thuộc diện bảo vệ).
- **`/health/` — Quota, Provider Status & Probe:**
  - Hiển thị thêm trạng thái cấu hình các env (`ADMIN_PASSWORD`, `NAMECOM_*`, `CLOUDFLARE_API_TOKEN`) dạng boolean `Ready / Needs Env Setup` (không hiện key), giúp bạn biết ngay Vercel đã nhận đủ env hay chưa.

---

## 5. Việc cấu hình trên Vercel (không đụng secret trong code)

1. Vào **Vercel Project `fdomain` → Settings → General → Root Directory**: đặt là **`site`** (Framework Preset: **Next.js**), giữ bật *Include files outside the root directory* để prebuild đọc được `config.json` / `domains/`, hoặc cập nhật script sync dữ liệu sạch vào `site/src/data/registry.json` trước build.
2. Vào **Settings → Environment Variables**, thêm:
   - `ADMIN_PASSWORD`: mật khẩu quản trị do bạn tự đặt.
   - `SESSION_SECRET`: chuỗi ngẫu nhiên dài ≥ 32 ký tự để ký session cookie.
   - `NAMECOM_USERNAME` và `NAMECOM_TOKEN`: lấy từ Name.com → Account Settings → Security → API Tokens (bật *Name.com API Access* nếu có 2FA).
   - *(Tùy chọn khi dùng Cloudflare cho `vinamuse.store` hoặc domain khác)*: `CLOUDFLARE_API_TOKEN` (quyền `Zone:Read`, `Zone:DNS:Edit`).

---

## 6. Kiểm thử & Bàn giao

- Unit tests (Vitest):
  - Multi-domain `config.json` & `domains/<rootDomain>/<label>.json` validation & compiler.
  - Auth HMAC token sign/verify & rejection.
  - Name.com & Cloudflare adapter request mapping + `unmanaged`/apex deletion guard (mock `fetch`, không gọi API thật trong unit test).
  - DoH lookup domain whitelist guard (`fqdn` phải thuộc `rootDomains[]`).
- Typecheck & Build: `npm test`, `npm run typecheck`, `npm --prefix site run typecheck`, `npm run site:build` (Next.js server + API route compilation!).
- Browser verification trên `http://localhost:3000`: test chuyển đổi `harrylee.dev` ↔ `vinamuse.store` thấy đuôi `.harrylee.dev` / `.vinamuse.store` đổi sát phải, bảng record + Copy, Admin login UI, lọc multi-domain trên `/directory/`, cả `1280×800`, `1440×900`, và `390×844` mobile (0 tràn ngang).

---

## 7. Để builder quyết

- Kiểu cấu trúc component cụ thể trong `site/src/lib/` và `site/src/components/`.
- Hình thức dialog/panel đăng nhập Admin (modal `<dialog>` chuẩn anime-chibi nhất quán với app shell).
- Cách gom hoặc deduplicate DNS records trên UI khi cùng lúc tồn tại bản ghi từ Git `domains/` và live provider API.
