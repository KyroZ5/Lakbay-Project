import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile as updateFirebaseProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import axiosClient from '../api/axiosClient';
import { notify } from '../lib/notify';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          // Fetch user document from Firestore users collection
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            // Block deactivated accounts
            if (data.accountStatus === 'deactivated' || data.accountStatus === 'disabled') {
              await signOut(auth);
              setUser(null);
              setProfile(null);
              notify.error('Your account has been deactivated. Please contact customer support.');
              setLoading(false);
              return;
            }
            setProfile(data);
          } else {
            // Document might be synced via API
            try {
              const res = await axiosClient.get('/customers/profile');
              setProfile(res.data || res);
            } catch {
              setProfile({
                uid: firebaseUser.uid,
                fullName: firebaseUser.displayName || 'Customer',
                email: firebaseUser.email,
                role: 'customer',
                accountStatus: 'active',
              });
            }
          }
        } catch (err) {
          console.warn('[AuthContext] Firestore profile fetch error; falling back to API/auth profile:', err.message);
          try {
            const res = await axiosClient.get('/customers/profile');
            setProfile(res.data || res);
          } catch {
            setProfile({
              uid: firebaseUser.uid,
              fullName: firebaseUser.displayName || 'Customer',
              email: firebaseUser.email,
              role: 'customer',
              accountStatus: 'active',
            });
          }
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Register a new customer
   * Public registration always enforces 'customer' role
   */
  const register = async (email, password, fullName, phone) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const registeredUser = userCredential.user;

    // Update Firebase display name
    await updateFirebaseProfile(registeredUser, { displayName: fullName });

    const now = new Date().toISOString();
    const customerData = {
      uid: registeredUser.uid,
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      emergencyContact: '',
      role: 'customer', // strictly customer
      accountStatus: 'active',
      createdAt: now,
      updatedAt: now,
    };

    // Create Firestore document in users collection
    try {
      await setDoc(doc(db, 'users', registeredUser.uid), customerData);
    } catch (firestoreErr) {
      console.warn('[AuthContext] Client Firestore write restricted; syncing via API:', firestoreErr.message);
      try {
        await axiosClient.post('/customers/sync-profile', { fullName, phone });
      } catch (apiErr) {
        console.warn('[AuthContext] Backend sync fallback notice:', apiErr.message);
      }
    }

    setUser(registeredUser);
    setProfile(customerData);
    return registeredUser;
  };

  /**
   * Log in with email and password
   */
  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const loggedInUser = userCredential.user;

    try {
      const userDocRef = doc(db, 'users', loggedInUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.accountStatus === 'deactivated' || data.accountStatus === 'disabled') {
          await signOut(auth);
          throw new Error('Your account has been deactivated. Please contact support.');
        }
        setProfile(data);
      }
    } catch (err) {
      console.warn('[AuthContext] Firestore read notice during login:', err.message);
      setProfile({
        uid: loggedInUser.uid,
        fullName: loggedInUser.displayName || 'Customer',
        email: loggedInUser.email,
        role: 'customer',
        accountStatus: 'active',
      });
    }

    return loggedInUser;
  };

  /**
   * Log out current user
   */
  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  /**
   * Send password reset email
   */
  const resetPassword = async (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  const value = {
    user,
    profile,
    role: profile?.role || 'customer',
    loading,
    register,
    login,
    logout,
    resetPassword,
    setProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
