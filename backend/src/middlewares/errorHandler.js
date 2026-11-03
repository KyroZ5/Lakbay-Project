import { sendError } from '../utils/apiResponse.js';

// Firestore/gRPC status codes that mean "the database is temporarily unavailable"
// (8 RESOURCE_EXHAUSTED = quota exceeded, 14 UNAVAILABLE, 4 DEADLINE_EXCEEDED).
const TRANSIENT_DB_CODES = new Set([8, 14, 4, 'resource-exhausted', 'unavailable', 'deadline-exceeded']);

export const errorHandler = (err, req, res, next) => {
  if (TRANSIENT_DB_CODES.has(err.code)) {
    console.error(`[DB Unavailable] ${req.method} ${req.originalUrl}:`, err.code, err.message);
    res.set('Retry-After', '60');
    return sendError(res, 'Service temporarily unavailable. Please try again shortly.', 503);
  }

  const statusCode = err.statusCode || err.status || 500;
  // Never leak raw internals (Firestore index URLs, Stripe errors) on 5xx in
  // production; 4xx httpError messages are intentional and pass through.
  const message =
    statusCode >= 500 && (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1')
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';

  // Log server errors for debugging
  if (statusCode >= 500) {
    console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err);
  }

  return sendError(
    res,
    message,
    statusCode,
    process.env.NODE_ENV === 'development' ? err.stack : undefined
  );
};
