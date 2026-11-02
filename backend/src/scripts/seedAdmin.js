import 'dotenv/config';
import { auth, db, isFirebaseInitialized } from '../config/firebaseAdmin.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@lakbay.ph';
// Only apply an explicit ADMIN_PASSWORD from the environment; never clobber an
// existing admin's password with a hardcoded fallback on re-run.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;
const ADMIN_NAME = process.env.ADMIN_NAME || 'Lakbay Administrator';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+639171234567';
// Must match .env / docker-compose / README (single source of truth for new installs)
const DEFAULT_ADMIN_PASSWORD = 'AdminPassword123';

async function seedAdmin() {
  console.log('====================================================');
  console.log('   LAKBAY PLATFORM - INITIAL ADMIN ACCOUNT SEEDER   ');
  console.log('====================================================');

  if (!isFirebaseInitialized || !auth || !db) {
    console.error('❌ Error: Firebase Admin SDK is not initialized.');
    console.error('Please ensure serviceAccountKey.json is located in backend/ or valid FIREBASE_* environment variables are set.');
    process.exit(1);
  }

  try {
    console.log(`Checking for existing admin user: ${ADMIN_EMAIL}...`);

    let userRecord;
    let createdNewUser = false;
    try {
      userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
      console.log(`Found existing Firebase Auth user with UID: ${userRecord.uid}`);

      // Only reset the password when ADMIN_PASSWORD is explicitly provided
      // (never clobber an existing admin's password on a routine re-run).
      if (ADMIN_PASSWORD) {
        await auth.updateUser(userRecord.uid, {
          password: ADMIN_PASSWORD,
          displayName: ADMIN_NAME,
        });
        console.log('Updated Firebase Auth user profile and password (ADMIN_PASSWORD was set).');
      } else {
        await auth.updateUser(userRecord.uid, { displayName: ADMIN_NAME });
        console.log('Updated display name. Password left unchanged (set ADMIN_PASSWORD to reset).');
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.log('Admin user does not exist in Firebase Auth. Creating new user...');
        const initialPassword = ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
        userRecord = await auth.createUser({
          email: ADMIN_EMAIL,
          password: initialPassword,
          displayName: ADMIN_NAME,
          emailVerified: true,
        });
        createdNewUser = true;
        console.log(`Created new Firebase Auth user with UID: ${userRecord.uid}`);
      } else {
        throw err;
      }
    }

    // Assign custom user claim { role: 'admin' }
    console.log(`Setting custom user claims: { role: 'admin' } on UID: ${userRecord.uid}...`);
    await auth.setCustomUserClaims(userRecord.uid, { role: 'admin' });
    console.log('Custom claims updated successfully.');

    // Upsert Firestore user record
    const userRef = db.collection('users').doc(userRecord.uid);
    const existingDoc = await userRef.get();
    const now = new Date().toISOString();

    const userData = {
      uid: userRecord.uid,
      fullName: ADMIN_NAME,
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      emergencyContact: '',
      role: 'admin',
      accountStatus: 'active',
      updatedAt: now,
      createdAt: existingDoc.exists ? (existingDoc.data().createdAt || now) : now,
    };

    await userRef.set(userData, { merge: true });
    console.log('Firestore users collection profile synced successfully.');

    // Log the initial system seed activity
    await db.collection('activityLogs').add({
      actorUid: userRecord.uid,
      actorRole: 'system',
      action: 'SEED_INITIAL_ADMIN',
      targetType: 'user',
      targetId: userRecord.uid,
      metadata: {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
      },
      createdAt: now,
    });
    console.log('Activity log record created.');

    console.log('----------------------------------------------------');
    console.log('✅ Admin Account Provisioned Successfully!');
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    if (createdNewUser) {
      // Only surface credentials on first creation (local/dev bootstrap).
      console.log(`   Password: ${ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD}`);
      if (!ADMIN_PASSWORD) {
        console.log('   ⚠️  Default password in use — change ADMIN_PASSWORD before deploying.');
      }
    } else {
      console.log('   Password: (unchanged — set ADMIN_PASSWORD env var to reset)');
    }
    console.log(`   Role:     admin`);
    console.log(`   UID:      ${userRecord.uid}`);
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed admin user:', error);
    process.exit(1);
  }
}

seedAdmin();
