# Lakbay: API Reference and Vercel Deployment Guide

This guide shows how to host all of Lakbay on Vercel: the Express API and both React frontends. It is written for the developers deploying the project and for anyone grading or reviewing it. Follow the sections in order the first time.

> Placeholders like `<backend-project>.vercel.app` stand for your real values. **Never paste real keys into this file, `vercel.json`, or any committed file.** Secrets belong only in Vercel Project Settings, or in your local git-ignored `.env`.

---

## 1. Architecture overview

Lakbay is deployed as **three separate Vercel projects** from one Git repository. Each project's **Root Directory** is its folder:

| Vercel project (name already linked in this repo) | Repo folder | What it is | Vercel type |
|---|---|---|---|
| `backend` | `backend/` | Express API (`src/server.js`), run as **one** serverless function (`api/index.js`) | Other (Node function) |
| `frontend-customer` | `frontend-customer/` | Customer website (Vite + React Router SPA) | Vite (static) |
| `frontend-admin` | `frontend-admin/` | Staff / operator portal (Vite + React Router SPA) | Vite (static) |

```
                Browser (customer)                 Browser (staff / operator)
                        |                                     |
       https://<customer-project>.vercel.app      https://<admin-project>.vercel.app
        (static files + SPA fallback)              (static files + SPA fallback)
                        |                                     |
                        |   axios -> VITE_API_BASE_URL        |
                        |   (cross-origin, Bearer token)      |
                        +-----------------+-------------------+
                                          v
                     https://<backend-project>.vercel.app/api/...
                     backend/vercel.json rewrites every path -> api/index.js
                     Express app: CORS allowlist, rate limit, routes
                         |                 |                  |
                Firebase Admin       Stripe API      Geoapify / OpenWeather
              (Auth + Firestore)   (Checkout, refunds)    (proxied server-side)
                                          ^
                Stripe webhooks ----------+  POST /api/webhooks/stripe
```

How the pieces talk to each other:

- Each frontend calls the API **directly at its absolute URL**: `VITE_API_BASE_URL=https://<backend-project>.vercel.app/api`. The frontends do **not** proxy `/api` on Vercel. Their only rewrite is the SPA fallback to `index.html`. A Vercel build of either frontend **fails on purpose** when `VITE_API_BASE_URL` is not an absolute `https://` URL (see `vite.config.js`).
- Because of that, every API call is cross-origin. The backend allows only the origins listed in `CLIENT_URL`, `ADMIN_URL` and `CORS_ORIGINS`. That allowlist is always enforced.
- Users sign in with the **Firebase client SDK** in the browser. The frontend sends the Firebase ID token as `Authorization: Bearer <token>`, and the backend verifies it with Firebase Admin.
- Payments use **Stripe Checkout**. The backend creates the session, Stripe sends the customer back to the customer site, and Stripe confirms the payment by calling the backend webhook.

Current config files (already in the repo, no edits needed):

- `backend/vercel.json`: `framework: null`, `buildCommand: "mkdir -p public"` + `outputDirectory: "public"` (an **empty** static output, so no source file such as `/package.json` can be downloaded), `regions: ["sin1"]` (Singapore), `functions["api/index.js"].maxDuration = 60`, and a rewrite that sends `/(.*)` to `/api/index.js`.
- `frontend-*/vercel.json`: `framework: "vite"`, `buildCommand: "npm run build"`, `outputDirectory: "dist"`, and a rewrite that sends `/(.*)` to `/index.html`, so refreshing a deep link works.
- All three `package.json` files pin `engines.node` to `22.x`.

---

## 2. Prerequisites

| You need | Why | Where |
|---|---|---|
| Vercel account | Hosting for all three projects. **Hobby** is fine for testing, demos and school use. Hobby is for personal, non-commercial use only, so a real commercial launch that takes live payments (`sk_live_`) needs **Pro**. | https://vercel.com |
| GitHub repo access | Vercel deploys from it | your repo |
| Firebase project | Auth, Firestore, Storage. In the console enable **Firestore Database**, **Storage** (Get started) and **Authentication > Sign-in method > Email/Password** before deploying rules or testing sign-up. Creating a default Storage bucket now (late 2024 onward) requires the **Blaze** plan; the admin image upload uses Storage. | https://console.firebase.google.com |
| Firebase **service account** key (JSON) | Backend admin access | Firebase console > Project settings > Service accounts > Generate new private key |
| Firebase **web app** config (6 values) | Frontend sign-in | Firebase console > Project settings > General > Your apps > Web app |
| Stripe account (test mode is fine) | Checkout, refunds, webhooks | https://dashboard.stripe.com |
| Geoapify API key | Location autocomplete and geocoding | https://myprojects.geoapify.com |
| OpenWeather API key | Weather for destinations and departures | https://home.openweathermap.org/api_keys |
| Node.js 22 + npm | Local seeding and builds | https://nodejs.org |
| Firebase CLI | Deploy `firestore.rules` and `storage.rules` | `npm install -g firebase-tools` |
| Stripe CLI (recommended) | Send test webhook events (`stripe login`, then `stripe trigger ...`) | https://docs.stripe.com/stripe-cli |
| Vercel CLI (optional) | Pulling env vars, manual deploys | `npm install -g vercel@63.1.2` |

**Pick a region first.** Look up your Firestore location in Firebase console > Firestore Database > the location shown at the top (or Project settings). The backend is pinned to `sin1` (Singapore), which suits `asia-southeast1`. If your database is somewhere else, change `regions` in `backend/vercel.json`: use `hkg1` for `asia-east2` (Hong Kong) or `asia-east1` (Taiwan), and `iad1` for `us-east1` / `us-east4`. `nam5` is the US multi-region centred on us-central, so `iad1` or `cle1` are both acceptable. Full list of region ids: https://vercel.com/docs/regions. **The Firestore location is not recorded in the repo, so check it yourself.**

---

## 3. API reference summary

### Base URL

```
https://<backend-project>.vercel.app/api
```

Locally the base URL is `http://localhost:5000/api`. The backend root `/` returns a small JSON banner. Unknown paths return `404 {"success":false,"message":"Route not found: ..."}`.

### Authentication

- Send `Authorization: Bearer <Firebase ID token>`. In the browser, get the token with `await auth.currentUser.getIdToken()`.
- **verifyToken** (shown as "Signed-in" below): the request needs a valid token. A missing, expired or revoked token returns `401`, and a deactivated account returns `403`.
- **optionalToken** (shown as "Public (+token)"): works without a token. With a staff or operator token you also see unpublished or extra items.
- **Role resolution**: the backend reads the role from the user's Firestore document `users/{uid}.role`, falls back to the token's custom claim, and defaults to `customer`.
- **Roles**: `customer`, `operator`, `guide`, `coordinator`, `support`, `admin`. **`admin` passes every role check.** Operators can only touch their own packages, departures and bookings (ownership is checked in the controllers).
- **Responses** use the shape `{ success, message, data }`. Errors use `{ success: false, message }`. In production, 5xx errors return a generic `"Internal Server Error"`.
- **Rate limit**: 300 requests per 15 minutes per IP in production, 1000 in development. The webhook is excluded. See section 11 for how this behaves on Vercel.

### Endpoints

All paths below are relative to `/api`. "Roles" lists who can call an endpoint. `admin` can always call it as well, even when the table does not say so.

**Health**

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Liveness check. Reports `status`, `environment`, and whether Firebase, Stripe, Geoapify and OpenWeather are configured. Never shows secret values. This is the only `/api` route that still works when Firebase credentials are missing; every other route returns `503`. |

**Destinations** (`/destinations`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/destinations` | Public (+token) | List destinations (staff also see unpublished ones) |
| GET | `/destinations/featured` | Public | Featured destinations |
| GET | `/destinations/:id` | Public (+token) | One destination |
| POST | `/destinations` | coordinator, admin | Create |
| PUT / PATCH | `/destinations/:id` | coordinator, admin | Update |
| DELETE | `/destinations/:id` | coordinator, admin | Delete |

**Tour packages** (`/packages`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/packages` | Public (+token) | List packages |
| GET | `/packages/featured` | Public | Featured packages |
| GET | `/packages/:id` | Public (+token) | One package |
| POST | `/packages` | coordinator, admin, operator | Create (operators create their own) |
| PUT / PATCH | `/packages/:id` | coordinator, admin, operator | Update (allowlisted fields; pricing is recomputed on the server) |
| DELETE | `/packages/:id` | coordinator, admin, operator | Delete (operators: only their own) |
| PATCH | `/packages/:id/approve` | coordinator, admin | Approve and publish |
| PATCH | `/packages/:id/reject` | coordinator, admin | Reject |

**Departures** (`/departures`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/departures` | Public (+token) | List departures (the public sees open future ones; staff and operators see all) |
| GET | `/departures/:id` | Public (+token) | One departure |
| POST | `/departures` | coordinator, admin, operator | Create |
| PUT / PATCH | `/departures/:id` | coordinator, admin, operator | Update (allowlisted fields) |
| POST | `/departures/:id/cancel` | coordinator, admin, operator | Cancel the departure, refunding and releasing its bookings 5 at a time. Calling it again finishes any bookings that are still active. |

**Bookings** (`/bookings`, all routes need a signed-in user)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/bookings/checkout` | Any signed-in user | Reserve seats and create a Stripe Checkout session. The price is computed on the server. |
| GET | `/bookings/my-bookings` | Any signed-in user | The caller's own bookings |
| GET | `/bookings/:id` | Signed-in (owner, or coordinator/support/guide/admin; operators only for their own packages) | One booking |
| POST | `/bookings/:id/cancel` | Signed-in (owner; support/admin for any booking) | Cancel, with a refund if it was paid |
| POST | `/bookings/:id/request-reschedule` | Signed-in (owner, or support/coordinator/admin/operator; operators only for their own packages) | Ask to move to another departure |
| POST | `/bookings/:id/cancel-reschedule` | Signed-in (owner, or support/coordinator/admin/operator; operators only for their own packages) | Withdraw a reschedule request |
| GET | `/bookings` | support, admin, coordinator, operator | List all bookings (operators: only their own) |
| PATCH | `/bookings/:id` | support, admin, coordinator, operator | Update status or notes (allowlisted; `paymentStatus` can be changed only by support or admin) |
| POST | `/bookings/:id/approve-reschedule` | support, admin, coordinator, operator | Approve a reschedule |
| POST | `/bookings/:id/reject-reschedule` | support, admin, coordinator, operator | Reject a reschedule |
| POST | `/bookings/:id/exception-refund` | support, admin | Manual exception refund through Stripe |

**Customers** (`/customers`, all routes need a signed-in user)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/customers/profile` | Signed-in | Own profile |
| POST | `/customers/sync-profile` | Signed-in | Create or refresh the `users/{uid}` document after sign-in. Keeps the existing role and status. |
| PUT / PATCH | `/customers/profile` | Signed-in | Update own profile |
| POST | `/customers/deactivate` | Signed-in | Deactivate own account |
| GET | `/customers/co-travelers` | Signed-in | List saved co-travelers |
| POST | `/customers/co-travelers` | Signed-in | Add a co-traveler |
| PUT / PATCH | `/customers/co-travelers/:id` | Signed-in | Update a co-traveler |
| DELETE | `/customers/co-travelers/:id` | Signed-in | Remove a co-traveler |
| GET | `/customers/notifications` | Signed-in | Own notifications |
| PATCH | `/customers/notifications/:id/read` | Signed-in | Mark a notification as read |

**Guide operations** (`/guide`, every route needs the role guide, admin or operator)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/guide/departures` | guide, admin, operator | Assigned departures, with weather |
| GET | `/guide/departures/:id/manifest` | guide, admin, operator | Passenger manifest |
| PATCH | `/guide/departures/:id/checkin` | guide, admin, operator | Check a passenger in (assigned guide, owning operator or admin only) |
| POST | `/guide/departures/:id/complete` | guide, admin, operator | Mark the departure completed |

**Admin** (`/admin`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/admin/profile` | admin, coordinator, support, guide, operator | Own staff profile |
| PATCH | `/admin/profile` | admin, coordinator, support, guide, operator | Update own staff profile |
| GET | `/admin/guides` | admin, coordinator, operator | Guides available for assignment (uid and name only) |
| GET | `/admin/dashboard` | admin | Dashboard metrics |
| GET | `/admin/users` | admin | List users (filter by `role`, `status`, search) |
| POST | `/admin/users` | admin | Create a staff account |
| PATCH | `/admin/users/:uid/status` | admin | Activate or deactivate a user |
| PATCH | `/admin/users/:uid/role` | admin | Change a user's role |
| GET | `/admin/reports` | admin | Reports (`startDate`, `endDate`, `format=csv` for a CSV export with escaped cells) |
| GET | `/admin/activity-logs` | admin | Audit log |

**Operators** (`/operators`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/operators/apply` | Public (+token) | Submit an operator application |
| GET | `/operators/my-application` | Signed-in | Status of your own application |
| GET | `/operators/dashboard` | operator, admin | Operator dashboard metrics |
| GET | `/operators/admin/applications` | admin | List applications |
| PATCH | `/operators/admin/applications/:id/approve` | admin | Approve (refuses accounts that already hold a staff role) |
| PATCH | `/operators/admin/applications/:id/reject` | admin | Reject |
| GET | `/operators/admin/all` | admin | List operators |
| PATCH | `/operators/admin/:uid/status` | admin | Activate or suspend an operator |

**Reviews** (`/reviews`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/reviews/package/:packageId` | Public | Approved reviews for a package |
| POST | `/reviews` | Signed-in | Submit a review (needs a completed booking) |
| GET | `/reviews/my-reviews` | Signed-in | Own reviews |
| GET | `/reviews/admin` | admin, coordinator, support, guide, operator | All reviews, for moderation |
| PATCH | `/reviews/:id/moderate` | admin, support | Approve or hide a review |
| DELETE | `/reviews/:id` | admin | Delete a review |

**Promotions** (`/promotions`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/promotions` | Public | Published, active promo banners |
| GET | `/promotions/admin/all` | admin, coordinator, support | All campaigns, including drafts |
| POST | `/promotions/admin` | admin, coordinator | Create a campaign |
| PUT | `/promotions/admin/:id` | admin, coordinator | Update a campaign |
| PATCH | `/promotions/admin/:id/toggle` | admin, coordinator | Publish or unpublish |
| DELETE | `/promotions/admin/:id` | admin | Delete a campaign |

**External proxies** (`/external`, public, so the API keys stay on the server)

| Method | Path | Query | Purpose |
|---|---|---|---|
| GET | `/external/location/autocomplete` | `query` | Geoapify place autocomplete |
| GET | `/external/location/geocode` | `address` | Geoapify geocoding |
| GET | `/external/weather/current` | `lat`, `lng` | OpenWeather current weather |
| GET | `/external/weather/forecast` | `lat`, `lng` | OpenWeather forecast |

**Webhooks** (`/webhooks`)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/webhooks/stripe` | Stripe only (signature verified) | Payment events. The raw body is kept for signature checks. Not rate limited. On Vercel an unsigned or unverifiable request is **always** rejected with `401`, and a bad signature returns `400`. |

---

## 4. Step-by-step deployment

Deploy in this order: **backend, then admin, then customer, then wire up CORS.** Each frontend needs the backend URL, the customer site needs the admin URL (`VITE_ADMIN_URL`), and the backend needs both frontend URLs.

**Step 0. Use the projects that already exist.** This repo is already linked to three Vercel projects named `backend`, `frontend-customer` and `frontend-admin` (see each folder's git-ignored `.vercel/project.json`; the `VERCEL_PROJECT_ID_*` GitHub secrets point at them). If you see them in the Vercel dashboard, **open them and edit their Settings instead of creating new projects**, and use their real `*.vercel.app` URLs wherever this guide says `<backend-project>`, `<customer-project>` or `<admin-project>`. Create new projects only if they do not exist: duplicates get different URLs, and the GitHub workflows would keep deploying to the old ones.

**Choose a deploy method** (section 7 explains both). In **both** methods each project's **Root Directory** is set to its folder (`backend`, `frontend-customer`, `frontend-admin`), under Settings > Build and Deployment > Root Directory.

- **Method A, Vercel Git integration (simplest, recommended for beginners).** Vercel builds on every push. **Before your first push, delete `.github/workflows/deploy-backend.yml`, `deploy-customer.yml` and `deploy-admin.yml`, or disable them (GitHub > Actions > the workflow > ... > Disable workflow).** Keep `ci.yml`. Otherwise every push deploys twice, and the Actions deploys need secrets you may not have set.
- **Method B, the repo's GitHub Actions workflows (`deploy-*.yml`).** The workflows run `vercel pull`, `vercel build` and `vercel deploy` from the **repo root**, and the CLI applies the project's Root Directory. Turn off the Git integration (section 7).

The steps below are the same for both methods.

### 4.1 Backend project

1. Open the existing `backend` project (step 0). Only if it does not exist: **Add New... > Project** > import the Lakbay repository and name it `backend`.
2. **Root Directory**: `backend`.
3. **Framework Preset**: **Other**. Leave the Build and Output settings at their defaults. `backend/vercel.json` already sets the install command, the empty `public` output, the function, the region and the rewrite.
4. Open **Environment Variables** and add the variables below. Tick **Production** and **Preview** for each. Choose Type **Secret** for secret values (Stripe keys, Firebase service account, API keys) and **Config** for URLs and flags (older dashboards called Secret "Sensitive"). Secret values are write-only: they cannot be read back, and `vercel env pull` does not return them.
5. Click **Deploy** (or **Redeploy** for an existing project).

**Backend environment variables**

| Name | Required? | Secret? | Example placeholder | Where to get it / notes |
|---|---|---|---|---|
| `NODE_ENV` | Yes | No | `production` | Type it in. Turns on the production rate limit and generic 5xx messages, and removes localhost from CORS. As a safety net the backend also treats any Vercel deployment (`VERCEL=1`) as production for these checks. |
| `CLIENT_URL` | Yes | No | `https://<customer-project>.vercel.app` | The customer site URL with **no trailing slash**. Used for CORS **and** the Stripe success and cancel redirects. If you list several, separated by commas, the **first** one is used for Stripe redirects. If this is missing in production, checkout returns 500. Use a placeholder on the first deploy and fix it in 4.4. |
| `ADMIN_URL` | Yes | No | `https://<admin-project>.vercel.app` | The admin portal URL (comma-separated if you have several). Used for CORS. |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Yes, **one** of the 3 Firebase options | **Yes** | `eyJ0eXBlIjoi...` | **Option 1 (easiest).** Base64 of the service-account JSON file. See 5.2. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | (option 2) | **Yes** | `{"type":"service_account",...}` | The raw JSON text pasted as one value. |
| `FIREBASE_PROJECT_ID` | (option 3) | No | `<firebase-project-id>` | From the JSON field `project_id`. |
| `FIREBASE_CLIENT_EMAIL` | (option 3) | Yes | `firebase-adminsdk-xxxx@<id>.iam.gserviceaccount.com` | From the JSON field `client_email`. |
| `FIREBASE_PRIVATE_KEY` | (option 3) | **Yes** | `-----BEGIN PRIVATE KEY-----\n...` | From the JSON field `private_key`. Real line breaks, literal `\n`, and surrounding quotes are all accepted. |
| `FIREBASE_STORAGE_BUCKET` | Recommended | No | `<id>.firebasestorage.app` | Newer projects (default buckets created from late 2024) use `.firebasestorage.app`; older ones use `.appspot.com`. Always copy the exact bucket name from Firebase console > Storage. If unset, the default is `<id>.appspot.com`. The backend does not currently read or write Storage. |
| `STRIPE_SECRET_KEY` | Yes | **Yes** | `sk_test_...` | Stripe > Developers > API keys. Use `sk_test_` for Preview and testing, `sk_live_` only for a real launch (on Vercel Pro, see section 2). |
| `STRIPE_WEBHOOK_SECRET` | Yes (add after 5.1) | **Yes** | `whsec_...` | Leave it unset on the first deploy: it only exists after you create the endpoint in 5.1, which needs the deployed URL. Until it is set the webhook returns `401`. Add it, then redeploy. |
| `STRIPE_CURRENCY` | No | No | `php` | Defaults to `php`. |
| `GEOAPIFY_API_KEY` | Yes (for location search) | Yes | `<geoapify-key>` | Geoapify dashboard |
| `OPENWEATHER_API_KEY` | Yes (for weather) | Yes | `<openweather-key>` | OpenWeather > API keys. New keys can take a while to activate. |
| `NODEJS_HELPERS` | Recommended (defensive) | No | `0` | Set it for all environments. Turns off Vercel's built-in request helpers so only Express reads the body. Vercel's body helper is lazy and `express.raw` on `/api/webhooks/stripe` already keeps the raw body Stripe needs, so this is a precaution, not the usual fix for signature errors. |
| `CORS_ORIGINS` | No | No | `https://www.example.com` | Extra allowed origins, comma-separated (custom domains and so on). |
| `CORS_VERCEL_PREVIEW_PROJECTS` | No | No | `frontend-customer,frontend-admin` | Opt-in: allow those projects' **preview** URLs. Works only together with the next variable. |
| `CORS_VERCEL_TEAM_SLUG` | No | No | `<team-slug>` | Your Vercel team or account slug, the last part of a preview URL `https://<project>-<hash>-<team-slug>.vercel.app`. |

**Do not set these on Vercel:**

- `PORT` and `HOST`. Vercel never calls `app.listen`.
- `FIREBASE_SERVICE_ACCOUNT_PATH`. The `serviceAccountKey.json` file is git-ignored and `.vercelignore`d, so it never exists on Vercel.
- `TRUST_PROXY`. It defaults to `1` on Vercel, which is correct.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_PHONE`. Only the local seed script reads them.
- `STRIPE_PUBLISHABLE_KEY` and `VITE_*`. Nothing in the backend reads them.

**Verify the backend:**

```bash
curl https://<backend-project>.vercel.app/api/health
```

You should see `"status":"healthy"` and `"environment":"production"`, with `integrations.firebase.initialized: true` and `integrations.stripe.initialized: true`. If `firebase.initialized` is `false`, every other route returns `503`. Check the Firebase variables (section 10).

Also confirm no source file is served statically: `curl -s https://<backend-project>.vercel.app/package.json` must return the Express `404 {"success":false,"message":"Route not found: ..."}` JSON, not the file.

### 4.2 Admin project

1. Open the existing `frontend-admin` project (step 0). Only if it does not exist: **Add New... > Project** > the same repository, named `frontend-admin`.
2. **Root Directory**: `frontend-admin`. **Framework Preset**: **Vite**.
3. Add these variables, then deploy.

| Name | Required? | Secret? | Example placeholder | Notes |
|---|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | No | `https://<backend-project>.vercel.app/api` | Must be absolute `https://` |
| `VITE_ENABLE_DEMO_LOGIN` | Yes | No | `false` | **Keep `false` in production.** `true` shows a button that fills in demo admin credentials. |
| `VITE_FIREBASE_API_KEY` ... `VITE_FIREBASE_APP_ID` | Yes | No | (same 6 values as the customer site) | Same Firebase web app config |

The admin app does not use `VITE_ADMIN_URL`.

### 4.3 Customer project

1. Open the existing `frontend-customer` project (step 0). Only if it does not exist: **Add New... > Project** > the same repository, named `frontend-customer`.
2. **Root Directory**: `frontend-customer`. **Framework Preset**: **Vite**. The build settings come from `vercel.json`.
3. Add the environment variables below for Production and Preview, then deploy.

| Name | Required? | Secret? | Example placeholder | Where to get it |
|---|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | No | `https://<backend-project>.vercel.app/api` | Your backend URL plus `/api`, with no trailing slash. **Must** start with `https://`, or the build fails. |
| `VITE_ADMIN_URL` | Yes | No | `https://<admin-project>.vercel.app` | Used by the "Become an Operator" page link. The admin project from 4.2 already exists, so use its real URL. (The build only checks that the value is non-empty.) |
| `VITE_FIREBASE_API_KEY` | Yes | No (public) | `AIza...` | Firebase console > Project settings > Your apps > Web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | No | `<id>.firebaseapp.com` | same |
| `VITE_FIREBASE_PROJECT_ID` | Yes | No | `<id>` | same |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | No | `<id>.firebasestorage.app` | same; use exactly what Firebase shows |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | No | `123456789012` | same |
| `VITE_FIREBASE_APP_ID` | Yes | No | `1:123...:web:abc...` | same |

> Every `VITE_*` value is **baked into the JavaScript at build time** and can be read by anyone. Only public values belong here, never a secret. Changing one has no effect until you **redeploy**. The Vercel build stops with `[vercel] Missing build-time env vars: ...` if a required value is missing.

### 4.4 Wire up CORS and redeploy

Now that you know the real URLs:

1. **Backend** project > Settings > Environment Variables:
   - `CLIENT_URL=https://<customer-project>.vercel.app`
   - `ADMIN_URL=https://<admin-project>.vercel.app`
   - Use the scheme and host only, with no path and no trailing slash. If you add a custom domain later, list both, separated by commas, with the main one first in `CLIENT_URL`.
2. **Customer** project: confirm `VITE_ADMIN_URL` is the real admin URL.
3. Redeploy all three: Deployments > the latest one > **...** > **Redeploy**. Environment variable changes apply only to new deployments.
4. In the browser, open the customer site, open DevTools > Network, and check that the API calls return 200 with no CORS error in the console.

**Preview deployments.** By default a frontend preview URL is **blocked by CORS**, because the allowlist is strict on purpose. To allow previews, set `CORS_VERCEL_PREVIEW_PROJECTS` and `CORS_VERCEL_TEAM_SLUG` on the backend, which only matches `https://<project>-<hash>-<team>.vercel.app`. Note that previews then call the **production** backend unless you also point their `VITE_API_BASE_URL` (Preview scope) somewhere else. Never allow every `*.vercel.app` URL: anyone can deploy there.

---

## 5. Integrations

### 5.1 Stripe

1. Stripe Dashboard (**test mode / sandbox** first) > **Workbench > Webhooks** tab (https://dashboard.stripe.com/webhooks) > **Create an event destination** > **Your account**. When asked for the payload format choose **Snapshot**, **not** Thin (Thin is preselected as "recommended").

   > **Warning:** `webhookController.js` reads snapshot payloads (`event.data.object`). Thin events are not supported: with Thin selected, payments never confirm and bookings stay Pending.
2. **Events**: select exactly the four events the code handles (`webhookController.js`), then **Continue**:
   - `checkout.session.completed` confirms the booking and marks it Paid when `payment_status` is `paid`
   - `checkout.session.async_payment_succeeded` confirms delayed payment methods
   - `checkout.session.expired` releases the reserved seats
   - `checkout.session.async_payment_failed` releases the reserved seats
3. Destination type **Webhook endpoint** > **Endpoint URL**: `https://<backend-project>.vercel.app/api/webhooks/stripe`. Always use the **backend** domain directly. Create the destination.
4. Open the new endpoint, **reveal the Signing secret** (`whsec_...`), and set it as `STRIPE_WEBHOOK_SECRET` in the backend project. Then **redeploy the backend**.
5. **Test mode vs live mode**: every endpoint in every mode has its **own** signing secret. Use `sk_test_` plus the test endpoint's `whsec_` while testing. For a live launch (on Vercel Pro), create a separate live-mode endpoint and use `sk_live_` plus that endpoint's `whsec_`. Keep test keys in the Preview scope.
6. **Redirects** are built from the first `CLIENT_URL` entry:
   - success: `<CLIENT_URL>/dashboard/bookings?session_id=...&ref=<bookingRef>&status=success`
   - cancel: `<CLIENT_URL>/packages/<packageId>?booking_ref=<bookingRef>&status=cancelled`

   Both are deep links, and the SPA rewrite in `frontend-customer/vercel.json` makes them load.
7. **Check delivery**: install the Stripe CLI, run `stripe login`, then `stripe trigger checkout.session.completed` (or run the same command in the Workbench **Shell**). A dashboard "Send test event" button may not exist in the current UI. Then look at Workbench > Webhooks > your endpoint > **Event deliveries**, and at Vercel > backend > **Logs**. Use **Resend** on a failed delivery to retry it:
   - `200` and the log line `[Stripe Webhook] Received event: ...` mean it works.
   - `400 Webhook Signature Error` usually means the wrong `whsec_` value or a test/live mismatch (for example the test secret against a live endpoint). Copy the secret from that exact endpoint and mode first. Only then suspect an altered body (`NODEJS_HELPERS=0` is a harmless extra precaution).
   - `401 Webhook signature verification is not configured` means `STRIPE_WEBHOOK_SECRET` is missing or a placeholder, or you sent a request without a signature (expected for a plain curl).

   A generic test event has no matching booking. It should still return 200, but it changes no data.

> Raw-body signature verification was tested locally, including a `VERCEL=1` simulation. **It has not yet been confirmed on a live Vercel deployment.** Do step 7 after your first deploy.

### 5.2 Firebase

**Service account to backend environment variables** (choose one):

- **Option 1, base64 (recommended, avoids newline problems).** Encode the JSON file locally (run these from the repo root), then paste the output into `FIREBASE_SERVICE_ACCOUNT_BASE64`. Do not save the output anywhere, and clear your terminal afterwards.
  - PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path "backend\serviceAccountKey.json"))) | Set-Clipboard`
  - macOS: `base64 -i backend/serviceAccountKey.json | pbcopy`
  - Linux / Git Bash: `base64 -w0 backend/serviceAccountKey.json` (then copy the output)
- **Option 2.** Paste the whole JSON text into `FIREBASE_SERVICE_ACCOUNT_JSON`.
- **Option 3.** Use three separate variables: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. For the private key, paste the `private_key` value **with or without** the surrounding quotes. Either real line breaks or literal `\n` works, because the backend normalizes both.

The backend tries them in this order: options 1 and 2, then a local `serviceAccountKey.json` (never present on Vercel), then option 3.

> **Security:** if a service-account key was ever committed, shared or pasted somewhere public, delete it in Google Cloud console > IAM > Service accounts > Keys and generate a new one. AGENTS.md lists this rotation as still outstanding for this repo.

**Authorized domains.** In Firebase console > Authentication > Settings > **Authorized domains**, add `<customer-project>.vercel.app`, `<admin-project>.vercel.app` and any custom domains. Email/password sign-in works without this. The customer password-reset email uses `window.location.origin/login` as its continue URL, and that URL must be on an authorized domain. If it is not, the code falls back to a reset email without a continue URL. Wildcards are not supported, so preview URLs cannot all be added. If your Firebase Web API key has HTTP-referrer restrictions (Google Cloud console > APIs & Services > Credentials), add the same domains there.

**Security rules.** Vercel does **not** deploy Firebase rules. Enable **Storage** in the Firebase console first (Storage > Get started): `--only storage` fails if the project has no default bucket. The repo has `firebase.json`, which points at `firestore.rules` and `storage.rules`, but no `.firebaserc`. From the repo root, run:

```bash
firebase login
firebase use --add                # pick your project; this creates .firebaserc (a project id, not a secret)
firebase deploy --only firestore:rules,storage
```

If you skip this, whatever rules are in the console stay active, possibly the default or test-mode rules. `storage.rules` checks the custom claim `token.role`, which the backend sets when it creates staff accounts or changes roles, and which `seed:admin` sets for the admin.

**Storage CORS.** **Not needed** today. The admin image upload uses the Firebase SDK (`uploadBytesResumable` and `getDownloadURL`), and images are shown with `<img>` tags. You would only need `gsutil cors set cors.json gs://<bucket>` with your site origins if code later downloads Storage files with `fetch`, `getBlob` or `getBytes`. This is based on Firebase's documented behaviour and has not been tested against the live bucket.

### 5.3 Geoapify and OpenWeather

- Set `GEOAPIFY_API_KEY` and `OPENWEATHER_API_KEY` on the **backend** only. The frontends reach them through `/api/external/*`, so the keys never reach the browser.
- `/api/health` shows `geoapify.configured` and `openWeather.configured`.
- Quick test:
  ```bash
  curl "https://<backend-project>.vercel.app/api/external/location/autocomplete?query=Boracay"
  curl "https://<backend-project>.vercel.app/api/external/weather/current?lat=11.97&lng=121.92"
  ```
- Upstream calls time out after 3 seconds. Results are cached in memory for about 15 to 20 minutes per function instance (see section 11).
- `VITE_GEOAPIFY_API_KEY` appears in the env templates, but no code reads it. Leave it unset.

---

## 6. Seeding the admin account and demo catalog (run locally)

The seed scripts are **never** run on Vercel; nothing in the build calls them. Run them once from your own computer, pointed at the **production** Firebase project.

1. Give the backend production credentials **locally**. The scripts read `backend/.env` through `dotenv` (a file from `vercel env pull` is not picked up automatically, and Secret values cannot be pulled anyway). The backend picks credentials in this order:
   1. `FIREBASE_SERVICE_ACCOUNT_BASE64` / `FIREBASE_SERVICE_ACCOUNT_JSON` in `backend/.env`;
   2. the file at `FIREBASE_SERVICE_ACCOUNT_PATH`, default `backend/serviceAccountKey.json` (git-ignored);
   3. `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`.

   **A `backend/serviceAccountKey.json` already exists locally, and it beats option 3.** Either replace that file with the production project's key, or put the production `FIREBASE_SERVICE_ACCOUNT_BASE64` in `backend/.env`. Do not rely on the three separate variables while the file is present, or you silently seed whichever project the file belongs to. Afterwards confirm the target: the output shows `[Firebase Admin] Initialized successfully using <source>`, and the admin user must appear in the **production** project's Firebase console > Authentication.
2. In `backend/.env`, set `ADMIN_EMAIL` and a **strong** `ADMIN_PASSWORD` (plus `ADMIN_NAME` and `ADMIN_PHONE` in E.164 format, for example `+63917...`). If `ADMIN_PASSWORD` is empty when the admin is first created, the script falls back to the public default `AdminPassword123`. Never let that happen on production.
3. Run:
   ```bash
   cd backend
   npm install
   npm run seed:admin                    # creates the admin (or updates an existing one; password changes only if ADMIN_PASSWORD is set)
   npm run seed:demo                     # OPTIONAL: sample destinations, packages and departures
   node src/scripts/seedMoreCatalog.js   # OPTIONAL: more catalog entries (skips names that already exist)
   ```
4. Remove `ADMIN_PASSWORD` from `backend/.env`, sign in to the admin portal, and change the password.

Notes:

- `seed:demo` and `seedMoreCatalog.js` write only catalog data (`destinations`, `tourPackages`, `departures`), not users. `seed:demo` has no production guard. Run it only if you want demo content in production. On a re-run it skips destinations and packages whose name already exists, and departures that already exist for the same package and date, so a second run should not create duplicates.
- Create other staff accounts (coordinator, support, guide) from the admin portal, which calls `POST /api/admin/users`. Operators come from approved applications.

---

## 7. CI/CD

### `ci.yml` (keep it either way)

This workflow runs on every push and pull request to `main`, using Node 22:

- runs `npm install` in all three apps (not `npm ci`, because the lockfiles were generated on Windows);
- runs `node --check` on every backend file and an import smoke test of `api/index.js`;
- builds both frontends with placeholder values.

It needs **no secrets**.

### Deploying: choose ONE method

| | **Method A: Vercel Git integration** (recommended) | **Method B: GitHub Actions `deploy-*.yml`** |
|---|---|---|
| How | Connect the repo in each Vercel project. Every push to `main` is a production deploy, and every PR gets a preview. | Each workflow runs `vercel pull`, then `vercel build --prod`, then `vercel deploy --prebuilt --prod`, using CLI `vercel@63.1.2`. |
| Root Directory | `backend` / `frontend-customer` / `frontend-admin` | The same. The workflows run the CLI from the repo root and the CLI applies the Root Directory. |
| Where env vars live | Vercel Project Settings | Vercel Project Settings (`vercel pull` downloads them); the VITE values are **not** taken from GitHub secrets |
| GitHub secrets needed | None | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_BACKEND`, `VERCEL_PROJECT_ID_CUSTOMER`, `VERCEL_PROJECT_ID_ADMIN` |
| What to disable | Delete or disable the three `deploy-*.yml` files (GitHub > Actions > the workflow > ... > Disable workflow) | In each Vercel project, Settings > Git: disconnect the repository, or add `"git": { "deploymentEnabled": false }` to that app's `vercel.json` |
| Only changed apps rebuild? | No, every connected project builds on every push. In Settings > **Build and Deployment** (older UI: Git) > **Ignored Build Step**, pick the built-in "Only build if there are changes in a folder", or a custom command such as `git diff --quiet HEAD^ HEAD -- .` (it compares only the last commit, so a multi-commit push whose last commit does not touch the folder is skipped). Ignored builds still count toward deployment quotas. | Yes, each workflow has a `paths:` filter |

**Getting the Method B secrets:**

- `VERCEL_TOKEN`: Vercel > Account Settings > Tokens.
- `VERCEL_ORG_ID`: the `orgId` in any folder's git-ignored `.vercel/project.json` (created by `vercel link`), or Team Settings > General > Team ID (for a personal account, your account ID).
- `VERCEL_PROJECT_ID_BACKEND` / `_CUSTOMER` / `_ADMIN`: the `projectId` in each folder's `.vercel/project.json`, or Project Settings > General > Project ID.

**Do not** add Stripe, Firebase, admin or `VITE_*` values to GitHub secrets. No workflow reads them.

> Running both methods at once deploys every push twice. This guide could not confirm whether the Git integration is currently connected to your projects; check each project's Settings > Git.

---

## 8. Custom domains (optional)

1. In the Vercel project, go to Settings > **Domains** > add a domain, for example `lakbay.example.com` for the customer site, `admin.lakbay.example.com` for the admin portal, and `api.lakbay.example.com` for the backend. Then add the DNS records Vercel shows you at your registrar.
2. Update the environment variables and **redeploy**:
   - Backend: `CLIENT_URL=https://lakbay.example.com,https://<customer-project>.vercel.app`. The **first** entry is used for Stripe redirects. Set `ADMIN_URL` the same way.
   - Frontends: `VITE_API_BASE_URL=https://api.lakbay.example.com/api`. Customer site: `VITE_ADMIN_URL=https://admin.lakbay.example.com`.
3. Update the Stripe webhook endpoint URL if the API domain changed. Add the new domains to Firebase **Authorized domains**.

The old placeholder domains `api.lakbay.ph` and `admin.lakbay.ph` were removed from the config. Only use a domain you actually own and have attached in Vercel.

---

## 9. Post-deploy verification checklist

```bash
API=https://<backend-project>.vercel.app/api

# 1. Health: should show healthy, production, firebase + stripe initialized
curl -s $API/health

# 2. Public data: should return JSON (an empty list is fine before seeding)
curl -s "$API/packages"
curl -s "$API/destinations/featured"

# 3. Auth is enforced: should return 401
curl -s -o /dev/null -w "%{http_code}\n" $API/bookings/my-bookings

# 4. CORS: an allowed origin gets an access-control-allow-origin header back
curl -s -i -X OPTIONS $API/packages \
  -H "Origin: https://<customer-project>.vercel.app" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control-allow-origin

# 5. CORS: a random origin is rejected with 403
curl -s -o /dev/null -w "%{http_code}\n" $API/packages -H "Origin: https://evil.example.com"

# 6. No source files served: should print 404 (Express JSON, not the file)
curl -s -o /dev/null -w "%{http_code}\n" https://<backend-project>.vercel.app/package.json

# 7. Webhook fails closed: an unsigned request should return 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/webhooks/stripe \
  -H "Content-Type: application/json" -d '{}'
```

In the browser:

- [ ] Customer site: the home page loads, and **refreshing** `/packages/<id>` works (no Vercel 404).
- [ ] Sign up as a customer, sign out, and sign back in.
- [ ] Admin portal: log in as the seeded **admin**. The dashboard loads, and the demo-login button is **not** visible.
- [ ] Create a coordinator, support and guide account in the admin portal, and log in as each to check their menus. If you have one, test an **operator** account from an approved application.
- [ ] Make a test booking as the customer. Stripe Checkout opens; pay with card `4242 4242 4242 4242`, any future expiry date, any CVC and any postcode.
- [ ] You land on `/dashboard/bookings?...status=success`, and within a few seconds the booking shows **Confirmed / Paid**.
- [ ] In Stripe > Webhooks > your endpoint, the `checkout.session.completed` delivery shows **200**.
- [ ] Start a checkout and close it, or press back. The cancel URL loads the package page. Seats are released when the session expires; Stripe sends `checkout.session.expired`, by default 24 hours later.
- [ ] Cancel a paid test booking. It changes to **Refunded** only if the Stripe refund succeeds.
- [ ] Vercel > backend > **Logs** shows no `[Config] CLIENT_URL is not set` or `[Firebase Admin] Initialization failed` lines.

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| **404 NOT_FOUND** from Vercel when refreshing a page or opening a link | SPA fallback missing, or the wrong Root Directory or output directory | Confirm the app's `vercel.json` has the `/(.*) -> /index.html` rewrite and that the build output is `dist`. Redeploy. |
| Browser console: **"blocked by CORS policy"**, or the API returns **403 "CORS policy blocks access from origin"** | The origin is not in `CLIENT_URL`, `ADMIN_URL` or `CORS_ORIGINS`, or the value has a typo, `http` instead of `https`, or the wrong domain. It can also be a preview URL. | Set the exact origin on the backend and **redeploy the backend**. For previews, see 4.4. |
| Every API call returns **503 "Backend is not fully configured"** | Firebase Admin did not initialize | Check the Firebase variables, then look in backend Logs for `[Firebase Admin] Initialization failed: ...`. Base64 avoids most private-key formatting problems. |
| **401** on authenticated calls right after login | Token expired or revoked, a frontend and backend pointing at different Firebase projects, or a server clock issue | The frontends refresh the token once and then sign you out. Check that `VITE_FIREBASE_PROJECT_ID` matches the service account's `project_id`. |
| **403** "Access requires one of [...] role(s)" | The user's `users/{uid}.role` is wrong for that page | Change the role in the admin portal (`PATCH /api/admin/users/:uid/role`), or run `seed:admin` for the admin. |
| **Webhook 400 "Webhook Signature Error"** | Most often a wrong `whsec_` or a test/live mismatch; rarely an altered body | Copy the signing secret from **that** endpoint and mode, and redeploy. Do not send the webhook through a frontend domain. `NODEJS_HELPERS=0` is a harmless extra precaution. |
| **Webhook 401 "verification is not configured"** | `STRIPE_WEBHOOK_SECRET` missing or a placeholder, or the request was unsigned | Set the real `whsec_` and redeploy. A 401 for a plain curl is expected. |
| Paid in Stripe, but the booking stays **Pending** | The webhook is not delivered or is failing, or the destination uses **Thin** payloads | Check the endpoint's Event deliveries and the backend Logs, that the endpoint URL ends in `/api/webhooks/stripe`, and that the payload format is **Snapshot** (recreate the destination if it is Thin). Resend the event from Stripe. |
| Checkout returns **500** and the logs say `CLIENT_URL is not set` | `CLIENT_URL` missing on the backend | Set it and redeploy. |
| After payment, Stripe redirects to **localhost** | An old deployment from before `CLIENT_URL` was set | Redeploy the backend after setting `CLIENT_URL`. |
| Firebase error **auth/unauthorized-domain**, or **auth/unauthorized-continue-uri** | The Vercel domain is not authorized | Firebase > Authentication > Settings > Authorized domains: add it. |
| Firebase error **auth/operation-not-allowed** on sign-up or sign-in | The Email/Password provider is not enabled | Firebase > Authentication > Sign-in method > enable Email/Password. |
| Firebase error **auth/api-key-not-valid** | Wrong or missing `VITE_FIREBASE_*` values (or old dummy values in an old build) | Set the 6 values in the frontend project and redeploy. |
| Frontend build fails with **`[vercel] Missing build-time env vars`**, or **`VITE_API_BASE_URL must be the absolute backend URL`** | A required VITE variable is missing, or it is `/api` | Add the variable and use the full `https://<backend-project>.vercel.app/api` URL. |
| **FUNCTION_INVOCATION_TIMEOUT** / 504 | The request ran past `maxDuration` (60 s), for example a large departure cancellation or a slow upstream API | Cancel the departure again; it resumes where it stopped. Check the region matches Firestore. You can raise `maxDuration` in `backend/vercel.json` (with Fluid compute the Hobby limit is 300 s). |
| You changed an env var but **nothing changed** | Env vars apply only to new deployments, and VITE values are baked in at build time | Deployments > **Redeploy**. Clear the build cache if you are unsure. |
| A GitHub Actions deploy builds the repo root (no `package.json`, wrong app), or fails with **"path ... backend/backend does not exist"** | Root Directory empty, or the CLI run from inside the app folder | Set the project's Root Directory to the app folder, and keep the workflows' Vercel steps on `working-directory: .` (repo root). |
| **429 Too many requests** | The per-instance rate limit was hit | Wait 15 minutes. See section 11. |
| `https://<backend-project>.vercel.app/package.json` downloads the file | The backend's static output is not empty | Check `backend/vercel.json` still has `buildCommand: "mkdir -p public"` and `outputDirectory: "public"`, and that the project's Build settings do not override them. Redeploy. |
| Builds run twice for each push | Both the Git integration and the Actions workflows are active | Pick one method (section 7). |

Where to look: Vercel > project > **Deployments** > a deployment > **Build Logs**, and Vercel > project > **Logs** (runtime). Stripe > Workbench > Webhooks > your endpoint > **Event deliveries**.

---

## 11. Known limitations on Vercel

- **The rate limiter is per instance.** `express-rate-limit` keeps its counters in memory. Vercel runs several short-lived instances, so the 300 requests per 15 minutes limit applies to each instance separately and resets on a cold start. Treat it as best effort. For a real limit, add a **Vercel Firewall** rate-limit rule, or use a shared store such as Upstash Redis. On Hobby you get one rate-limit rule per project with a window of at most 10 minutes, so 300 per 15 minutes cannot be copied exactly: use, for example, 200 requests per 10 minutes per IP on paths starting with `/api`, excluding `/api/webhooks/stripe`. Firewall counters are per region. The client IP is reliable, because Vercel overwrites `X-Forwarded-For` and the backend trusts exactly one proxy hop.
- **Caches are per instance.** The weather and location caches are in-memory `Map`s. Cold starts mean more calls to Geoapify and OpenWeather, so watch your free-tier quotas.
- **No scheduled jobs.** No `crons` are configured. Expired checkouts release their seats through Stripe's `checkout.session.expired` webhook, not a timer. If you want a nightly cleanup, add a `crons` entry to `backend/vercel.json` (Hobby allows at most once a day, and schedules are in UTC) and an Express GET route that returns 401 unless `Authorization: Bearer ${CRON_SECRET}`. Keep that route idempotent. No such route exists yet.
- **Function duration.** Each request must finish within `maxDuration` (60 s). Long admin operations, such as cancelling a departure with many paid bookings, process bookings in groups of 5 and can be re-run to finish.
- **One function, cold starts.** The whole API is one function (`api/index.js`). The first request after a quiet period also pays for Firebase Admin and Stripe start-up, so expect it to be slower.
- **No static file serving from Express**, and no local disk writes. The backend does not rely on either.
- **The region is fixed** to `sin1`. Static frontend files are served from Vercel's global edge regardless of region.
- **Previews share production data.** A preview deployment talks to whatever backend its `VITE_API_BASE_URL` points to. Unless you create separate preview environment values, that is the production backend and the production Firestore.

---

### Things this guide could not confirm

- Your Firestore location, and so whether `sin1` is the closest region.
- Whether the Vercel Git integration is currently connected to your projects (Method A or B, section 7), and whether each project's Root Directory is currently set to its folder (required for both methods).
- That Stripe signature verification succeeds on a live Vercel deployment. It passed local tests; check it with section 5.1, step 7.
- Your Storage bucket name format (`.appspot.com` or `.firebasestorage.app`). Copy it from the Firebase console.

See also: `README.md` (local setup) and `AGENTS.md` (security rules that must not be broken).
