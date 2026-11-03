import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { getErrorMessage } from '../lib/notify';

const StaffAuthContext = createContext(null);

const STAFF_ROLES = ['coordinator', 'support', 'guide', 'admin', 'operator'];

const CUSTOMER_DENIED_MSG = 'Access Denied: Customer accounts cannot access the Lakbay Staff Portal.';
const DEACTIVATED_MSG = 'Your staff account has been deactivated. Please contact an Administrator.';
const isAccessMessage = (msg) => msg === CUSTOMER_DENIED_MSG || msg === DEACTIVATED_MSG;

/**
 * Resolve the staff role + profile for a Firebase user. Mirrors backend verifyToken:
 * the Firestore users/{uid} document is authoritative for role & accountStatus; the
 * token custom claim is only a fallback when the profile can't be read.
 * Returns { role, profile } or throws an Error with a user-facing message.
 */
const resolveStaffAccess = async (firebaseUser) => {
  const idTokenResult = await firebaseUser.getIdTokenResult(true);

  let userData = null;
  try {
    const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
    userData = userSnap.exists() ? userSnap.data() : null;
  } catch (profileErr) {
    console.warn('[StaffAuthContext] Direct Firestore read restricted; using token claims:', profileErr.message);
  }

  const userRole = userData?.role || idTokenResult.claims.role;

  // Strict Check: Reject customer / unknown-role accounts
  if (!userRole || !STAFF_ROLES.includes(userRole)) {
    throw new Error(CUSTOMER_DENIED_MSG);
  }

  // Check deactivated status
  if (userData && (userData.accountStatus === 'deactivated' || userData.accountStatus === 'disabled')) {
    throw new Error(DEACTIVATED_MSG);
  }

  return {
    role: userRole,
    profile: userData
      ? { uid: firebaseUser.uid, ...userData, role: userRole }
      : {
          uid: firebaseUser.uid,
          fullName: firebaseUser.displayName || 'Staff Administrator',
          email: firebaseUser.email,
          role: userRole,
          accountStatus: 'active',
        },
  };
};

export const StaffAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const clearSession = () => {
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  // Sync auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const access = await resolveStaffAccess(firebaseUser);
          // Ignore stale results if the session changed while we were verifying
          if (auth.currentUser?.uid !== firebaseUser.uid) return;

          // Valid staff member
          setUser(firebaseUser);
          setRole(access.role);
          setProfile(access.profile);
          setAuthError('');
        } catch (err) {
          console.error('[StaffAuthContext] Verification error:', err);
          if (auth.currentUser?.uid === firebaseUser.uid) {
            await signOut(auth);
          }
          clearSession();
          setAuthError(
            isAccessMessage(err.message)
              ? err.message
              : getErrorMessage(err, 'Authentication error verifying staff permissions.')
          );
        }
      } else {
        clearSession();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Staff login with email and password
   */
  const login = async (email, password) => {
    setAuthError('');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const loggedInUser = userCredential.user;

    let access;
    try {
      access = await resolveStaffAccess(loggedInUser);
    } catch (err) {
      // Rejection rule: customer / deactivated accounts are signed straight back out
      await signOut(auth);
      clearSession();
      if (isAccessMessage(err.message)) setAuthError(err.message);
      throw err;
    }

    setUser(loggedInUser);
    setRole(access.role);
    setProfile(access.profile);

    return loggedInUser;
  };

  /**
   * Log out staff member
   */
  const logout = async () => {
    await signOut(auth);
    clearSession();
    setAuthError('');
  };

  /**
   * Update profile state locally after settings change
   */
  const updateProfileState = (updatedData) => {
    setProfile((prev) => ({ ...prev, ...updatedData }));
  };

  const value = {
    user,
    profile,
    role,
    loading,
    authError,
    login,
    logout,
    updateProfileState,
    isAdmin: role === 'admin',
    isCoordinator: role === 'coordinator' || role === 'admin',
    isSupport: role === 'support' || role === 'admin',
    isGuide: role === 'guide' || role === 'admin',
  };

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>;
};

/**
 * Landing page per role. Only admin & operator have a metrics dashboard
 * (GET /admin/dashboard is admin-only, /operators/dashboard is operator/admin).
 */
export const getHomePath = (role) => {
  switch (role) {
    case 'admin':
    case 'operator':
      return '/dashboard';
    case 'coordinator':
      return '/catalog/packages';
    case 'support':
      return '/operations/bookings';
    case 'guide':
      return '/operations/guide-manifest';
    default:
      return '/login';
  }
};

export const useStaffAuth = () => {
  const context = useContext(StaffAuthContext);
  if (!context) {
    throw new Error('useStaffAuth must be used within a StaffAuthProvider');
  }
  return context;
};
