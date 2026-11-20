# FDOMAIN — Subdomain registry cá nhân (DNS-as-code)

Ngày: 2026-11-20 · Trạng thái: **Approved**

## 1. Mục đích & lý do

Chủ dự án mua **một** domain (mặc định ví dụ `harrylee.dev`, cấu hình được) và muốn:

- Cấp nhanh subdomain cho từng dự án cá nhân (`blog.harrylee.dev`, `api.harrylee.dev`…), dự án tự host trên Vercel/Netlify/GitHub Pages/VPS.
- Cho **vài người quen tin cậy** xin subdomain trỏ về hosting của họ.
- Ai cũng xem lại được bản ghi của mình khi quên.

Quy mô: một người quản trị, vài người dùng. Ưu tiên chi phí 0, ít bảo trì, không có server.

## 2. Goals / Non-goals / Anti-goals

**Goals**
- Mỗi subdomain là một file JSON trong repo GitHub; merge vào `main` → DNS trên Cloudflare tự cập nhật.
- Người quen xin/sửa subdomain bằng Pull Request; admin duyệt.
- Kiểm tra tự động trên PR: schema, tên cấm, quyền sở hữu.
- Trang tra cứu tĩnh công khai `domains.<root>` liệt kê mọi subdomain, owner, bản ghi, trạng thái sống/chết.
- Quét định kỳ phát hiện subdomain "chết" (nguy cơ takeover) và báo cho owner + admin.

**Non-goals (v1)**
- Host code cho người khác.
- Đăng ký công khai, web form, đăng nhập, database.
- Email (MX), wildcard record, đăng ký Public Suffix List.

**Anti-goals** (dù chạy được vẫn coi là thất bại)
- Một PR lỗi hoặc bug khiến bản ghi ngoài phạm vi (apex, www, email của admin…) bị xoá.
- Người này sửa/xoá được subdomain của người khác mà admin không chủ động duyệt điều đó.
- Lộ Cloudflare API token cho code từ PR (đặc biệt PR từ fork).
- Tốn tiền hoặc cần server.

## 3. Ràng buộc đã xác minh

- **Cloudflare Free**: zone tạo sau 2024‑09‑01 giới hạn **200 DNS records** → dư cho quy mô này; validator cảnh báo khi vượt ~150.
- **Vercel cross-account**: khi `harrylee.dev` đã ở tài khoản Vercel của admin, người khác thêm `alice.harrylee.dev` vào Vercel của họ sẽ bị yêu cầu bản ghi **TXT tại `_vercel.<root>`** với giá trị `vc-domain-verify=alice.harrylee.dev,<code>`. Nhiều người dùng chung tên `_vercel` (nhiều TXT cùng tên là hợp lệ).
- **Vercel + Cloudflare proxy**: bản ghi trỏ về Vercel phải để **DNS only** (không proxy) → mặc định `proxied: false`.
- **`.dev` nằm trong HSTS preload**: mọi subdomain bắt buộc HTTPS (Vercel/Netlify/GH Pages tự cấp cert).
- **Let's Encrypt** giới hạn ~50 cert mới/tuần cho mỗi registered domain — không đáng lo ở quy mô vài người.
- DNSControl mặc định **xoá** bản ghi trên provider không có trong config → phải xử lý (xem §5.4).

## 4. Các hướng đã cân nhắc

| Hướng | Mô tả | Đánh đổi |
|---|---|---|
| 1. Dashboard thủ công | Thêm CNAME tay trên Cloudflare | Không công sức, nhưng không lịch sử, không quét subdomain chết |
| **2. DNS-as-code trên GitHub (chọn)** | JSON per subdomain + GitHub Actions + DNSControl → Cloudflare; trang tra cứu tĩnh | Miễn phí, có lịch sử/duyệt; người dùng cần biết GitHub |
| 3. Web dashboard có login | Next.js + auth + DB + Cloudflare API | Dễ dùng nhất nhưng tốn công gấp nhiều lần cho vài người dùng |

Chủ dự án chọn **hướng 2**. Đăng nhập được loại bỏ vì bản ghi DNS vốn công khai; thứ cần bảo vệ là quyền sửa, đã nằm ở khâu duyệt PR. Có thể thêm hướng 3 lên trên sau này mà không đổi lõi.

## 5. Thiết kế

### 5.1 Bố cục repo

```
config.json              # root domain, admins, reserved names, giới hạn
domains/
  blog.json              # mỗi file = một subdomain (tên file = label)
  api.blog.json          # subdomain lồng nhau (xem quy tắc)
dnsconfig.js             # DNSControl: đọc config + domains/ → records
scripts/                 # validate, ownership check, build trang, status check
site/                    # template trang tra cứu
.github/workflows/       # validate.yml, deploy-dns.yml, status.yml
docs/                    # hướng dẫn xin subdomain (kèm bước Vercel)
```

### 5.2 Schema file subdomain

```json
{
  "owner": { "github": "alice-gh", "contact": "optional email/discord" },
  "description": "Portfolio của Alice",
  "records": {
    "CNAME": "cname.vercel-dns.com"
  },
  "vercelVerify": ["vc-domain-verify=alice.harrylee.dev,abc123"],
  "extra": {
    "_github-pages-challenge-alice-gh": { "TXT": ["abc..."] },
    "_acme-challenge": { "TXT": ["..."] }
  }
}
```

Quy tắc:
- Tên file: `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.json$` (không có `_`), so khớp không phân biệt hoa thường cho `owner.github`.
- Subdomain lồng (`api.blog`) chỉ hợp lệ khi file cha (`blog.json`) tồn tại và **cùng owner**. Xoá file cha khi còn file con → validator báo lỗi.
- `records` cho phép: `CNAME` (string, **loại trừ** mọi loại khác), hoặc tổ hợp `A` (string[] IPv4), `AAAA` (string[] IPv6), `TXT` (string[]). Không MX, NS, SRV ở v1.
- `vercelVerify[]` được phát thành TXT tại `_vercel.<root>`; mỗi giá trị phải bắt đầu bằng `vc-domain-verify=<label>.<root>,`.
- `extra`: bản ghi xác minh/challenge **dưới label của chính owner**. Key phải khớp `^_[a-z0-9-]+$` (sinh ra `<key>.<label>.<root>`), chỉ cho phép `TXT` (string[]) hoặc `CNAME` (string, dùng cho DNS-01 delegation). Owner của file sở hữu luôn các bản ghi này. Đáp ứng GitHub Pages challenge, ACME DNS-01 cho người tự host VPS, xác minh Netlify.
- **Không có `proxied` trong schema người dùng**: mọi bản ghi người dùng luôn DNS-only (tránh trách nhiệm ToS/abuse qua tài khoản Cloudflare của admin, tránh vỡ Vercel, giữ cho quét subdomain chết thấy được target thật).
- Tên cấm (trong `config.json`): `www`, `mail`, `admin`, `domains`, `status`, `ns1`, `ns2`, `autoconfig`, `autodiscover`, `smtp`, `imap`, `pop`, `ftp`… Admin giữ tên cho riêng mình bằng cách tạo file với owner admin. Chỉ admin được tạo file dùng tên cấm.

### 5.3 Luồng thay đổi & kiểm tra trên PR

**Ba luồng, theo mức tin cậy** (mục tiêu: không bắt ai chờ admin trong trường hợp thường gặp):

| Ai | Cách | Thời gian tới khi DNS chạy |
|---|---|---|
| Admin | CLI `npm run sub -- add blog --cname cname.vercel-dns.com` (sửa JSON → validate local → commit → push thẳng `main`), hoặc sửa file trên GitHub web/điện thoại. Không cần PR. | ~1–2 phút |
| Người quen trong `config.json → trusted[]` | Mở PR. Nếu mọi check pass và PR **chỉ** thêm/sửa/xoá file của chính họ (tên không thuộc danh sách cấm) → **tự động merge**. | ~1–2 phút |
| Người mới / ngoài `trusted` / PR vi phạm điều kiện trên | PR chờ admin duyệt tay. | khi admin duyệt |

Bảo vệ để auto-merge an toàn:
- Workflow `validate.yml` chạy trên `pull_request_target`, **checkout code validator từ base branch** (`main`); file `domains/*.json` của PR chỉ được đọc như **dữ liệu** (lấy qua `git show`/API), không bao giờ chạy code từ PR. Không đụng tới Cloudflare secret. Nhờ chạy ở context base, workflow có quyền comment/merge lên PR kể cả PR từ fork.
- Branch protection trên `main`: bắt buộc check `validate`; admin được bypass để push thẳng. `CODEOWNERS` gán admin cho mọi file ngoài `domains/`.
- Lưu ý kỹ thuật: merge bằng `GITHUB_TOKEN` **không** kích hoạt workflow `push` → sau khi auto-merge, workflow phải gọi `workflow_dispatch` của `deploy-dns.yml` (và build trang) một cách tường minh.
- Admin có thể rút một người khỏi `trusted` bất cứ lúc nào; mọi thay đổi vẫn có lịch sử git để revert.

Các bước kiểm tra:
1. **Phạm vi file**: người không phải admin chỉ được thay đổi file trong `domains/`. Đụng `config.json`, `dnsconfig.js`, `scripts/`, `site/`, `.github/`, `package*.json`… → fail.
2. Schema + quy tắc §5.2 (zod).
3. Ownership: với mỗi file thêm/sửa/xoá, tác giả PR phải là `owner.github` của bản **cũ** (sửa/xoá) và bản **mới** (thêm/sửa), hoặc là admin. Đổi owner chỉ admin.
4. Tổng số record sau khi sinh ≤ giới hạn trong `config.json`.
5. `dnscontrol check` (offline) để chắc config hợp lệ.
6. Comment tóm tắt thay đổi DNS dự kiến (sinh từ diff JSON, không gọi Cloudflare); cập nhật comment cũ thay vì spam.

### 5.4 Đồng bộ DNS (`deploy-dns.yml`, trigger push `main` + manual)

**Phạm vi quản lý**: repo là nguồn sự thật **chỉ cho các subdomain trong `domains/`** (và TXT `_vercel`). Apex và các bản ghi riêng của admin (`@`, `www`, MX, `_dmarc`, Email Routing, Cloudflare Pages custom domain…) **không** nằm trong repo; admin tiếp tục sửa chúng trên dashboard Cloudflare thoải mái.

- `dnsconfig.js` khai báo `IGNORE` cho apex và danh sách `unmanaged` trong `config.json` (mặc định gồm `@`, `www`, `_dmarc`, `_domainkey` và các tên email phổ biến) để DNSControl không bao giờ đụng tới.
- **Drift guard** (script chạy giữa `preview` và `push`): tập các bản ghi DNSControl định **xoá hoặc sửa** phải nằm trọn trong các label đã có mặt trong `domains/` ở commit trước hoặc commit hiện tại. Nếu preview muốn xoá/sửa một bản ghi ở label lạ (ví dụ admin vừa tạo tay trên dashboard mà chưa thêm vào `unmanaged`) → **dừng workflow, không xoá**, mở Issue cho admin. Thêm một ngưỡng tuyệt đối (vd. > 10 bản ghi bị xoá trong một lần) cũng dừng.
- Khi guard dừng: admin xử lý bằng cách thêm tên vào `unmanaged` hoặc chạy lại workflow với input `force=true` (chỉ chạy manual được).
- Token Cloudflare quyền **Zone:DNS:Edit chỉ một zone**, lưu trong GitHub Environment `production` (chỉ branch `main` dùng được).
- `concurrency` group để không có hai lần push chạy song song.
- Lần đầu: chạy preview thủ công, xác nhận 0 deletion trước khi bật tự động.

### 5.5 Trang tra cứu (`domains.<root>`)

- Web tĩnh build bằng **Next.js (App Router, `output: 'export'`) + Tailwind CSS** (có thể dùng thêm **shadcn/ui** cho bảng, badge, nút copy) từ dữ liệu `domains/*.json` + `status.json` đọc lúc build; tìm kiếm/lọc phía client; không cần backend hay server riêng (không dùng NestJS ở v1 vì GitHub Actions + DNSControl đã làm phần đồng bộ với chi phí 0).
- Mỗi dòng: subdomain (link), owner (avatar + link GitHub), bản ghi (nút copy), trạng thái, nút "Sửa" → mở file trên GitHub. Có trang/khối "Cách xin subdomain" hướng dẫn từng bước.
- Có thể deploy lên **Vercel** (tự động build khi push `main`, hoặc rebuild qua Deploy Hook sau khi `status.yml` chạy) hoặc **GitHub Pages**; bản ghi `domains` trỏ CNAME về nơi host tương ứng, owner admin.
- Nếu sau này muốn thêm đăng nhập GitHub / web dashboard cho người dùng tự sửa trực tiếp (hướng 3), chỉ cần bỏ `output: 'export'` và thêm API route ngay trên chính app Next.js này.

### 5.6 Quét subdomain chết (`status.yml`, cron hằng ngày + manual)

Với mỗi subdomain: resolve DNS, rồi HTTPS GET (timeout ~10s, theo redirect).

| Trạng thái | Điều kiện |
|---|---|
| 🟢 live | Trả về 2xx/3xx |
| 🟡 warn | Timeout, lỗi TLS, 5xx, hoặc 4xx thường |
| 🔴 dead | CNAME target NXDOMAIN, hoặc chữ ký "không có site" của provider: Vercel `DEPLOYMENT_NOT_FOUND` / header `x-vercel-error`, GitHub Pages "There isn't a GitHub Pages site here", Netlify "Not Found - Request ID" |

- 🔴 dead: mở (hoặc cập nhật) một GitHub Issue nhãn `dead-subdomain`, @mention owner. Không tự xoá; admin xoá thủ công nếu sau ~7 ngày chưa xử lý.
- 🟡 warn: chỉ hiển thị trên trang, không mở Issue.
- Kết quả ghi `status.json` dùng cho bước build trang (artifact của workflow, không commit vào repo). Khi build do push `main`, dùng artifact `status.json` gần nhất; subdomain mới chưa được quét hiển thị "chưa kiểm tra".
- Bản ghi trong `extra` và `_vercel` không được quét (không phải website).

### 5.7 Tech stack (quyết định của AI, có thể đổi)

- Node 22 + TypeScript, chạy bằng `tsx`; npm.
- Validation: zod. Test: vitest (unit test cho validator, ownership, status classifier).
- DNSControl (bản release chính thức, cài trong Actions) + provider `CLOUDFLAREAPI`.
- Trang tra cứu: **Next.js (App Router, static export) + Tailwind CSS** (+ shadcn/ui nếu cần). Xuất ra file tĩnh hoàn toàn nên chạy được cả trên Vercel lẫn GitHub Pages với chi phí 0, nhưng vẫn giữ sẵn nền React/Next.js để nâng cấp thành dashboard có đăng nhập sau này nếu muốn.

## 6. Việc của admin (ngoài code)

1. Mua domain ở Namecheap hoặc name.com (hoặc bất kỳ đâu), thêm domain vào Cloudflare (Free), rồi đổi nameserver tại nhà đăng ký sang 2 nameserver Cloudflare cấp. Hệ thống không phụ thuộc nhà đăng ký.
2. Tạo Cloudflare API token giới hạn một zone; thêm vào GitHub secret.
3. Tạo repo public trên GitHub, nối Vercel (hoặc bật GitHub Pages) cho thư mục `site/`, điền `config.json` (root domain, admins, `unmanaged`).
4. Bật branch protection cho `main` (required check `validate`, admin bypass) và tạo Environment `production`.

## 7. Quyết định do AI chốt (chủ dự án đã giao phần "làm sao cho ổn nhất")

- **Một domain trước** (`domains/*.json`): đúng với nhu cầu hiện tại (1 domain chính cho bản thân + vài người quen), tránh phức tạp thừa; nếu sau này cần gom nhiều domain vẫn tách thư mục được.
- **Next.js static export, chưa cần NestJS**: Next.js lo phần UI; phần xử lý/đồng bộ DNS do GitHub Actions + DNSControl đảm nhiệm nên không cần chạy server NestJS tốn phí và phải bảo trì.
- Cloudflare làm DNS; repo GitHub public; trang tra cứu host Vercel hoặc GitHub Pages.
- Hỗ trợ bản ghi `_xxx` dưới label của owner qua `extra` (GitHub Pages, ACME, Netlify).
- Bỏ `proxied` khỏi schema người dùng; luôn DNS-only.
- Repo chỉ quản lý subdomain; apex/bản ghi riêng của admin để trên dashboard, được `IGNORE` + drift guard bảo vệ.
- Admin push thẳng qua CLI; người quen trong `trusted` được auto-merge khi chỉ sửa file của chính mình; còn lại admin duyệt tay. Validator chạy code từ base branch, người ngoài admin chỉ được sửa `domains/`.
- `owner.contact` là tuỳ chọn và **không** hiển thị trên trang tra cứu (repo public nên ghi chú điều này trong docs).

## 8. Để builder quyết

- Cấu trúc code trong `scripts/`, tên file, chi tiết UI trang tra cứu (giữ đơn giản, dễ đọc, responsive, có dark mode theo hệ thống).
- Danh sách tên cấm đầy đủ, ngưỡng cụ thể (giới hạn record, ngưỡng xoá).
- Nội dung tài liệu hướng dẫn người dùng.
