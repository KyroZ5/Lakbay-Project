import { auth, db, isFirebaseInitialized } from '../config/firebaseAdmin.js';
import { sendError } from '../utils/apiResponse.js';

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication token missing or invalid format (Bearer token required)', 401);
    }

    if (!isFirebaseInitialized || !auth) {
      return sendError(
        res,
        'Authentication service is temporarily unavailable (Firebase Admin not initialized)',
        503
      );
    }

    const token = authHeader.split('Bearer ')[1].trim();
    if (!token) {
      return sendError(res, 'Authentication token missing', 401);
    }

    // Verify token using Firebase Admin SDK
    const decodedToken = await auth.verifyIdToken(token);

    // Look up user document in Firestore to check account status & role
    let role = decodedToken.role || 'customer';
    let accountStatus = 'active';
    let fullName = decodedToken.name || '';

    if (db) {
      let userDoc;
      try {
        userDoc = await db.collection('users').doc(decodedToken.uid).get();
      } catch (dbError) {
        // The TOKEN is valid — a database outage (quota exhausted, network) must not look like an
        // auth failure, or clients treat it as session expiry and sign the user out.
        console.error('[Auth] User profile lookup failed:', dbError.code || dbError.message);
        return sendError(res, 'Service temporarily unavailable. Please try again shortly.', 503);
      }
      if (userDoc.exists) {
        const userData = userDoc.data();
        role = userData.role || role;
        accountStatus = userData.accountStatus || 'active';
        fullName = userData.fullName || fullName;
      }
    }

    if (accountStatus === 'deactivated' || accountStatus === 'disabled') {
      return sendError(res, 'Your account has been deactivated. Please contact support.', 403);
    }

    // Attach user information to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      fullName,
      role,
      accountStatus,
      tokenClaims: decodedToken,
    };

    next();
  } catch (error) {
    // Map Firebase Auth error codes to clean 401s — never leak raw internals.
    switch (error.code) {
      case 'auth/id-token-expired':
        return sendError(res, 'Session expired. Please log in again.', 401);
      case 'auth/id-token-revoked':
      case 'auth/user-disabled':
        return sendError(res, 'This session is no longer valid. Please log in again.', 401);
      case 'auth/argument-error':
        return sendError(res, 'Malformed authentication token.', 401);
      default:
        console.warn('[Auth] Token verification failed:', error.code || error.message);
        return sendError(res, 'Invalid authentication token.', 401);
    }
  }
};

/**
 * Optional Authentication Middleware
 * If a valid Bearer token is provided, attaches req.user.
 * If no token or an invalid token is provided, passes through as guest without failing.
 */
export const optionalToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    if (!isFirebaseInitialized || !auth) {
      return next();
    }

    const token = authHeader.split('Bearer ')[1].trim();
    if (!token) {
      return next();
    }

    // Attempt token verification
    const decodedToken = await auth.verifyIdToken(token);

    let role = decodedToken.role || 'customer';
    let accountStatus = 'active';
    let fullName = decodedToken.name || '';

    if (db) {
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        role = userData.role || role;
        accountStatus = userData.accountStatus || 'active';
        fullName = userData.fullName || fullName;
      }
    }

    if (accountStatus !== 'deactivated' && accountStatus !== 'disabled') {
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        fullName,
        role,
        accountStatus,
        tokenClaims: decodedToken,
      };
    }

    next();
  } catch (error) {
    // Fail gracefully for optional auth - continue as unauthenticated guest
    next();
  }
};

