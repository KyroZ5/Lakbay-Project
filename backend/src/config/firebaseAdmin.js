import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

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
    // 1. Check for service account file
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
    const resolvedPath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.resolve(process.cwd(), serviceAccountPath);

    if (fs.existsSync(resolvedPath)) {
      const serviceAccountRaw = fs.readFileSync(resolvedPath, 'utf8');
      const serviceAccount = JSON.parse(serviceAccountRaw);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`,
      });

      auth = admin.auth();
      db = admin.firestore();
      storage = admin.storage();
      isFirebaseInitialized = true;
      console.log(`[Firebase Admin] Initialized successfully using ${path.basename(resolvedPath)}`);
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      // 2. Check for inline environment variables
      const formattedPrivateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: formattedPrivateKey,
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
      });

      auth = admin.auth();
      db = admin.firestore();
      storage = admin.storage();
      isFirebaseInitialized = true;
      console.log('[Firebase Admin] Initialized successfully using environment variables.');
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
