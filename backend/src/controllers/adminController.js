import { db, auth } from '../config/firebaseAdmin.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logActivity } from '../services/auditService.js';
import { todayInManila } from '../utils/dates.js';
import { parseLimit } from '../utils/query.js';

/**
 * 1. Admin Business Dashboard Metrics
 * Calculates totals, status breakdowns, and revenue excluding cancelled/unpaid/refunded
 */
export const getDashboardMetrics = async (req, res, next) => {
  try {
    const today = todayInManila();

    // 1. Counts via aggregation queries (avoid downloading whole collections).
    // Departures/bookings use field projections (.select) so only the fields the
    // metrics need are transferred — keeps the serverless function fast and lean
    // without requiring new composite indexes.
    const [custCount, destCount, pkgCount, depSnap, bookSnap] = await Promise.all([
      db.collection('users').where('role', '==', 'customer').count().get(),
      db.collection('destinations').count().get(),
      db.collection('tourPackages').count().get(),
      db.collection('departures').where('departureDate', '>=', today).select('departureDate', 'status').get(),
      db
        .collection('bookings')
        .select('bookingStatus', 'paymentStatus', 'totalPrice', 'createdAt', 'packageName', 'numberOfTravelers')
        .get(),
    ]);

    const totalCustomers = custCount.data().count;
    const totalDestinations = destCount.data().count;
    const totalPackages = pkgCount.data().count;
    const totalBookings = bookSnap.size;

    let pendingBookings = 0;
    let confirmedBookings = 0;
    let cancelledBookings = 0;
    let completedBookings = 0;
    let collectedRevenue = 0; // Excludes cancelled and unpaid bookings

    const monthlyBookings = {};
    const monthlyRevenue = {};
    const packagePopularity = {};

    let upcomingDeparturesCount = 0;

    depSnap.forEach((doc) => {
      const dep = doc.data();
      if (dep.departureDate >= today && dep.status === 'open') {
        upcomingDeparturesCount++;
      }
    });

    bookSnap.forEach((doc) => {
      const b = doc.data();

      // Status counters
      if (b.bookingStatus === 'Pending') pendingBookings++;
      else if (b.bookingStatus === 'Confirmed') confirmedBookings++;
      else if (b.bookingStatus === 'Cancelled') cancelledBookings++;
      else if (b.bookingStatus === 'Completed') completedBookings++;

      // Revenue: only count Paid bookings that are Confirmed or Completed
      if (b.paymentStatus === 'Paid' && (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Completed')) {
        collectedRevenue += Number(b.totalPrice || 0);

        // Monthly revenue aggregation
        const monthKey = (b.createdAt || '').substring(0, 7) || 'Unknown';
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + Number(b.totalPrice || 0);
      }

      // Monthly bookings
      const monthKey = (b.createdAt || '').substring(0, 7) || 'Unknown';
      monthlyBookings[monthKey] = (monthlyBookings[monthKey] || 0) + 1;

      // Package popularity
      if (b.packageName) {
        packagePopularity[b.packageName] = (packagePopularity[b.packageName] || 0) + (b.numberOfTravelers || 1);
      }
    });

    // Format top packages
    const topPackages = Object.entries(packagePopularity)
      .map(([name, travelers]) => ({ name, travelers }))
      .sort((a, b) => b.travelers - a.travelers)
      .slice(0, 5);

    // Format monthly trend data
    const monthlyTrend = Object.keys(monthlyBookings)
      .sort()
      .map((month) => ({
        month,
        bookings: monthlyBookings[month] || 0,
        revenue: monthlyRevenue[month] || 0,
      }));

    return sendSuccess(res, {
      summary: {
        totalCustomers,
        totalDestinations,
        totalPackages,
        totalBookings,
        pendingBookings,
        confirmedBookings,
        cancelledBookings,
        completedBookings,
        upcomingDeparturesCount,
        collectedRevenue,
      },
      charts: {
        monthlyTrend,
        bookingStatusBreakdown: [
          { status: 'Confirmed', count: confirmedBookings },
          { status: 'Pending', count: pendingBookings },
          { status: 'Completed', count: completedBookings },
          { status: 'Cancelled', count: cancelledBookings },
        ],
        topPackages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get Users (Staff & Customers) with filtering
 */
export const getUsers = async (req, res, next) => {
  try {
    const { role, status, search, limit = 50 } = req.query;

    let query = db.collection('users');

    if (role) {
      query = query.where('role', '==', role);
    }
    if (status) {
      query = query.where('accountStatus', '==', status);
    }

    // Search is in-memory, so only limit the Firestore query when not searching;
    // otherwise matches beyond the first page were silently missed.
    const hasSearch = typeof search === 'string' && search.trim();
    const pageSize = parseLimit(limit);
    const snapshot = await (hasSearch ? query.get() : query.limit(pageSize).get());
    let users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (hasSearch) {
      const term = search.trim().toLowerCase();
      users = users.filter(
        (u) =>
          u.fullName?.toLowerCase().includes(term) ||
          u.email?.toLowerCase().includes(term) ||
          u.phone?.toLowerCase().includes(term)
      );
      users = users.slice(0, pageSize);
    }

    return sendSuccess(res, users, `Retrieved ${users.length} user(s)`);
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Create Staff Account (Admin only)
 * Creates Firebase Auth user, sets custom claim { role }, and syncs Firestore users collection
 */
export const createStaffAccount = async (req, res, next) => {
  try {
    const { email, password, fullName, phone = '', role = 'support' } = req.body;

    const validRoles = ['coordinator', 'support', 'guide', 'admin'];
    if (!validRoles.includes(role)) {
      return sendError(res, `Invalid role. Allowed staff roles: ${validRoles.join(', ')}`, 400);
    }

    if (typeof email !== 'string' || typeof password !== 'string' || typeof fullName !== 'string' ||
        !email.trim() || !password || !fullName.trim()) {
      return sendError(res, 'Email, password, and fullName are required', 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return sendError(res, 'A valid email address is required', 400);
    }
    if (password.length < 6) {
      return sendError(res, 'Password must be at least 6 characters', 400);
    }
    const phoneStr = typeof phone === 'string' ? phone.trim() : '';

    if (!auth) {
      return sendError(res, 'Firebase Auth is unavailable', 503);
    }

    // 1. Create in Firebase Auth. Firebase only accepts E.164 phone numbers
    //    (e.g. +639171234567); local formats are kept in Firestore only.
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: email.trim(),
        password,
        displayName: fullName.trim(),
        phoneNumber: /^\+[1-9]\d{6,14}$/.test(phoneStr) ? phoneStr : undefined,
        emailVerified: true,
      });
    } catch (authErr) {
      const AUTH_ERRORS = {
        'auth/email-already-exists': ['An account with this email already exists', 409],
        'auth/phone-number-already-exists': ['An account with this phone number already exists', 409],
        'auth/invalid-email': ['A valid email address is required', 400],
        'auth/invalid-password': ['Password must be at least 6 characters', 400],
        'auth/invalid-phone-number': ['Phone number must be in E.164 format (e.g. +639171234567)', 400],
      };
      const mapped = AUTH_ERRORS[authErr.code];
      if (mapped) return sendError(res, mapped[0], mapped[1]);
      throw authErr;
    }

    // 2. Set Custom User Claim for the role
    await auth.setCustomUserClaims(userRecord.uid, { role });

    // 3. Create Firestore record in users collection
    const now = new Date().toISOString();
    const userData = {
      uid: userRecord.uid,
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phoneStr,
      emergencyContact: '',
      role,
      accountStatus: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('users').doc(userRecord.uid).set(userData);

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'CREATE_STAFF_ACCOUNT',
      targetType: 'user',
      targetId: userRecord.uid,
      metadata: { email, role, fullName },
    });

    return sendSuccess(res, userData, `Staff account for ${fullName} (${role}) created successfully`, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Update user account status (Activate / Deactivate)
 */
export const setUserAccountStatus = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { accountStatus } = req.body; // 'active' | 'deactivated'

    if (!['active', 'deactivated'].includes(accountStatus)) {
      return sendError(res, "accountStatus must be 'active' or 'deactivated'", 400);
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return sendError(res, 'User not found', 404);
    }

    // Prevent deactivating own admin account
    if (uid === req.user.uid) {
      return sendError(res, 'You cannot deactivate your own administrative account', 400);
    }

    const isDisabled = accountStatus === 'deactivated';

    // Update in Firebase Auth
    if (auth) {
      await auth.updateUser(uid, { disabled: isDisabled });
    }

    // Update in Firestore
    const now = new Date().toISOString();
    await userRef.update({
      accountStatus,
      updatedAt: now,
    });

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: isDisabled ? 'DEACTIVATE_USER' : 'ACTIVATE_USER',
      targetType: 'user',
      targetId: uid,
      metadata: { email: userDoc.data().email, newStatus: accountStatus },
    });

    return sendSuccess(res, { uid, accountStatus }, `User account status updated to ${accountStatus}`);
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Update user role (Admin only)
 */
export const setUserRole = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { role } = req.body;

    const allowedRoles = ['customer', 'coordinator', 'support', 'guide', 'admin'];
    if (!allowedRoles.includes(role)) {
      return sendError(res, `Invalid role. Allowed: ${allowedRoles.join(', ')}`, 400);
    }

    if (uid === req.user.uid && role !== 'admin') {
      return sendError(res, 'Cannot revoke your own admin role', 400);
    }

    // Check existence first: previously the custom claim was set and THEN the
    // Firestore update threw NOT_FOUND (500), leaving Auth and Firestore out of sync.
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return sendError(res, 'User not found', 404);
    }

    if (auth) {
      await auth.setCustomUserClaims(uid, { role });
    }

    await userRef.update({
      role,
      updatedAt: new Date().toISOString(),
    });

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'UPDATE_USER_ROLE',
      targetType: 'user',
      targetId: uid,
      metadata: { previousRole: userDoc.data().role || null, newRole: role },
    });

    return sendSuccess(res, { uid, role }, `User role changed to ${role}`);
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Generate Business Reports & CSV Export
 */
export const getReports = async (req, res, next) => {
  try {
    const { startDate, endDate, format } = req.query;

    let query = db.collection('bookings');
    if (startDate) query = query.where('departureDate', '>=', startDate);
    if (endDate) query = query.where('departureDate', '<=', endDate);

    const snapshot = await query.get();
    const bookings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Generate CSV export if requested
    if (format === 'csv') {
      // Escape a cell: neutralize spreadsheet formula injection (=, +, -, @, \t, \r)
      // and quote-wrap so commas/quotes/newlines in data cannot break the CSV.
      const csvCell = (val) => {
        let s = val === null || val === undefined ? '' : String(val);
        if (/^[=+\-@\t\r]/.test(s)) {
          s = `'${s}`;
        }
        return `"${s.replace(/"/g, '""')}"`;
      };

      const headers = [
        'Booking Reference',
        'Customer Name',
        'Customer Email',
        'Customer Phone',
        'Tour Package',
        'Departure Date',
        'Travelers',
        'Price Per Person (PHP)',
        'Total Price (PHP)',
        'Booking Status',
        'Payment Status',
        'Created At',
      ];

      const rows = bookings.map((b) => [
        csvCell(b.bookingReference),
        csvCell(b.customerName),
        csvCell(b.customerEmail),
        csvCell(b.customerPhone),
        csvCell(b.packageName),
        csvCell(b.departureDate),
        csvCell(b.numberOfTravelers || 1),
        csvCell(b.pricePerPerson || 0),
        csvCell(b.totalPrice || 0),
        csvCell(b.bookingStatus),
        csvCell(b.paymentStatus),
        csvCell(b.createdAt),
      ]);

      const csvContent = [headers.map(csvCell).join(','), ...rows.map((r) => r.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=lakbay-report-${new Date().toISOString().split('T')[0]}.csv`);
      return res.status(200).send(csvContent);
    }

    // Default JSON response. Revenue rule matches the dashboard: only Paid
    // bookings that are Confirmed/Completed (a Cancelled booking whose refund
    // failed stays paymentStatus 'Paid' and must not count as revenue).
    const totalCollected = bookings
      .filter((b) => b.paymentStatus === 'Paid' && (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Completed'))
      .reduce((sum, b) => sum + Number(b.totalPrice || 0), 0);

    return sendSuccess(res, {
      recordCount: bookings.length,
      totalCollected,
      bookings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Get Activity Audit Logs (Admin only)
 */
export const getActivityLogs = async (req, res, next) => {
  try {
    const { action, actorUid, limit = 50 } = req.query;

    let query = db.collection('activityLogs');

    if (action) query = query.where('action', '==', action);
    if (actorUid) query = query.where('actorUid', '==', actorUid);

    const snapshot = await query.get();
    let logs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    logs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    logs = logs.slice(0, parseLimit(limit));

    return sendSuccess(res, logs, `Retrieved ${logs.length} activity log(s)`);
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Get Current Staff Profile (Admin / Coordinator / Support / Guide)
 */
export const getStaffProfile = async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const docRef = db.collection('users').doc(userId);
    const doc = await docRef.get();

    if (!doc.exists) {
      const now = new Date().toISOString();
      const profile = {
        uid: userId,
        fullName: req.user.fullName || req.user.email?.split('@')[0] || 'Staff Member',
        email: req.user.email || '',
        phone: req.user.phone || '',
        role: req.user.role || 'support',
        accountStatus: 'active',
        createdAt: now,
        updatedAt: now,
      };
      await docRef.set(profile);
      return sendSuccess(res, { id: userId, ...profile });
    }

    return sendSuccess(res, { id: doc.id, ...doc.data() });
  } catch (error) {
    next(error);
  }
};

/**
 * 9. Update Current Staff Profile (Admin / Coordinator / Support / Guide)
 */
export const updateStaffProfile = async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const { fullName, phone, bio, languages, emergencyContact } = req.body;

    const docRef = db.collection('users').doc(userId);
    const existing = await docRef.get();

    if (!existing.exists) {
      return sendError(res, 'Staff user document not found', 404);
    }

    const updates = {
      updatedAt: new Date().toISOString(),
    };

    for (const [key, val] of Object.entries({ fullName, phone, bio })) {
      if (val !== undefined && typeof val !== 'string') {
        return sendError(res, `${key} must be a string`, 400);
      }
    }
    if (fullName !== undefined) {
      const trimmed = fullName.trim();
      if (!trimmed) return sendError(res, 'Full name cannot be empty', 400);
      updates.fullName = trimmed;
    }
    if (phone !== undefined) updates.phone = phone.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    if (languages !== undefined) {
      if (!Array.isArray(languages) && typeof languages !== 'string') {
        return sendError(res, 'languages must be a list or string', 400);
      }
      updates.languages = languages;
    }
    if (emergencyContact !== undefined) updates.emergencyContact = emergencyContact;

    await docRef.update(updates);

    // Update Firebase Auth display name if provided
    if (updates.fullName && auth) {
      try {
        await auth.updateUser(userId, { displayName: updates.fullName });
      } catch (authErr) {
        console.warn('[updateStaffProfile] Warning: could not update Firebase Auth displayName:', authErr.message);
      }
    }

    await logActivity({
      actorUid: userId,
      actorRole: req.user.role,
      action: 'UPDATE_STAFF_PROFILE',
      targetType: 'user',
      targetId: userId,
      metadata: { updatedFields: Object.keys(updates) },
    });

    const updated = await docRef.get();
    return sendSuccess(res, { id: userId, ...updated.data() }, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * 10. Assignable tour guides (Admin / Coordinator / Operator)
 * Narrow lookup for departure guide assignment: returns ONLY uid + fullName of
 * active guides (no emails/phones), so non-admins never need GET /admin/users.
 */
export const getAssignableGuides = async (req, res, next) => {
  try {
    const snapshot = await db.collection('users').where('role', '==', 'guide').get();
    const guides = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((u) => (u.accountStatus || 'active') === 'active')
      .map((u) => ({ uid: u.uid || u.id, fullName: u.fullName || '' }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return sendSuccess(res, guides, `Retrieved ${guides.length} guide(s)`);
  } catch (error) {
    next(error);
  }
};
