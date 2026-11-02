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
- `src/pages/public/BecomeOperatorPage.jsx`: operator-portal link uses `VITE_ADMIN_URL` (default `http://localhost:5174`) instead of hardcoded localhost.

Note: customer frontend computes `totalPrice` client-side in `PackageDetailPage.jsx` for DISPLAY ONLY; the backend recomputes and authorizes the authoritative price at checkout (Phase 1.1).

### Phase 6 — Infra/rules/docs (DONE)
- `firestore.rules` / `storage.rules`: reviewed — client write lockouts on `bookings`/`payments`/`activityLogs`; operator/role scoping consistent. No changes required.
- `nginx.conf` (both frontends): added `/api/` → `http://backend:5000/` proxy so `VITE_API_BASE_URL=/api` works in Docker Compose.
- `vite.config.js` (both frontends): added `/api` vite proxy for `npm run dev`.
- `README.md`: `ADMIN_PASSWORD` example corrected to `AdminPassword123`; added Security Operations section (key rotation, webhook verification, demo flag, CORS, rate limiting).

## Security Invariants (do not break)

1. **Checkout price integrity**: `packageId` ↔ `departureId` must match; `totalPrice` is server-computed from package price × travelers, rounded to cents; client-supplied totals are never trusted.
2. **Webhook fail-closed**: In production, Stripe webhooks are rejected unless the signature verifies against a real (non-placeholder) `STRIPE_WEBHOOK_SECRET`.
3. **Refund honesty**: `paymentStatus` = `Refunded` only when Stripe confirms the refund; failures are recorded, not faked.
4. **No mass assignment**: never spread `req.body` directly into Firestore writes; use field allowlists; pricing/status/ownership fields are server-controlled.
5. **Seat atomicity**: capacity reservation, booking creation, and Stripe session creation happen in a transaction; failures release seats; cancellations release seats atomically.
6. **RBAC**: operators only touch their own packages/departures/bookings (Rule D); staff roles cannot be demoted or accounts reactivated via `syncProfile`; client SDKs cannot write `bookings`/`payments`/`activityLogs` (`allow write: if false` in firestore.rules).
7. **Secrets**: `.env` and `backend/serviceAccountKey.json` are git-ignored; never commit real credentials.

## Environment Variable Catalog

Backend: `PORT`, `HOST`, `NODE_ENV`, `CLIENT_URL`, `ADMIN_URL`, `FIREBASE_*` (service account path or inline cert), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY`, `GEOAPIFY_API_KEY`, `OPENWEATHER_API_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_PHONE`, `TZ`.
Frontend (Vite): `VITE_API_BASE_URL` (default `/api`), `VITE_ENABLE_DEMO_LOGIN` (default `false`), `VITE_ADMIN_URL`, `VITE_FIREBASE_*` (6 public config values — safe to embed).

## Verification (run before considering work complete)

1. `cd backend && npm install` (new dep: express-rate-limit).
2. `cd backend && node --check src/**/*.js` — all backend files must parse.
3. `cd frontend-customer && npm run build` and `cd frontend-admin && npm run build` — both Vite builds must pass.
4. `docker compose up --build` smoke test: `curl http://localhost:5000/api/health` returns healthy.
5. Confirm no regressions against the greps used in the audit (no `...req.body` spreads into writes, no `localhost:5000` fallbacks, no placeholder-only Stripe checks).
