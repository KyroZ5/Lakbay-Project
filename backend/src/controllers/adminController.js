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
    // 1. Counts via aggregation queries (avoid downloading whole collections)
    const [custCount, destCount, pkgCount, depSnap, bookSnap] = await Promise.all([
      db.collection('users').where('role', '==', 'customer').count().get(),
      db.collection('destinations').count().get(),
      db.collection('tourPackages').count().get(),
      db.collection('departures').get(),
      db.collection('bookings').get(),
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

    const today = todayInManila();
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

    const snapshot = await query.limit(parseLimit(limit)).get();
    let users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      users = users.filter(
        (u) =>
          u.fullName?.toLowerCase().includes(term) ||
          u.email?.toLowerCase().includes(term) ||
          u.phone?.toLowerCase().includes(term)
      );
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

    if (!email || !password || !fullName) {
      return sendError(res, 'Email, password, and fullName are required', 400);
    }

    if (!auth) {
      return sendError(res, 'Firebase Auth is unavailable', 503);
    }

    // 1. Create in Firebase Auth
    const userRecord = await auth.createUser({
      email: email.trim(),
      password,
      displayName: fullName.trim(),
      phoneNumber: phone.trim() || undefined,
      emailVerified: true,
    });

    // 2. Set Custom User Claim for the role
    await auth.setCustomUserClaims(userRecord.uid, { role });

    // 3. Create Firestore record in users collection
    const now = new Date().toISOString();
    const userData = {
      uid: userRecord.uid,
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
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

    if (auth) {
      await auth.setCustomUserClaims(uid, { role });
    }

    await db.collection('users').doc(uid).update({
      role,
      updatedAt: new Date().toISOString(),
    });

    await logActivity({
      actorUid: req.user.uid,
      actorRole: req.user.role,
      action: 'UPDATE_USER_ROLE',
      targetType: 'user',
      targetId: uid,
      metadata: { newRole: role },
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

    // Default JSON response
    const totalCollected = bookings
      .filter((b) => b.paymentStatus === 'Paid')
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

    if (fullName !== undefined) {
      const trimmed = fullName.trim();
      if (!trimmed) return sendError(res, 'Full name cannot be empty', 400);
      updates.fullName = trimmed;
    }
    if (phone !== undefined) updates.phone = phone.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    if (languages !== undefined) updates.languages = languages;
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
