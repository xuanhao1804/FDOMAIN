# Hướng dẫn thiết lập cho Admin (Setup Guide)

Tài liệu này hướng dẫn từng bước cấu hình domain, Cloudflare, và GitHub sau khi bạn clone/fork repo **FDOMAIN**.

---

## 1. Mua domain & trỏ Nameserver về Cloudflare

Hệ thống làm việc trực tiếp với **Cloudflare DNS**, nên bạn mua domain ở **Namecheap**, **name.com**, Porkbun hay bất kỳ nhà đăng ký nào cũng chạy như nhau:

1. Thêm domain của bạn (ví dụ `harrylee.dev`) vào **Cloudflare** (gói **Free**).
2. Cloudflare sẽ cấp cho bạn **2 nameserver** (dạng `alice.ns.cloudflare.com`, `bob.ns.cloudflare.com`).
3. Đăng nhập vào nơi mua domain:
   - **Namecheap**: *Domain List → Manage → Nameservers → Custom DNS* → dán 2 nameserver của Cloudflare.
   - **name.com**: *My Domains → chọn domain → Nameservers → Manage Nameservers* → xóa NS cũ và điền 2 nameserver của Cloudflare.
4. Chờ vài phút đến khi Cloudflare báo trạng thái **Active**.

---

## 2. Tạo Cloudflare API Token giới hạn quyền

1. Vào Cloudflare Dashboard → *My Profile → API Tokens → Create Token*.
2. Chọn template **Edit zone DNS** (hoặc tạo Custom Token):
   - **Permissions**: `Zone` → `DNS` → `Edit`
   - **Zone Resources**: `Include` → `Specific zone` → chọn đúng domain của bạn (ví dụ `harrylee.dev`).
3. Copy token vừa tạo.

---

## 3. Cấu hình `config.json`

Mở [`config.json`](../config.json) và điền đúng thông tin của bạn:

- `rootDomain`: domain thật của bạn (ví dụ `"harrylee.dev"`).
- `repository`: repo GitHub của bạn (`"<user>/<repo>"`).
- `admins`: danh sách username GitHub có quyền admin (ví dụ `["xuanhao1804"]`).
- `trusted`: danh sách bạn bè tin cậy được tự động merge PR khi họ chỉ sửa file của chính mình trong `domains/`.
- `unmanaged`: các bản ghi bạn quản lý trực tiếp trên Cloudflare dashboard (`@`, `www`, mail, `_dmarc`…) để DNSControl **không bao giờ chạm vào**.
  > **Quan trọng:** Nếu bạn dùng Vercel cho domain gốc (`harrylee.dev`), hãy giữ dòng `target: "vc-domain-verify=harrylee.dev,*"` khớp đúng `rootDomain` của bạn.

Cập nhật lại [`domains/domains.json`](../domains/domains.json) trỏ về GitHub Pages (`<user>.github.io`) hoặc Vercel project của bạn, và cập nhật [`.github/CODEOWNERS`](../.github/CODEOWNERS) thành `@<github-username>` của bạn.

---

## 4. Cấu hình GitHub Repository

1. **Tạo Environment `production`:**
   - *Settings → Environments → New environment* → đặt tên `production`.
   - Thêm Environment secret: `CLOUDFLARE_API_TOKEN` = token ở Bước 2.
2. **Bật quyền cho Workflow (để auto-merge hoạt động với `trusted[]`):**
   - *Settings → Actions → General → Workflow permissions* → chọn **Read and write permissions**.
3. **Bật Branch Protection / Ruleset cho `main`:**
   - Yêu cầu status check `validate` phải pass trước khi merge.
   - Cho phép **admin bypass** để bạn dùng CLI `npm run sub -- add ... --push` push thẳng lên `main`.
4. **Kiểm tra thử trước lần push DNS đầu tiên:**
   - Nếu domain đã có bản ghi DNS sẵn trên Cloudflare (từ trước khi dùng FDOMAIN), hãy chạy thử `dnscontrol preview` ở máy cá nhân trước hoặc kiểm tra xem bản ghi nào cần giữ thì thêm vào `config.json -> unmanaged` (hoặc tạo file tương ứng trong `domains/`).
   - `scripts/drift-guard.ts` cũng sẽ tự động chặn nếu `dnscontrol preview` định xóa/sửa bất kỳ bản ghi nào ngoài `domains/`.

---

## 5. Deploy trang tra cứu (`site/`)

Bạn có thể chọn **1 trong 2** cách (đều miễn phí):

- **Cách A — GitHub Pages (mặc định trong `.github/workflows/deploy-site.yml`):**
  - Vào *Settings → Pages → Build and deployment → Source* → chọn **GitHub Actions**.
  - Thêm custom domain `domains.<rootDomain>` trong *Settings → Pages* sau khi DNS của `domains.json` đã chạy.
- **Cách B — Vercel:**
  - Import repo vào Vercel (repo đã có sẵn [`vercel.json`](../vercel.json)).
  - Gắn custom domain `domains.<rootDomain>` trong Project Settings của Vercel và sửa `domains/domains.json` trỏ về `cname.vercel-dns.com`.

---

## 6. Dùng nhanh cho bản thân (Admin CLI)

```bash
# Xem danh sách subdomain hiện có
npm run sub -- list

# Tạo subdomain mới trỏ về Vercel và push thẳng lên main
npm run sub -- add notes --cname cname.vercel-dns.com --desc "Personal notes" --push

# Tạo subdomain trỏ về IP VPS
npm run sub -- add api --a 203.0.113.10 --desc "API server" --push

# Xoá subdomain
npm run sub -- remove notes --push
```
