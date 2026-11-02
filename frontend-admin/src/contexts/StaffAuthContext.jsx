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

export const StaffAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // Sync auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // 1. Check custom user claims
          const idTokenResult = await firebaseUser.getIdTokenResult(true);
          let userRole = idTokenResult.claims.role;

          // 2. Fetch user profile from Firestore if permitted
          let userData = null;
          try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userSnap = await getDoc(userDocRef);
            userData = userSnap.exists() ? userSnap.data() : null;
          } catch (profileErr) {
            console.warn('[StaffAuthContext] Direct Firestore read restricted; using token claims:', profileErr.message);
          }

          if (!userRole && userData?.role) {
            userRole = userData.role;
          }

          // 3. Strict Check: Reject customer accounts
          if (!userRole || userRole === 'customer' || !STAFF_ROLES.includes(userRole)) {
            await signOut(auth);
            setUser(null);
            setProfile(null);
            setRole(null);
            setAuthError('Access Denied: Customer accounts cannot access the Lakbay Staff Portal.');
            setLoading(false);
            return;
          }

          // 4. Check deactivated status
          if (userData && (userData.accountStatus === 'deactivated' || userData.accountStatus === 'disabled')) {
            await signOut(auth);
            setUser(null);
            setProfile(null);
            setRole(null);
            setAuthError('Your staff account has been deactivated. Please contact an Administrator.');
            setLoading(false);
            return;
          }

          // Valid staff member
          setUser(firebaseUser);
          setRole(userRole);
          setProfile(userData || {
            uid: firebaseUser.uid,
            fullName: firebaseUser.displayName || 'Staff Administrator',
            email: firebaseUser.email,
            role: userRole,
            accountStatus: 'active',
          });
          setAuthError('');
        } catch (err) {
          console.error('[StaffAuthContext] Verification error:', err);
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setRole(null);
          setAuthError(getErrorMessage(err, 'Authentication error verifying staff permissions.'));
        }
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
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

    // Verify token claims and firestore role
    const idTokenResult = await loggedInUser.getIdTokenResult(true);
    let userRole = idTokenResult.claims.role;

    let userData = null;
    try {
      const userDocRef = doc(db, 'users', loggedInUser.uid);
      const userSnap = await getDoc(userDocRef);
      userData = userSnap.exists() ? userSnap.data() : null;
    } catch (profileErr) {
      console.warn('[StaffAuthContext] Direct Firestore profile read restricted in login:', profileErr.message);
    }

    if (!userRole && userData?.role) {
      userRole = userData.role;
    }

    // Rejection rule: Customer accounts cannot access staff portal
    if (!userRole || userRole === 'customer' || !STAFF_ROLES.includes(userRole)) {
      await signOut(auth);
      const errMsg = 'Access Denied: Customer accounts cannot access the Lakbay Staff Portal.';
      setAuthError(errMsg);
      throw new Error(errMsg);
    }

    if (userData && (userData.accountStatus === 'deactivated' || userData.accountStatus === 'disabled')) {
      await signOut(auth);
      const errMsg = 'Your staff account has been deactivated. Please contact an Administrator.';
      setAuthError(errMsg);
      throw new Error(errMsg);
    }

    setUser(loggedInUser);
    setRole(userRole);
    setProfile(userData || {
      uid: loggedInUser.uid,
      fullName: loggedInUser.displayName || 'Staff Administrator',
      email: loggedInUser.email,
      role: userRole,
      accountStatus: 'active',
    });

    return loggedInUser;
  };

  /**
   * Log out staff member
   */
  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
    setRole(null);
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

export const useStaffAuth = () => {
  const context = useContext(StaffAuthContext);
  if (!context) {
    throw new Error('useStaffAuth must be used within a StaffAuthProvider');
  }
  return context;
};
