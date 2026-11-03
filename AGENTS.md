# Lakbay — AI Agent Context & Security Record

This file records the security remediation performed on this repository so future agents
do not re-introduce fixed vulnerabilities. It is NOT a user-facing README; see `README.md`
for setup and usage.

## Audit & Remediation Summary

A full audit was performed (backend + frontend-customer + frontend-admin + config/infra) and
remediated in phases. Every finding below was fixed unless marked "[OUT OF SCOPE]".

### Phase 0 — Secrets & credential hygiene (DONE)
- `.gitignore`: blocks `.env*` (except `.env.example`), `backend/serviceAccountKey.json`, `node_modules/`, `dist/`, logs, editor/OS files.
- `.env.example`: full env template; `VITE_API_BASE_URL=/api`, `VITE_ENABLE_DEMO_LOGIN=false`, `VITE_ADMIN_URL`, Stripe/Geoapify/OpenWeather, `ADMIN_PASSWORD=AdminPassword123`.
- `backend/src/scripts/seedAdmin.js`: admin password is now env-only (`ADMIN_PASSWORD`, null fallback; `DEFAULT_ADMIN_PASSWORD='AdminPassword123'` fallback only for local first-seed), existing admin accounts are never clobbered on re-runs, password printed only on first creation with change warning.
- `frontend-admin/src/pages/auth/StaffLoginPage.jsx`: demo-credentials "Fill Primary Admin" button is gated behind `import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true'`.
- `docker-compose.yml`: added `VITE_ENABLE_DEMO_LOGIN`, `VITE_ADMIN_URL`, `TZ=Asia/Manila` env, backend healthcheck, `service_healthy` depends_on, `/api` nginx proxy in both frontend `nginx.conf`s, `/api` vite proxy for local dev.

[OUT OF SCOPE — USER ACTION] Rotate the real Firebase Admin service account key in the Firebase console; the current `backend/serviceAccountKey.json` is a real key and is git-ignored.

### Phase 1 — Backend CRITICAL (DONE)
- `backend/src/controllers/bookingController.js`:
  - Checkout enforces `departure.packageId === packageId` (prevents pairing a cheap packageId with an expensive departureId).
  - `numberOfTravelers` must be a whole integer 1–50.
  - `totalPrice` rounded to cents (`Math.round(... * 100) / 100`).
  - Stripe session creation failure rolls back the seat reservation inside a transaction (booking → Cancelled, departure bookedCount decremented) and returns 502 instead of leaking seats.
- `backend/src/controllers/webhookController.js` (rewritten):
  - Webhook secret checked case-insensitively for placeholder strings.
  - Production: unverified webhook delivery rejected outright (fail closed, 401).
  - Development only: unsigned fallback with loud warning.
  - Idempotent: skips already-Confirmed/Paid bookings; never resurrects Cancelled bookings; dedupes by `stripeSessionId`.
  - `checkout.session.expired` releases reserved seats atomically.
- `backend/src/config/stripe.js`: placeholder check case-insensitive.
- `backend/src/controllers/packageController.js` `updatePackage`: explicit field allowlist (no `...req.body` spread); `effectivePrice`/`discountPrice`/`hasDiscount` always recomputed server-side via `computePricing`; price validated positive.
- `backend/src/controllers/bookingController.js` `supportUpdateBooking`: operator ownership guard; bookingStatus/paymentStatus allowlists; paymentStatus changes restricted to support/admin roles.
- `backend/src/controllers/bookingController.js` `cancelBooking` + `processExceptionRefund`: refund honesty — `paymentStatus` becomes `Refunded` ONLY when Stripe refund succeeds; atomic claim transaction prevents double-refund/double seat release; failed refunds leave paymentStatus `Paid` with `refundStatus: failed` and notify support manually.
- `backend/src/server.js`:
  - CORS allowlist ALWAYS enforced (removed `NODE_ENV !== 'production'` bypass).
  - `express-rate-limit` added (general /api budget; webhook path excluded so Stripe retries aren't throttled).
  - Null-DB guard returns 503 on `/api/*` (except `/api/health`) when Firebase Admin isn't configured, instead of crashing handlers.
- `backend/package.json`: added `express-rate-limit@^7.5.0`.

### Phase 2 — Backend HIGH (DONE)
- `backend/src/controllers/guideController.js`: `updatePassengerCheckIn` and `completeDeparture` now require the caller to be the assigned guide / owning operator / admin (shared `authorizeDepartureAccess` guard).
- `backend/src/controllers/operatorController.js` `approveOperatorApplication`: anti-hijack guard — refuses approval if the resolved account already has role `admin`/`support`/`coordinator` (prevents clobbering staff accounts via an application filed with their email).
- `backend/src/controllers/departureController.js`:
  - `createDeparture`/`updateDeparture`/`cancelDeparture`: operator ownership guard is STRICT (`existing.operatorId === req.user.uid`; missing operatorId = platform-owned, off-limits to operators).
  - `updateDeparture`: field allowlist (no mass assignment of `operatorId`/`packageId`/`bookedCount`).
  - `computeBookingDeadline` anchored to Asia/Manila (+08:00, no DST) for deterministic deadlines regardless of server TZ.
- `backend/src/controllers/packageController.js`: strict Rule D guards in `updatePackage`/`deletePackage`.
- `backend/src/controllers/customerController.js` `syncProfile`: no longer clobbers `role` to `customer` or `accountStatus` to `active` on every sign-in — preserves existing role/status (staff demotion / deactivated-account reactivation fixed).
- `backend/src/controllers/adminController.js` `getDashboardMetrics`: collection counts use Firestore aggregation queries (`count()`) instead of downloading whole collections; removed unused `destinationPopularity`.
- `backend/src/middlewares/authMiddleware.js`: `verifyToken` maps Firebase error codes to clean 401s (expired/revoked/disabled/argument-error) and never leaks raw error messages.

### Phase 3 — Backend MEDIUM/LOW (DONE)
- `backend/src/utils/dates.js`: `todayInManila()`, `addDaysToDateStr()` (timezone-safe business-date helpers).
- `backend/src/utils/query.js`: `parseLimit(value, def, max)` clamps page sizes (NaN/0 → default, capped at max).
- Applied `todayInManila` to all "today" date comparisons (departure, booking, admin, operator, package, review controllers).
- Applied `computeBookingDeadline` Manila anchor (departureController).
- CSV export (`adminController.getReports` format=csv): cells are escaped — formula-injection prefixes (`= + - @ \t \r`) neutralized with leading `'`, quotes doubled, everything quote-wrapped.
- Firestore batch 500-op limit: `guideController.completeDeparture` and `departureController.cancelDeparture` use `commitInChunks` (chunks of 400).
- Limit clamping applied to `getPackages`, `getDestinations`, `getUsers`, `getActivityLogs`, `getAllBookings`, `adminGetAllReviews`.

### Phase 4 — frontend-admin (DONE)
- `src/contexts/StaffAuthContext.jsx`: `STAFF_ROLES` now includes `operator` (AdminRoutes grants operators access; context was wrongly rejecting them).
- `src/api/axiosClient.js`: baseURL fallback changed to `/api`; response interceptor handles 401 — force-refreshes the ID token once and retries; on persistent failure dispatches `auth:session-expired`.
- `src/App.jsx`: listens for `auth:session-expired` → `signOut(auth)` + navigate to `/login`.
- Hardcoded `http://localhost:5000/api` fallback removed.

### Phase 5 — frontend-customer (DONE)
- `src/api/axiosClient.js`: same 401 handling + `/api` fallback as admin.
- `src/App.jsx`: same `auth:session-expired` → signOut + `/login` wiring.
- `src/pages/public/BecomeOperatorPage.jsx`: operator-portal link uses `VITE_ADMIN_URL` (default `http://localhost:3001`) instead of hardcoded localhost.

Note: customer frontend computes `totalPrice` client-side in `PackageDetailPage.jsx` for DISPLAY ONLY; the backend recomputes and authorizes the authoritative price at checkout (Phase 1.1).

### Phase 6 — Infra/rules/docs (DONE)
- `firestore.rules` / `storage.rules`: reviewed — client write lockouts on `bookings`/`payments`/`activityLogs`; operator/role scoping consistent. No changes required.
- `nginx.conf` (both frontends): `/api/` → `proxy_pass http://backend:5000;` (NO trailing slash — a trailing slash strips the `/api` prefix and every proxied call 404s; fixed in Phase 7).
- `vite.config.js` (both frontends): added `/api` vite proxy for `npm run dev`.
- `README.md`: `ADMIN_PASSWORD` example corrected to `AdminPassword123`; added Security Operations section (key rotation, webhook verification, demo flag, CORS, rate limiting).

### Phase 7 — Second full audit: backend, frontend-admin, frontend-customer (DONE, 2026-11-03)
Not runtime-tested against Stripe/Firestore writes — exercise refunds, webhooks, cancellations and reschedules in Stripe test mode before relying on them.

Shared helpers (use these, don't re-implement):
- `backend/src/utils/dates.js`: `daysBetweenDateStrs(from, to)` (Manila calendar-day math). Never compute "days until departure" with `new Date('YYYY-MM-DD')` + `setHours` (server-TZ dependent).
- `backend/src/utils/apiResponse.js`: `httpError(msg, status)` — throw inside transactions so the error handler returns 4xx, not 500.
- `backend/src/utils/refunds.js`: `refundCancelledBooking()` — Stripe refund with idempotency key; `Refunded` only on success, else `refundStatus:'failed'` + reason.
- `frontend-customer/src/lib/dates.js` (`todayInManila`, `daysUntil`) and `src/lib/redirect.js` (`getSafeRedirect` — same-origin `?redirect=` only, blocks `//evil.com`).

Backend — bookings / payments / departures:
- Webhook confirms payment in ONE transaction that re-reads the booking; payment doc id is `stripe_<sessionId>` (dedupe). Only confirms when `payment_status === 'paid'`; handles `async_payment_succeeded/failed`. Payments landing on Cancelled/Rejected bookings are refunded (`latePaymentRefundStatus`).
- `cancelBooking`: Manila day math; unpaid bookings always cancel immediately and their Stripe Checkout session is expired; past-cutoff requests are flagged once (`cancellationRequested`, repeat → 409); payment state changing between read and claim → 409.
- `supportUpdateBooking`: PATCHing a PAID booking to Cancelled/Rejected is rejected (use the refund endpoints); unpaid → seats released in a transaction; Cancelled/Rejected can't be reactivated; reschedule re-reads inside the transaction and must stay within the same package.
- `cancelDeparture` / `updateDeparture(status:'cancelled')`: cancel every active booking per-transaction, release seats, refund paid ones via the helper, expire unpaid sessions; response is a summary `{affected, refunded, refundFailed, unpaidCancelled}`. Capacity can't drop below `bookedCount` (checked in a transaction). Date/time/meeting-point edits propagate to active bookings. `'full'` is a valid departure status.
- Checkout: rejects missing/zero price; `travelerManifest` is an allowlist of 5 string fields capped at `numberOfTravelers`; `bookingDeadlineHours` 0 is respected (`!== undefined ? Number(...) : 24` everywhere).
- Guides: `getBookingById` limited to bookings on their assigned departures; `completeDeparture` rejects cancelled/completed/future departures; manifest includes Completed bookings.

Backend — catalog / admin / operators / services:
- List endpoints (`getPackages`, `getDestinations`, `getUsers`, `getAllBookings`) filter/search BEFORE applying the limit.
- `updateDestination` and `updateCoTraveler` use field allowlists (Invariant 4). `destinationRoutes` GET uses `optionalToken` so staff see drafts.
- Public package lists (`getFeaturedPackages`, destination `relatedPackages`) hide non-approved packages and go through `enrichPackagePricing`.
- Operator approval: anti-hijack list includes `guide`; PH phones normalized to E.164 (else omitted); deactivated accounts not reactivated; new accounts get `passwordSetupLink` in the response (admin must relay it — no email is sent). Reject only works on pending applications.
- New route `GET /api/admin/guides` (admin/coordinator/operator) → `[{uid, fullName}]` of active guides. Use it for guide pickers; `/admin/users` is admin-only.
- Reports `totalCollected` counts only Paid AND (Confirmed|Completed). Promotions store `discountHighlight`; `actionUrl`/`bannerImageUrl` must be relative or http(s) (blocks `javascript:`). String `"false"` is parsed as false in moderation/promo toggles.
- Weather forecast grouped by Asia/Manila day; mock fallback cached only 60s; lat/lng validated (400). CORS rejection returns 403. `trust proxy` via `TRUST_PROXY` (default on for Vercel; set to 1 behind nginx — docker-compose does).
- `firestore.rules`: promotions read checks `isPublished`; guides can no longer write departures from the client. **Must be deployed manually** (`firebase deploy --only firestore:rules`).

frontend-admin:
- `StaffAuthContext`: Firestore role wins over the token claim (matches backend `verifyToken`); stale-session guard. Per-role landing via `getHomePath(role)`: `/dashboard` is admin/operator only; coordinator → packages, support → bookings, guide → manifest.
- API param names match backend: geocode `address`, autocomplete `query`, weather `lng`. Booking paymentStatus options are `Unpaid|Paid|Refunded`; only changed fields are sent to `supportUpdateBooking` (paymentStatus only for support/admin). Departures use `adminApi.getGuides()`.
- Refund UI reads `refundProcessed/refundFailed` and never claims success on failure; failed refunds can be "Marked Manually Refunded".
- Promotions send/read `bannerImageUrl`/`actionText` (plus legacy aliases). ImageUpload accepts PNG/JPEG/WebP only.

frontend-customer:
- `AuthContext`: deactivated login rethrows (no false "Welcome back"); registration suppresses the listener's profile auto-create (`registeringRef`); stale-user guard. Logout navigates home BEFORE signing out (else ProtectedRoute bounces to /login).
- `axiosClient`: persistent 401 or 403 "deactivated" (signed-in only) dispatches `auth:session-expired`; anonymous 401s just reject.
- App-wide `ScrollReveal` (MutationObserver, in AppRoutes) replaces per-page observers — never add `.reveal-*` classes that depend on a page-local observer.
- Checkout: button stays disabled while redirecting to Stripe; traveler count clamped to remaining seats (`??`, not `||`); co-travelers capped at travelers−1; non-open departures can't be booked. `formatDate` renders in Asia/Manila. No hooks after PackageDetailPage's early returns.
- Images: all `public/images/*` and seed `imageUrls` are verified Philippine photos (Wikimedia Commons `Special:FilePath` URLs). Do not reintroduce the old Unsplash IDs (Everest, Yosemite, Thailand, Maldives, Raja Ampat).

Infra: nginx `/api` proxy prefix fixed (see Phase 6); compose sets `TRUST_PROXY=1`; frontend Dockerfiles forward `VITE_ADMIN_URL` / `VITE_ENABLE_DEMO_LOGIN`. Admin portal port is 3001 everywhere (5174 was dead). Removed: `frontend-*/dist/` build output and the one-off `backend/src/scripts/fixCatalogImages.js` (already applied to Firestore).

### Catalog data (2026-11-03)
- `backend/src/scripts/seedMoreCatalog.js` added 10 destinations (Boracay, Banaue, Puerto Princesa, Vigan, Sagada, Moalboal, Camiguin, Siquijor, Albay, Hundred Islands) + 10 packages + 30 departures. CREATE-ONLY by name (never overwrites staff edits); already run against Firestore — re-running skips existing items.
- Seed `seedDemoData.js` UPDATES existing docs by name with full objects (clobbers admin edits) — prefer the create-only pattern for new seeds.
- All catalog `imageUrls` are Wikimedia Commons `Special:FilePath` photos verified by eye as the named Philippine place.

### Resilience fixes (2026-11-03, after E2E testing)
- Customer `src/main.jsx` wraps the app in `components/common/ErrorBoundary.jsx` — a render exception shows a recoverable error screen, never a white page. Coerce API numbers before formatting (`Number(x).toFixed`), Firestore values may be strings.
- `ScrollReveal.jsx`: per-run WeakSet (StrictMode-safe), `html.reveal-ready` gates hiding (index.css `@layer components`), restores `.visible` if className is rewritten. Never hide content with CSS that a script must later undo unless gated the same way.
- Backend: a Firestore failure during auth returns **503**, not 401 (401 makes clients sign the user out). `errorHandler` maps gRPC 8/14/4 (quota exhausted / unavailable / deadline) to 503 + `Retry-After`.
- Firebase Spark plan = 50k Firestore reads/day; heavy E2E runs + N+1 list endpoints exhausted it on 2026-11-03 (resets midnight Pacific). Run E2E suites sparingly or on the Blaze plan; reducing N+1 reads in `getPackages`/`getDepartures`/operator dashboards is the real fix.
- Customer logout from protected pages: `AuthContext.signedOutByUser` makes `ProtectedRoute` redirect to `/` instead of `/login?redirect=…`.
- E2E suites: API `scratchpad/e2e-api/run.mjs` (493 pass), UI `scratchpad/e2e-ui2/run.mjs` (not yet completed — blocked by quota).

## Known Gaps / Unfinished Work (not bugs — don't "fix" by faking data)
- No operator earnings/reports page or operator-scoped CSV (`/admin/reports` is admin-only).
- `GET /admin/activity-logs` has no admin UI or API wrapper.
- Customers can't report reviews (staff-only flagging); concurrent duplicate review submissions aren't transaction-guarded; review eligibility ignores tour duration.
- Promotions have no start/end dates (no auto-expiry).
- No scheduled jobs: past departures aren't auto-completed, stale Pending bookings rely on Stripe `checkout.session.expired`; marking a departure completed via `updateDeparture` doesn't complete its bookings (`completeDeparture` does).
- Mock fallbacks: no Stripe key → mock checkout URL (booking stays Pending); no Geoapify/OpenWeather key → `isMock` data; failed geocode defaults to Manila. Customer Contact form submits nothing.
- No pagination (pages use limits up to 500); booking references use 4 random hex chars/day with no uniqueness check; several list endpoints do N+1 reads.
- Home/About marketing stats (12K+ travelers, 120+ destinations, 4.9 rating) are hard-coded, not computed.
- Firestore may prompt for a composite index (`departureId ==` + `bookingStatus in`) on first manifest/departure-cancel run — follow the link it logs.

### Phase 8 — Vercel hosting hardening (DONE, 2026-11-03)
- `backend/vercel.json`: no legacy `version`/`routes`/`env`/invalid `runtime`; `rewrites` all paths to `api/index.js`, `regions: ["sin1"]`, `maxDuration: 60`. Node pinned via `engines.node` `22.x` (all three package.json).
- `backend/src/config/urls.js`: CORS allowlist from comma-separated `CLIENT_URL`/`ADMIN_URL`/`CORS_ORIGINS` (trailing slashes stripped); localhost dev origins only when `NODE_ENV !== 'production'`; Vercel previews only via opt-in strict regex (`CORS_VERCEL_PREVIEW_PROJECTS` + `CORS_VERCEL_TEAM_SLUG`), never `*.vercel.app`. Checkout returns 500 (before reserving seats) if `CLIENT_URL` is missing in production.
- Stripe webhook: `express.raw` mounted on `/api/webhooks` BEFORE `express.json` (req.rawBody = exact bytes); unsigned delivery never accepted when `VERCEL=1`.
- `firebaseAdmin.js`: `FIREBASE_SERVICE_ACCOUNT_BASE64` / `FIREBASE_SERVICE_ACCOUNT_JSON` support; private key quote/`
` normalization.
- `errorHandler`: 5xx messages masked in production.
- `cancelDeparture`: bounded concurrency (5) + resumable re-run on an already-cancelled departure with remaining active bookings. Guide departures listing batched (`db.getAll`), no N+1.
- Frontends: `vercel.json` SPA rewrite to `/index.html`, no `env` block; `vite.config.js` fails a Vercel build (`VERCEL=1`) when required `VITE_*` are missing or `VITE_API_BASE_URL` is not an absolute https URL. API architecture: frontends call the backend cross-origin via `VITE_API_BASE_URL=https://<backend>.vercel.app/api` (no /api proxy rewrite on Vercel).
- CI: per-file `node --check`, import smoke test, `cache-dependency-path`, `npm install` everywhere; deploys use `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod` (CLI pinned).
- Review follow-up: `backend/vercel.json` has `buildCommand: "mkdir -p public"` + `outputDirectory: "public"` (EMPTY static output — without it the "Other" preset serves the project root and `/package.json`, `/src/*.js` become downloadable; do not remove). `isProduction` in `urls.js`, `server.js`, `errorHandler.js` is `NODE_ENV === 'production' || VERCEL === '1'` (a Vercel deploy without NODE_ENV must still drop localhost CORS, mask 5xx, use the strict rate limit). `deploy-*.yml` run the Vercel CLI steps from the repo root (`working-directory: .`); the Vercel projects' Root Directory must be set to the app folder. Dockerfiles use `node:22-alpine` to match `engines.node`. Deployment docs live in `VERCEL_DEPLOYMENT.md` (README only points to it). Stripe event destinations must use **Snapshot** payloads (webhookController reads `event.data.object`; Thin is unsupported).

## Security Invariants (do not break)

1. **Checkout price integrity**: `packageId` ↔ `departureId` must match; `totalPrice` is server-computed from package price × travelers, rounded to cents; client-supplied totals are never trusted.
2. **Webhook fail-closed**: In production, Stripe webhooks are rejected unless the signature verifies against a real (non-placeholder) `STRIPE_WEBHOOK_SECRET`.
3. **Refund honesty**: `paymentStatus` = `Refunded` only when Stripe confirms the refund; failures are recorded, not faked.
4. **No mass assignment**: never spread `req.body` directly into Firestore writes; use field allowlists; pricing/status/ownership fields are server-controlled.
5. **Seat atomicity**: capacity reservation, booking creation, and Stripe session creation happen in a transaction; failures release seats; cancellations release seats atomically.
6. **RBAC**: operators only touch their own packages/departures/bookings (Rule D); staff roles cannot be demoted or accounts reactivated via `syncProfile`; client SDKs cannot write `bookings`/`payments`/`activityLogs` (`allow write: if false` in firestore.rules).
7. **Secrets**: `.env` and `backend/serviceAccountKey.json` are git-ignored; never commit real credentials.
8. **Business dates are Asia/Manila**: "today", days-until-departure, deadlines and forecast days use `todayInManila` / `daysBetweenDateStrs` (backend) and `lib/dates.js` (customer). Never `toISOString().split('T')[0]` for "today" or `new Date('YYYY-MM-DD')` + `setHours` for day math.
9. **No payment for a cancelled booking**: cancelling an unpaid booking expires its Stripe session; any payment that still lands on a Cancelled/Rejected booking is refunded by the webhook. Payment confirmation and cancellation claims re-read state inside a transaction.
10. **Transaction errors are 4xx**: throw `httpError(msg, status)` inside transactions; don't let business-rule violations surface as 500.

## Environment Variable Catalog

Backend: `PORT`, `HOST`, `NODE_ENV`, `CLIENT_URL`, `ADMIN_URL`, `CORS_ORIGINS`, `CORS_VERCEL_PREVIEW_PROJECTS`, `CORS_VERCEL_TEAM_SLUG`, `FIREBASE_*` (service account path, inline cert, or `FIREBASE_SERVICE_ACCOUNT_BASE64`/`FIREBASE_SERVICE_ACCOUNT_JSON`), `NODEJS_HELPERS=0` (Vercel only), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY`, `GEOAPIFY_API_KEY`, `OPENWEATHER_API_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_PHONE`, `TZ`, `TRUST_PROXY` (express `trust proxy` hops; default 1 on Vercel, set 1 behind nginx).
Frontend (Vite): `VITE_API_BASE_URL` (default `/api`), `VITE_ENABLE_DEMO_LOGIN` (default `false`), `VITE_ADMIN_URL`, `VITE_FIREBASE_*` (6 public config values — safe to embed).

## Verification (run before considering work complete)

1. `cd backend && npm install` (new dep: express-rate-limit).
2. `cd backend && node --check src/**/*.js` — all backend files must parse.
3. `cd frontend-customer && npm run build` and `cd frontend-admin && npm run build` — both Vite builds must pass.
4. `docker compose up --build` smoke test: `curl http://localhost:5000/api/health` returns healthy.
5. Confirm no regressions against the greps used in the audit (no `...req.body` spreads into writes, no `localhost:5000` fallbacks, no placeholder-only Stripe checks, no `localhost:5174`, no `|| 24` deadline-hours fallbacks).
6. Don't commit build output: `frontend-*/dist/` is git-ignored and rebuilt by CI/Vercel (`npm run build`).
