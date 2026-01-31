# Invoice & Compare Act Platform — Monorepo

მონორეპო (pnpm workspaces) სრული პლატფორმისთვის: **Landing + Cabinet + Admin + API + PostgreSQL**.

---

## ✅ მიზანი
პლატფორმა განკუთვნილია მომხმარებლებისთვის (კომპანია/ფიზიკური პირი/ინდ. მეწარმე), რომ სწრაფად შექმნან:
- ინვოისები (Invoice)
- ვალის შედარების აქტი (Compare Act)

და შეძლონ PDF-ის ჩამოტვირთვა ან გაგზავნა **Email/WhatsApp**-ით.

---

## ⚙️ Tech Stack
- Monorepo: **pnpm workspaces**
- Frontend: **Next.js (App Router) + Tailwind + shadcn/ui**
- Backend: **NestJS + Fastify**
- DB Access: **Prisma**
- DB: **PostgreSQL**
- Auth: **OTP + JWT (access+refresh)**
- Deploy: **Railway** (API+DB) + **Vercel** (Web) ან Railway Web service

---

## 🧩 Assumptions (დაზუსტებების გარეშე მიღებული გონივრული ვარაუდები)
1) **Revenue Service (my.gov.ge) გადამოწმება**: ჯერ არის ჩარჩო; რეალური ინტეგრაცია დაემატება შემდეგ ბეჩებში (ოფიციალურად დაშვებული მიდგომით).
2) **WhatsApp ინტეგრაცია**: პროვაიდერი არ არის განსაზღვრული (Twilio/360dialog/Meta Cloud API). ამიტომ ახლა გვაქვს “mock provider”, რომელიც ლოგებში წერს OTP-ს.
3) **TBC Payment (TPAY Checkout)**: ინტეგრირებულია "Checkout" flow-ით.
   - Backend ქმნის PaymentIntent ჩანაწერს, შემდეგ ქმნის გადახდას TBC-ში და აბრუნებს `approvalUrl`-ს.
   - TBC callback-ზე (`/billing/tbc/callback`) ვკითხულობთ payment details-ს და წარმატებისას ვააქტიურებთ Subscription-ს.
4) **OTP Hashing**: OTP კოდი DB-ში ინახება **hash**-ით (bcrypt).
5) **Security/IP**: OTP ჩანაწერში ვინახავთ `createdIp`; Free trial IP blocking + advanced rate limiting შემდეგ ბეჩებში.
6) **Subscription ლოგიკა**: პაკეტების ლიმიტები/წვდომები იკონტროლება Backend-ში.
   - Plan 100 GEL: Clients მოდულის მართვა (Add/Import) გამორთულია. *შენიშვნა:* ინვოის/აქტის შექმნისას შეიძლება ავტომატურად შეიქმნას/განახლდეს Client ჩანაწერი, რათა დოკუმენტზე სწორად მიებას (ეს არის გამარტივებული ვარაუდი).
   - Plan 20 GEL: PAYG 5 ინვოისი + 5 აქტი (საპასუხისმგებლოდ ითვლება `invoicesUsed`/`actsUsed`).
   - Subscription აქტივაცია ხდება **TBC callback**-ის საფუძველზე. DEV/QA-სთვის ისევ არსებობს `mock` endpoint.
7) **Free trial (IP)**: პირველ მომხმარებელს უფასოდ შეუძლია 1 ინვოისი + 1 აქტი **თითო IP-ზე**. IP ინახება მხოლოდ `sha256(salt:ip)` ჰეშით.

---

## 🚀 Local Run (დეველოპმენტი)

### 1) DB
```bash
pnpm db:up
```

### 2) Environment
- დააკოპირეთ `.env.example` → `.env`
- შეცვალეთ მინიმუმ:
  - `DATABASE_URL`
  - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
  - `NEXT_PUBLIC_API_BASE_URL`
  - `IP_HASH_SALT` (აუცილებელია production-ში)
  - `ALLOW_MOCK_BILLING=false` (default)

### 3) Backend
```bash
pnpm -C apps/api install
pnpm -C apps/api prisma:generate
pnpm -C apps/api prisma:migrate:dev
pnpm -C apps/api dev
```

API health:
- `GET http://localhost:3001/health`

### Subscription API
- `GET /subscriptions/plans` (public)
- `GET /subscriptions/me` (auth)
- `POST /subscriptions/mock/activate` (auth, საჭიროა `ALLOW_MOCK_BILLING=true`)

### Billing API (TBC Checkout)
- `POST /billing/tbc/checkout` (auth) → აბრუნებს `approvalUrl`-ს (redirect).
- `POST /billing/tbc/callback` (public) ← TBC აგზავნის `{ "PaymentId": "..." }`
- `GET /billing/payments/:id` (auth)

Auth endpoints (Batch 3):
- `POST /auth/register`
- `POST /auth/login/request-otp`
- `POST /auth/login/verify-otp`
- `POST /auth/refresh`

Cabinet endpoints (Batch 4):
- `GET /me` (JWT)
- `GET /dashboard/stats` (JWT)

### 4) Frontend
```bash
pnpm -C apps/web install
pnpm -C apps/web dev
```

Web:
- `http://localhost:3000`

---

## 🌐 Deploy (Chrome-only, GitHub + Railway + Vercel)

### A) GitHub Upload (ZIP-დან)
1) Windows → ZIP-ზე Right Click → **Extract All…**
2) GitHub → New Repository
3) Repo → **Add file → Upload files**
4) Drag&Drop root content
5) **Commit changes**

### B) Railway: PostgreSQL + API
1) railway.app → New Project
2) Provision PostgreSQL
3) New Service → GitHub Repo (ამ repo-დან)
4) Variables:
   - `DATABASE_URL` (Railway Postgres)
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   - `OTP_TTL_SECONDS` (optional)
5) Build/Start:
   - Build: `pnpm -C apps/api install && pnpm -C apps/api prisma:generate && pnpm -C apps/api prisma:migrate:deploy && pnpm -C apps/api build`
   - Start: `pnpm -C apps/api start:prod`

### C) Vercel: Web
1) vercel.com → New Project → Import GitHub Repo
2) **Root Directory**: `apps/web`
3) Env:
   - `NEXT_PUBLIC_API_BASE_URL` = Railway API URL ( напр: `https://<your-api>.up.railway.app` )
4) Deploy

---

## 📌 Batches
- Batch 1: Monorepo scaffold + API scaffold + Prisma schema
- Batch 2: Frontend scaffold (Next.js + Tailwind + shadcn/ui) + Landing + Auth UI skeleton
- Batch 3: **Auth foundation (OTP hashed in DB + JWT access/refresh + refresh rotation) + Frontend wiring**
- შემდეგი ბეჩები: Cabinet pages, CRUD, PDF/email/whatsapp, subscription/payment, admin.


Clients endpoints (Batch 5):
- `GET /clients` (JWT)
- `POST /clients` (JWT)
- `PUT /clients/:id` (JWT)
- `DELETE /clients/:id` (JWT)
- `POST /clients/import/csv` (JWT)
- `GET /clients/export/csv` (JWT)


Invoices endpoints (Batch 6):
- `GET /invoices` (JWT)
- `GET /invoices/:id` (JWT)
- `POST /invoices` (JWT)
- `PUT /invoices/:id` (JWT)
- `DELETE /invoices/:id` (JWT)

Invoice numbering (Batch 6):
- `<TenantTaxPayerId>-<ClientTaxPayerId>-<seq>` where seq starts at 1 per tenant+client.

VAT (Batch 6):
- VAT rate is 18%.
- VAT can be included only if Tenant is VAT payer (server-side check).


Acts endpoints (Batch 7):
- `GET /acts` (JWT)
- `GET /acts/:id` (JWT)
- `POST /acts` (JWT)
- `PUT /acts/:id` (JWT)
- `DELETE /acts/:id` (JWT)

Act numbering (Batch 7):
- `<TenantTaxPayerId>-<ClientTaxPayerId>-ACT-<seq>` where seq starts at 1 per tenant+client.


PDF download (Batch 8):
- `GET /invoices/:id/pdf` (JWT) -> application/pdf
- `GET /acts/:id/pdf` (JWT) -> application/pdf

Note: API uses `pdfkit` to generate PDFs on the fly.

Notifications (Batch 9)
- Email (SMTP):
  - SMTP_HOST
  - SMTP_PORT (default 587)
  - SMTP_SECURE (true/false)
  - SMTP_USER
  - SMTP_PASS
  - SMTP_FROM (optional)

- WhatsApp (optional, WhatsApp Cloud API):
  - WHATSAPP_CLOUD_TOKEN
  - WHATSAPP_PHONE_NUMBER_ID
  - WHATSAPP_API_VERSION (default v19.0)

- Public links for clients (one-time, expires in 7 days by default):
  - PUBLIC_BASE_URL (should be your API public URL, e.g. https://invoiceapi-production-xxxx.up.railway.app)

Send endpoints (JWT):
- `POST /invoices/:id/send/email` body: `{ "to": "email@example.com" }` (optional override)
- `POST /invoices/:id/send/whatsapp` body: `{ "to": "9955xxxxxxx" }` (optional override)
- `POST /acts/:id/send/email`
- `POST /acts/:id/send/whatsapp`

Public download endpoints (no auth, token-based):
- `GET /public/invoices/:token/pdf`
- `GET /public/acts/:token/pdf`

Notes:
- Email attaches the generated PDF and also includes a one-time public download link.
- WhatsApp sends a text message with a public link (and uses Cloud API if configured, otherwise logs in server).


## Batch 11 — Frontend: Subscription UI + Clients gating

- Added cabinet route: `/cabinet/subscription`
- Shows:
  - Current subscription status (`/subscriptions/me`)
  - Remaining counters for PAYG plan (invoicesRemaining / actsRemaining)
  - Plan catalog (`/subscriptions/plans`)
  - DEV/QA: mock activation UI (requires `ALLOW_MOCK_BILLING=true`)
- Clients page is now gated:
  - If current plan does not allow clients (e.g. `BASIC_NO_CLIENTS`) it shows a lock screen and redirects user to Subscription page.



## Batch 13 — Hardening: TBC callback IP allowlist + Web polling

- Added optional env `TBC_CALLBACK_ALLOWED_IPS` (comma-separated) to ignore callbacks from unknown IPs.
- Frontend subscription page polls `/billing/payments/:id` after return from TBC to show status and refresh subscription.


## Admin Panel

- Admin login: `POST /admin/auth/login`
- Tenants list: `GET /admin/tenants`
- Payments list: `GET /admin/payments`
- Update subscription: `POST /admin/tenants/:tenantId/subscription`

Web UI:
- `/admin/login`
- `/admin` (dashboard)

Bootstrap admin via env:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Security:
- Admin token is JWT signed with `JWT_ACCESS_SECRET` and claim `role=admin`.

---

## Revenue Service verification (Georgia)

my.gov.ge-ის შესაბამის სერვისს საჯაროდ დოკუმენტირებული API არ აქვს, ამიტომ პროექტში დამატებულია **production-safe** მიდგომა.

- `REVENUE_CHECK_MODE=manual` (default): რეგისტრაციისას backend აბრუნებს “manual required” პასუხს და UI მომხმარებელს აჩვენებს ბმულს my.gov.ge-ზე.
- `REVENUE_CHECK_MODE=mock`: დევ/დემო რეჟიმი, აბრუნებს mock სახელებს (დამოწმების გარეშე).
- `ALLOW_REVENUE_CHECK_BYPASS=true`: თუ manual რეჟიმში დადასტურება ვერ შესრულდა, რეგისტრაცია არ ბლოკავს (Tenant შეიქმნება `revenueStatus=BYPASSED`).

Strict mode:
- `ALLOW_REVENUE_CHECK_BYPASS=false`: რეგისტრაცია **დაიბლოკება** სანამ Revenue Service ვერ დამოწმდება.
  - Backend error: `{ code: "REVENUE_VERIFICATION_REQUIRED", manualUrl }`
  - Web UI: Register page აჩვენებს შეცდომას და `manualUrl` ბმულს.

Document gating (optional strict policy):
- `REVENUE_DOCS_REQUIRE_VERIFIED=false` (default): ინვოის/აქტის შექმნა არ არის დამოკიდებული Revenue status-ზე.
- `REVENUE_DOCS_REQUIRE_VERIFIED=true`: ინვოის/აქტის შექმნა დაიბლოკება თუ tenant-ის `revenueStatus` არის `PENDING` ან `FAILED`.
  - Allowed: `VERIFIED` ან `BYPASSED`.
  - Backend error: `{ code: "REVENUE_NOT_VERIFIED", revenueStatus, manualUrl }`
- `REVENUE_MANUAL_URL` (optional): override my.gov.ge manual link (default იგივეა რაც RevenueService-ში).


## Batch 16 — Admin-side manual revenue verification

- Added revenue verification log table and admin endpoint to update tenant revenue status.
- Admin UI: button `Revenue` to set VERIFIED/FAILED/BYPASSED/PENDING + optional name/note.


## Batch 17 — Revenue verification log viewer (Admin)

- Added Admin API:
  - `GET /admin/tenants/:tenantId/revenue/logs` (last 50)
- Admin UI (`/admin`) now has **History** button per tenant to view revenue verification log.


## Batch 18 — Strict registration UX for Revenue verification

- Web error parsing updated so NestJS structured errors do not show as `[object Object]`.
- Register page shows a clear message + manual my.gov.ge link when registration is blocked (strict mode).


## Batch 19 — Optional strict gating for Invoice/Act creation

- Added `RevenueDocsGuard` (NestJS guard) used on:
  - `POST /invoices`
  - `POST /acts`
- When `REVENUE_DOCS_REQUIRE_VERIFIED=true` and tenant revenueStatus is not ok, API returns structured error:
  - `{ code: "REVENUE_NOT_VERIFIED", revenueStatus, manualUrl }`
- Note: Guard runs BEFORE subscription usage reservation, so free-trial/subscription counters are not consumed if blocked.

