// Helpers for the `?redirect=` param carried through login / register / forgot-password.

/**
 * Returns the `redirect` query value only when it is a same-origin app path.
 * Rejects absolute and protocol-relative URLs (`https://…`, `//evil.com`) to prevent open redirects.
 */
export const getSafeRedirect = (search, fallback = '/dashboard') => {
  const value = new URLSearchParams(search).get('redirect');
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
};

/** Appends `?redirect=` to an auth link when a non-default redirect is in play. */
export const withRedirect = (path, redirect, fallback = '/dashboard') =>
  redirect && redirect !== fallback ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;
