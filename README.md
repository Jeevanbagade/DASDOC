# DocDash — *Print it fast, skip the past.*

Upload PDFs, Word docs or photos from your phone; get crisp printed pages delivered to your door. B&W **₹2/page**, colour **₹5/page**, delivery **₹5 flat**.

Production-ready MVP built on **Next.js 16 (App Router) · TypeScript (strict) · PostgreSQL via Drizzle ORM · Tailwind CSS v4 · Zod**. *(The brief's React+Express alternative was adapted to this repo's existing fullstack Next.js stack — one framework serving both UI and REST API, which keeps the shared pricing/validation modules literally identical between client and server.)*

---

## What's inside

| Area | Highlights |
| --- | --- |
| Auth | Mobile (+country code) + password, scrypt hashing, JWT in httpOnly cookie (7-day sessions), middleware route guard, duplicate-mobile detection, uniform-timing login |
| Uploads | PDF / DOC / DOCX / JPG / PNG / HEIC + mobile camera capture, multi-file per order, permanent “Add document” control, drag & drop, 25 MB cap (configurable), per-file rejections with reasons |
| Page counts | `pdf-lib` for PDFs (exact); DOCX reads `docProps/app.xml` → `<Pages>` else word-count estimate; legacy `.doc` heuristic. Estimates are flagged everywhere |
| Print options | Per-document copies (1–50) and B&W/Colour, quick “all B&W / all colour”, live estimate bar |
| Delivery | Full address form with Zod validation (incl. 6-digit pincode) |
| Bill | Server-authoritative quote endpoint; receipt-style breakdown per document, subtotal, flat delivery, total |
| Payment | UPI via mock gateway behind a `PaymentProvider` seam (Razorpay/Stripe drop-in), COD default whenever UPI is unavailable, failing-handle simulation (`fail@upi`) |
| Orders | Confirmation with ink-stamp, order number (`DD-YYMMDD-XXXX`), delivery ETA (~36 h), status timeline; persisted history + detail pages |
| Money | Integer **paise** everywhere; totals recomputed server-side from DB page counts; client totals are only ever a *claim* — a disagreement blocks the order with `PRICING_MISMATCH` |
| Safety | Idempotency keys unique per placement (retry/double-click safe), atomic document attach inside the order transaction, typed error codes end-to-end |

---

## Quick start

```bash
# 1) install
npm install

# 2) environment
cp .env.example .env          # then edit values (a working dev .env ships in this sandbox)

# 3) database (PostgreSQL at DATABASE_URL)
npm run db:push               # applies src/db/schema.ts via drizzle-kit

# 4) (optional) demo data — user + 2 orders
npm run seed
#    login → mobile: 98765 43210 · password: Passw0rd!
#    (this demo account is also auto-created/refreshed at server boot — see SEED_DEMO_USER)

# lockout recovery (operator):
npm run reset-password -- 8088462503 'NewPass123'

# 5) run
npm run dev                   # http://localhost:3000
```

Production: `npm run build && npm run start`.

---

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `SESSION_SECRET` | dev fallback | Signs session JWTs — **set in production** |
| `SESSION_TTL_SECONDS` | `604800` | Session lifetime (7 days) |
| `SEED_DEMO_USER` | `true` | At boot, upserts the demo account (`98765 43210` / `Passw0rd!`) so every deploy is immediately login-able; set `false` to disable |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | `25` | Per-file upload cap (client + server enforced) |
| `NEXT_PUBLIC_DEFAULT_COUNTRY_CODE` | `+91` | Mobile normalisation prefix |
| `STORAGE_DRIVER` | `local` | `local` disk (dev) · `s3` (production seam — see `src/server/storage.ts`) |
| `STORAGE_DIR` | `.storage` | Local upload root (git-ignored) |
| `DELIVERY_ETA_HOURS` | `36` | Delivery promise shown + stored per order |
| `NEXT_PUBLIC_UPI_AVAILABLE` | `true` | `false` hides UPI; COD becomes the default UI selection |
| `UPI_MOCK_ENABLED` | `true` | `false` makes the mock gateway answer “unavailable” |

---

## Tests

```bash
npm test                 # everything (100 tests / 4 files)
npm run test:coverage    # + V8 coverage report (HTML in coverage/)
```

| Suite | Scope |
| --- | --- |
| `tests/unit/pricing.test.ts` | Full pages × copies × colour matrix, delivery-fee-once, integer guards, `EMPTY_ORDER`, money formatting |
| `tests/unit/validators.test.ts` | Mobile normalisation/validation, pincode, password strength, UPI handle, file classification + size limits |
| `tests/integration/order-flow.test.ts` | **Real route handlers against a real DB**: signup → duplicate → login (wrong/right) → `/me` → PDF upload with 3 pages → quote → **PRICING_MISMATCH block** → COD order → idempotent replay → `DOC_ALREADY_ORDERED` → paid UPI order → failed UPI (nothing persisted) → history + detail → cross-user `ORDER_NOT_FOUND` |
| `tests/components/wizard.test.tsx` | Receipt totals/flags, Options step interactions (copies, colour, quick actions, live subtotal), address-schema validation |

Integration tests need the database (`npm run db:push` first). They create and purge their own users (`9000000001`, `9000000999`).

---

## API

All endpoints return the standard error envelope on failure:

```json
{ "error": { "code": "PRICING_MISMATCH", "message": "...", "details": { } } }
```

| Method & path | Auth | Body → Response (success) |
| --- | --- | --- |
| `POST /api/auth/signup` | — | `{name, mobile, password, confirmPassword}` → `201 {user}` + session cookie. `409 DUPLICATE_MOBILE` |
| `POST /api/auth/login` | — | `{mobile, password}` → `200 {user}` + cookie. `401 AUTH_INVALID` |
| `POST /api/auth/logout` | — | clears the cookie → `200 {ok:true}` |
| `GET /api/auth/me` | cookie | → `200 {user}` · `401 AUTH_REQUIRED/EXPIRED` |
| `POST /api/uploads` | cookie | multipart `file` → `201 {document}` (kind, sizeBytes, pageCount, pageCountEstimated). `413 FILE_TOO_LARGE` · `415 UNSUPPORTED_FILE` · `422 FILE_UNREADABLE` |
| `DELETE /api/uploads/:id` | cookie | → `200 {ok:true}` · `404 DOC_NOT_FOUND` · `409 DOC_ALREADY_ORDERED` |
| `POST /api/pricing/quote` | cookie | `{items:[{pageCount,copies,colorMode}]}` → `200 {quote}` (authoritative) |
| `POST /api/orders` | cookie | `{items:[{documentId,copies,colorMode}], address, paymentMethod, upiId?, expectedTotalPaise, idempotencyKey}` → `201 {order, duplicated:false}`. Replay of the key → `200 duplicated:true`. Guards: `400 VALIDATION` (incl. zero items), `404 DOC_NOT_FOUND`, `409 DOC_ALREADY_ORDERED`, `422 PRICING_MISMATCH` (with `serverTotalPaise` in details), `400 UPI_ID_INVALID`, `402 PAYMENT_FAILED` |
| `GET /api/orders` | cookie | → `200 {orders[]}` newest-first with item/sheet counts |
| `GET /api/orders/:id` | cookie | → `200 {order}` full detail (items, address, masked payment) · `404 ORDER_NOT_FOUND` for foreign ids |
| `GET /api/health` | — | `{ok:true}` |

**Error codes** (typed in `src/lib/errors.ts`): `VALIDATION · AUTH_REQUIRED · AUTH_INVALID · AUTH_EXPIRED · FORBIDDEN · DUPLICATE_MOBILE · FILE_TOO_LARGE · UNSUPPORTED_FILE · FILE_UNREADABLE · DOC_NOT_FOUND · DOC_ALREADY_ORDERED · EMPTY_ORDER · PRICING_INVALID · PRICING_MISMATCH · UPI_ID_INVALID · PAYMENT_FAILED · ORDER_NOT_FOUND · CONFLICT · INTERNAL`.

---

## Architecture

```
src/
  lib/            # PURE, shared client+server code
    pricing.ts      ← single source of truth for money (paise ints)
    schemas.ts      ← Zod request shapes used by forms AND routes
    validators.ts   ← mobile / pincode / password / UPI
    files.ts        ← allowed types, size rules, classification
    errors.ts       ← typed error codes + HTTP mapping
    config.ts       ← NEXT_PUBLIC_* only
    api-client.ts   ← typed fetch wrapper for the browser
  server/         # server-only
    auth.ts         ← scrypt + jose JWT sessions
    orders.ts       ← order service (idempotent, transactional, authoritative)
    documents.ts    ← upload pipeline
    pagecount.ts    ← pdf-lib / DOCX / heuristic counting
    storage.ts      ← StorageDriver interface (local now, S3 seam)
    payments.ts     ← PaymentProvider interface + MockUpiProvider
    http.ts         ← ok()/fail() central error handler
    env.ts, log.ts  ← env access · structured, PII-free logs
  db/             # Drizzle schema + pool
  app/
    api/...       # thin route handlers (validate → service → respond)
    page.tsx      # landing
    (login|signup)/new-order/orders...  # screens; wizard is a client island
  middleware.ts   # edge session guard for /new-order, /orders, /login, /signup
tests/            # unit · integration · components
scripts/seed.ts   # demo data
```

**Data model:** `users` (unique `mobile_e164`) · `documents` (metadata + storage key + `order_id`) · `orders` (unique `order_number`, unique `idempotency_key`, paise totals, `eta_at`) · `order_items` (price snapshots; `document_id` unique) · `addresses` · `payments` (masked UPI, txn ref).

**Why the client can never set the price:** the Bill step *renders* the server quote; order creation recomputes totals from DB page counts and rejects any drift with `PRICING_MISMATCH` (asserted in integration tests); line items are snapshots taken server-side in the same transaction.

---

## Manual QA checklist

| # | Requirement | How to verify | Expected |
| --- | --- | --- | --- |
| 1 | Login: mobile + password | `/login`, enter seeded `98765 43210` / `Passw0rd!` | Lands on `/new-order` |
| 1b | Wrong credentials | same form, bad password | Inline banner “Incorrect mobile number or password” |
| 2 | Signup link + fields | `/signup`: name, mobile, password, confirm | Creates account, straight into the wizard |
| 2b | Mobile validation | try `12345`, `5876543210`, letters | Field error (10-digit rule, 6–9 start for +91) |
| 2c | Password strength | type progressively strong passwords | Meter moves weak→fair→strong; rules tick |
| 2d | Duplicate account | signup again with same mobile | `DUPLICATE_MOBILE` banner + field error |
| 2e | Session expiry | delete `dd_session` cookie, open `/orders` | Redirect to `/login?next=/orders` (middleware) |
| 3 | Upload types | add PDF, DOCX, PNG; use “Scan with camera” on mobile | All accepted; list shows name/type/size/pages |
| 3b | Camera capture | mobile “Scan with camera” | Native camera opens (`accept="image/*" capture="environment"`) |
| 3c | Multiple files + Add Document | upload 1 file → “Add document” again | Button always present; multiple uploads listed |
| 3d | Remove | X on a file row | Row leaves; totals update; file deleted server-side |
| 3e | Bad type | try `.exe` / `.xlsx` | Immediate rejection with reason |
| 3f | Oversize | >25 MB file | `FILE_TOO_LARGE` message with sizes |
| 3g | Estimated pages | upload a `.docx` (or `.doc`) | Shows “(est.)” chip + bill footnote |
| 4 | Copies per document | steppers in Options | 1–50 clamped; live estimate updates |
| 4b | Colour modes | toggle B&W/Colour per doc + quick actions | `₹2/₹5` rates applied per line |
| 5 | Address form | blank submit, bad pincode (`1234`) | Per-field errors, wizard blocks Continue |
| 6 | Bill breakdown | Bill step | Receipt lists each doc `pages × copies × rate`, subtotal, ₹5 delivery, total; “Server-verified” chip |
| 7 | UPI payment | choose UPI, enter `asha@okhdfc` | Order placed instantly, paid chip + `UPI-XXXX` ref |
| 7b | Failed UPI | UPI with `fail@upi` | `PAYMENT_FAILED` banner, **no** order in history |
| 7c | COD default | set `NEXT_PUBLIC_UPI_AVAILABLE=false` | UPI card “Unavailable”, COD pre-selected |
| 8 | Confirmation | place any order | Stamp animation, `DD-…` number, ETA date/time, status, receipt, address |
| 8b | Order history | `/orders` | New order first; correct totals; detail page with timeline |
| 9 | Double-click safety | spam “Place order” | One order only (idempotency key) — history shows a single record |
| 9b | Tampered total | edit `expectedTotalPaise` via devtools/API | `PRICING_MISMATCH`, order refused |
| 9c | Zero files | Continue on empty Upload step | Button disabled; API would answer `VALIDATION`/`EMPTY_ORDER` |

---

## Known limitations & next steps

1. **Real UPI** — the mock gateway sits behind `PaymentProvider` (`src/server/payments.ts`). Next: Razorpay Orders API / collect-request flow + webhook reconciliation; note the rare double-charge window on order-number retry documented in `orders.ts`.
2. **File serving** — uploads are private on disk; there’s intentionally no download endpoint yet (admin print console will stream via the storage driver).
3. **S3 driver** — interface + factory exist; `S3Storage.put/delete/exists` need AWS-SDK wiring (env keys already in `.env.example`).
4. **DOCX pagination** — exact counts only when the authoring app embeds `<Pages>`; otherwise word-count estimate is flagged. A LibreOffice render service would make these exact.
5. **Order tracking** — statuses exist end-to-end but nothing advances them post-placement; an admin dashboard (print queue, status moves, refunds) is the natural next milestone.
6. **Notifications** — SMS (mobile-first product!) / WhatsApp order updates; structured logs already emit the required events (`order.created`, `payment.captured`).
7. **Rate limiting** — login/upload endpoints are unthrottled; add IP+mobile buckets before public launch.
8. **Sessions** — stateless JWTs can’t be revoked server-side; a refresh-token/rotation table (or short TTLs) is the hardening step.
