import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * Accept a PEM private key pasted in any common form: real newlines, literal
 * "\\n" escapes, or wrapped in quotes (as copied from a .env file).
 */
const normalizePrivateKey = (raw) => {
  let key = String(raw).trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
};

let isFirebaseInitialized = false;
let auth = null;
let db = null;
let storage = null;

try {
  // Check if admin is already initialized
  if (admin.apps.length > 0) {
    auth = admin.auth();
    db = admin.firestore();
    storage = admin.storage();
    isFirebaseInitialized = true;
  } else {
    const initWith = (credentialInput, projectId, source) => {
      admin.initializeApp({
        credential: admin.credential.cert(credentialInput),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
      });
      auth = admin.auth();
      db = admin.firestore();
      storage = admin.storage();
      isFirebaseInitialized = true;
      console.log(`[Firebase Admin] Initialized successfully using ${source}.`);
    };

    // 0. Whole service-account JSON in one env var (handy on Vercel):
    //    FIREBASE_SERVICE_ACCOUNT_BASE64 (base64 of the JSON file) or
    //    FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON text).
    const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
      ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64.trim(), 'base64').toString('utf8')
      : process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    // 1. Service account file (local dev / Docker; never present on Vercel)
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
    const resolvedPath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.resolve(process.cwd(), serviceAccountPath);

    if (inlineJson) {
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(inlineJson);
      } catch {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64/FIREBASE_SERVICE_ACCOUNT_JSON is not valid service-account JSON');
      }
      if (typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = normalizePrivateKey(serviceAccount.private_key);
      }
      initWith(serviceAccount, serviceAccount.project_id, 'inline service-account JSON env var');
    } else if (fs.existsSync(resolvedPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      initWith(serviceAccount, serviceAccount.project_id, path.basename(resolvedPath));
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      // 2. Individual inline environment variables
      initWith(
        {
          projectId: process.env.FIREBASE_PROJECT_ID.trim(),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
          privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
        },
        process.env.FIREBASE_PROJECT_ID.trim(),
        'environment variables'
      );
    } else {
      console.warn(
        `[Firebase Admin] Notice: No serviceAccountKey.json found at "${resolvedPath}" and FIREBASE_* environment variables are unset. Waiting for credentials.`
      );
    }
  }
} catch (error) {
  console.error('[Firebase Admin] Initialization failed:', error.message);
  isFirebaseInitialized = false;
}

export { admin, auth, db, storage, isFirebaseInitialized };
