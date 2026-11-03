/**
 * Public URL / origin configuration shared by CORS (server.js) and the Stripe
 * checkout redirects (bookingController.js).
 *
 * - Values are trimmed and trailing slashes removed, because a browser Origin
 *   header never has one (https://x.vercel.app/ would never match).
 * - CLIENT_URL / ADMIN_URL / CORS_ORIGINS may be comma-separated lists
 *   (e.g. custom domain + *.vercel.app production URL). The FIRST CLIENT_URL
 *   entry is the canonical customer site used for Stripe redirects.
 * - Localhost dev origins are only added outside production.
 * - Vercel preview deployments are only allowed when explicitly enabled with
 *   CORS_VERCEL_PREVIEW_PROJECTS + CORS_VERCEL_TEAM_SLUG, and matched with a
 *   strict regex (never a bare *.vercel.app wildcard — anyone can deploy there).
 */

// Treat any Vercel deployment as production even if NODE_ENV was not set in the
// project settings, so localhost origins are never allowed there.
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');

export const parseOriginList = (value) =>
  String(value || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173', // Vite default dev port
  'http://localhost:5174',
];

const clientUrls = parseOriginList(process.env.CLIENT_URL);
const adminUrls = parseOriginList(process.env.ADMIN_URL);

export const allowedOrigins = Array.from(
  new Set([
    ...clientUrls,
    ...adminUrls,
    ...parseOriginList(process.env.CORS_ORIGINS),
    ...(isProduction ? [] : DEV_ORIGINS),
  ])
);

// Optional, opt-in Vercel preview support, e.g.
//   CORS_VERCEL_PREVIEW_PROJECTS=lakbay-customer,lakbay-admin
//   CORS_VERCEL_TEAM_SLUG=my-team
// allows https://lakbay-customer-<hash>-my-team.vercel.app (and git-branch URLs).
const previewProjects = String(process.env.CORS_VERCEL_PREVIEW_PROJECTS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter((s) => /^[a-z0-9-]+$/.test(s));
const teamSlug = String(process.env.CORS_VERCEL_TEAM_SLUG || '').trim().toLowerCase();

const previewOriginRegex =
  previewProjects.length > 0 && /^[a-z0-9-]+$/.test(teamSlug)
    ? new RegExp(
        `^https://(?:${previewProjects.map(escapeRegex).join('|')})-[a-z0-9-]+-${escapeRegex(teamSlug)}\\.vercel\\.app$`
      )
    : null;

export const isAllowedOrigin = (origin) => {
  const o = normalizeOrigin(origin);
  if (allowedOrigins.includes(o)) return true;
  return Boolean(previewOriginRegex && previewOriginRegex.test(o));
};

/**
 * Canonical customer-site base URL for Stripe success/cancel redirects.
 * Returns null in production when CLIENT_URL is not configured, so callers
 * can fail loudly instead of redirecting paying customers to localhost.
 */
export const getClientBaseUrl = () => {
  if (clientUrls.length > 0) return clientUrls[0];
  return isProduction ? null : 'http://localhost:3000';
};

if (isProduction && clientUrls.length === 0) {
  console.error('[Config] CLIENT_URL is not set in production: CORS will block the customer site and checkout is disabled.');
}
if (isProduction && adminUrls.length === 0) {
  console.error('[Config] ADMIN_URL is not set in production: CORS will block the admin portal.');
}
