import { db, auth } from '../config/firebaseAdmin.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logActivity } from '../services/auditService.js';
import { todayInManila } from '../utils/dates.js';

const APPLICATIONS_COLLECTION = 'operatorApplications';

/**
 * 1. Public / Client: Submit an application to become a Tour Operator
 */
export const applyForOperator = async (req, res, next) => {
  try {
    const {
      agencyName,
      accreditationNumber,
      contactPerson,
      email,
      phone,
      officeAddress = '',
      description = '',
    } = req.body;

    if (!agencyName || !accreditationNumber || !contactPerson || !email || !phone) {
      return sendError(
        res,
        'agencyName, accreditationNumber, contactPerson, email, and phone are required.',
        400
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const applicantUid = req.user ? req.user.uid : null;

    // Check if an application is already pending
    let existingQuery = db.collection(APPLICATIONS_COLLECTION).where('email', '==', cleanEmail);
    const existingSnap = await existingQuery.get();

    const pendingApp = existingSnap.docs
      .map((d) => d.data())
      .find((d) => d.status === 'pending');

    if (pendingApp) {
      return sendError(
        res,
        'An application with this email address is already under review. Our team will contact you soon.',
        409
      );
    }

    const now = new Date().toISOString();
    const applicationData = {
      agencyName: agencyName.trim(),
      accreditationNumber: accreditationNumber.trim(),
      contactPerson: contactPerson.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      officeAddress: officeAddress.trim(),
      description: description.trim(),
      applicantUid,
      status: 'pending',
      reviewNotes: '',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection(APPLICATIONS_COLLECTION).add(applicationData);

    await logActivity({
      actorUid: applicantUid || 'guest',
      actorRole: req.user ? req.user.role : 'guest',
      action: 'SUBMIT_OPERATOR_APPLICATION',
      targetType: 'operator_application',
      targetId: docRef.id,
      metadata: { agencyName, cleanEmail, accreditationNumber },
    });

    return sendSuccess(
      res,
      { id: docRef.id, ...applicationData },
      'Your Tour Operator application has been received. Our team will review your credentials within 24-48 business hours.',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Client / Applicant: Check status of current user's operator application
 */
export const getMyApplication = async (req, res, next) => {
  try {
    const userEmail = req.user.email?.toLowerCase();
    const userUid = req.user.uid;

    let apps = [];

    // Query by applicantUid
    const uidSnap = await db
      .collection(APPLICATIONS_COLLECTION)
      .where('applicantUid', '==', userUid)
      .get();

    uidSnap.forEach((doc) => apps.push({ id: doc.id, ...doc.data() }));

    // Fallback to email query
    if (apps.length === 0 && userEmail) {
      const emailSnap = await db
        .collection(APPLICATIONS_COLLECTION)
        .where('email', '==', userEmail)
        .get();
      emailSnap.forEach((doc) => apps.push({ id: doc.id, ...doc.data() }));
    }

    if (apps.length === 0) {
      return sendSuccess(res, null, 'No operator application found for this account');
    }

    // Sort by latest createdAt
    apps.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return sendSuccess(res, apps[0]);
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Admin: List all Tour Operator applications with status filtering
 */
export const getOperatorApplications = async (req, res, next) => {
  try {
    const { status } = req.query; // 'all' | 'pending' | 'approved' | 'rejected'

    let query = db.collection(APPLICATIONS_COLLECTION);
    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    let applications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    applications.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return sendSuccess(res, applications);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Admin: Approve Operator Application & Provision/Upgrade Account
 */
export const approveOperatorApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const docRef = db.collection(APPLICATIONS_COLLECTION).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return sendError(res, 'Operator application not found', 404);
    }

    const appData = docSnap.data();
    if (appData.status === 'approved') {
      return sendError(res, 'This operator application has already been approved', 400);
    }

    const now = new Date().toISOString();
    let operatorUid = appData.applicantUid;

    // If applicant does not have a linked UID, try finding an existing user by email
    if (!operatorUid && auth) {
      try {
        const existingAuthUser = await auth.getUserByEmail(appData.email);
        operatorUid = existingAuthUser.uid;
      } catch (err) {
        // If user doesn't exist yet, create an account with temporary credentials
        if (err.code === 'auth/user-not-found') {
          const tempPassword = `Lakbay@${Math.floor(100000 + Math.random() * 900000)}`;
          const createdAuthUser = await auth.createUser({
            email: appData.email,
            password: tempPassword,
            displayName: appData.agencyName,
            phoneNumber: appData.phone || undefined,
            emailVerified: true,
          });
          operatorUid = createdAuthUser.uid;
        } else {
          throw err;
        }
      }
    }

    if (!operatorUid) {
      return sendError(res, 'Unable to identify or create user credentials for applicant', 500);
    }

    // ANTI-HIJACK: never let an application approval take over an existing
    // staff account (e.g. application filed with an admin/support email).
    const STAFF_ROLES = ['admin', 'support', 'coordinator'];
    const targetUserDoc = await db.collection('users').doc(operatorUid).get();
    const existingRole = targetUserDoc.exists ? targetUserDoc.data().role : null;
    if (STAFF_ROLES.includes(existingRole)) {
      return sendError(
        res,
        `Refused: the account for ${appData.email} already has the "${existingRole}" role. Staff accounts cannot be converted to operators.`,
        409
      );
    }
    if (auth && !targetUserDoc.exists) {
      try {
        const claims = (await auth.getUser(operatorUid)).customClaims || {};
        if (STAFF_ROLES.includes(claims.role)) {
          return sendError(res, `Refused: target account already has the "${claims.role}" role.`, 409);
        }
      } catch (claimErr) {
        // Non-fatal: proceed if claims cannot be read
        console.warn('[ApproveOperator] Could not read target claims:', claimErr.message);
      }
    }

    // 1. Assign custom claim 'operator' in Firebase Auth (only role claim is set;
    //    target was verified not to be staff above)
    if (auth) {
      await auth.setCustomUserClaims(operatorUid, { role: 'operator' });
      await auth.updateUser(operatorUid, { displayName: appData.agencyName });
    }

    // 2. Sync / update users collection document
    const userRef = db.collection('users').doc(operatorUid);
    const userDoc = targetUserDoc;

    const operatorUserData = {
      uid: operatorUid,
      fullName: appData.contactPerson,
      agencyName: appData.agencyName,
      accreditationNumber: appData.accreditationNumber,
      email: appData.email,
      phone: appData.phone,
      officeAddress: appData.officeAddress || '',
      role: 'operator',
      accountStatus: 'active',
      operatorApprovedAt: now,
      updatedAt: now,
    };

    if (userDoc.exists) {
      await userRef.update(operatorUserData);
    } else {
      operatorUserData.createdAt = now;
      await userRef.set(operatorUserData);
    }

    // 3. Mark application approved
    await docRef.update({
      status: 'approved',
      applicantUid: operatorUid,
      reviewedAt: now,
      reviewedBy: req.user.uid,
      updatedAt: now,
    });

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'APPROVE_OPERATOR_APPLICATION',
      targetType: 'operator_application',
      targetId: id,
      metadata: { agencyName: appData.agencyName, operatorUid },
    });

    return sendSuccess(
      res,
      { applicationId: id, operatorUid, agencyName: appData.agencyName, role: 'operator' },
      `Operator application approved. ${appData.agencyName} is now an active Tour Operator.`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Admin: Reject Operator Application
 */
export const rejectOperatorApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Application credentials could not be verified' } = req.body;

    const docRef = db.collection(APPLICATIONS_COLLECTION).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return sendError(res, 'Operator application not found', 404);
    }

    const now = new Date().toISOString();
    await docRef.update({
      status: 'rejected',
      reviewNotes: reason,
      reviewedAt: now,
      reviewedBy: req.user.uid,
      updatedAt: now,
    });

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'REJECT_OPERATOR_APPLICATION',
      targetType: 'operator_application',
      targetId: id,
      metadata: { reason },
    });

    return sendSuccess(res, { id, status: 'rejected' }, 'Operator application rejected');
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Admin: List all approved Operators
 */
export const getAllOperators = async (req, res, next) => {
  try {
    const snapshot = await db.collection('users').where('role', '==', 'operator').get();
    const operators = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));

    // Count packages per operator
    for (const op of operators) {
      const pkgSnap = await db
        .collection('tourPackages')
        .where('operatorId', '==', op.uid)
        .get();
      op.totalPackages = pkgSnap.size;
    }

    return sendSuccess(res, operators);
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Admin: Toggle Operator Account Status (Activate / Deactivate)
 */
export const setOperatorStatus = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { accountStatus } = req.body; // 'active' | 'deactivated'

    if (!['active', 'deactivated'].includes(accountStatus)) {
      return sendError(res, "accountStatus must be 'active' or 'deactivated'", 400);
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return sendError(res, 'Operator account not found', 404);
    }

    if (userDoc.data().role !== 'operator') {
      return sendError(res, 'Target user is not a tour operator', 400);
    }

    const isDisabled = accountStatus === 'deactivated';
    if (auth) {
      await auth.updateUser(uid, { disabled: isDisabled });
    }

    const now = new Date().toISOString();
    await userRef.update({
      accountStatus,
      updatedAt: now,
    });

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'SET_OPERATOR_STATUS',
      targetType: 'user',
      targetId: uid,
      metadata: { accountStatus },
    });

    return sendSuccess(res, { uid, accountStatus }, `Operator account status updated to ${accountStatus}`);
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Operator Dashboard Metrics
 * Scoped specifically to packages and bookings belonging to req.user.uid
 */
export const getOperatorDashboardMetrics = async (req, res, next) => {
  try {
    const operatorUid = req.user.uid;

    // 1. Fetch packages owned by operator
    const pkgSnap = await db
      .collection('tourPackages')
      .where('operatorId', '==', operatorUid)
      .get();

    const packages = pkgSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const packageIds = packages.map((p) => p.id);

    // Breakdown by approval status
    const approvalBreakdown = {
      approved: packages.filter((p) => p.approvalStatus === 'approved').length,
      pending: packages.filter((p) => p.approvalStatus === 'pending_approval').length,
      rejected: packages.filter((p) => p.approvalStatus === 'rejected').length,
      draft: packages.filter((p) => p.approvalStatus === 'draft' || !p.approvalStatus).length,
    };

    // 2. Fetch departures for these packages
    let activeDeparturesCount = 0;
    let totalBookedTravelers = 0;
    let totalRevenue = 0;
    let recentBookings = [];

    if (packageIds.length > 0) {
      const today = todayInManila();

      // Departures
      for (const pid of packageIds) {
        const depSnap = await db
          .collection('departures')
          .where('packageId', '==', pid)
          .get();

        depSnap.forEach((d) => {
          const dep = d.data();
          if (dep.status === 'open' && (dep.departureDate || '') >= today) {
            activeDeparturesCount++;
          }
        });
      }

      // Bookings: query bookings matching operator packages
      // Due to 'in' query limit of 10, batch if needed
      const batches = [];
      for (let i = 0; i < packageIds.length; i += 10) {
        const chunk = packageIds.slice(i, i + 10);
        batches.push(db.collection('bookings').where('packageId', 'in', chunk).get());
      }

      const bookingSnaps = await Promise.all(batches);
      const allBookings = [];
      bookingSnaps.forEach((snap) => {
        snap.forEach((doc) => allBookings.push({ id: doc.id, ...doc.data() }));
      });

      allBookings.forEach((b) => {
        if (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Completed') {
          totalBookedTravelers += Number(b.numberOfTravelers || 1);
          if (b.paymentStatus === 'Paid') {
            totalRevenue += Number(b.totalPrice || 0);
          }
        }
      });

      allBookings.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      recentBookings = allBookings.slice(0, 10);
    }

    return sendSuccess(res, {
      summary: {
        totalPackages: packages.length,
        approvalBreakdown,
        activeDeparturesCount,
        totalBookedTravelers,
        totalRevenue,
      },
      packages,
      recentBookings,
    });
  } catch (error) {
    next(error);
  }
};
