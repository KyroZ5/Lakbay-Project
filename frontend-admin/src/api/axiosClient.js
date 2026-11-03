import axios from 'axios';
import { auth } from '../firebase/firebase';
import { signOut } from 'firebase/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: attach Firebase ID token if user is signed in
axiosClient.interceptors.request.use(
  async (config) => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('[AxiosClient] Failed to retrieve ID token:', err.message);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: extract response envelope, format errors, and handle 401
// session expiry (force-refresh once, then sign out on persistent failure).
axiosClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const config = error.config || {};

    if (error.response?.status === 401) {
      if (!config._retried) {
        try {
          config._retried = true;
          const currentUser = auth.currentUser;
          if (currentUser) {
            await currentUser.getIdToken(true); // force token refresh
            config.headers.Authorization = `Bearer ${await currentUser.getIdToken()}`;
            return axiosClient(config);
          }
        } catch (refreshErr) {
          // fall through to session expiry handling below
        }
      }
      // Persistent 401 (refresh failed, or the retried request was rejected again):
      // notify the app to sign out and redirect to login
      if (auth.currentUser) {
        window.dispatchEvent(new Event('auth:session-expired'));
      }
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected network error occurred';
    const normalized = new Error(message);
    normalized.status = error.response?.status;
    normalized.isNetworkError = !error.response;
    return Promise.reject(normalized);
  }
);

export default axiosClient;
