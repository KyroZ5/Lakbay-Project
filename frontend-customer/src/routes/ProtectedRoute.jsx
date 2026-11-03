import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute = ({ children }) => {
  const { user, loading, signedOutByUser } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm font-medium text-slate-500">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Deliberate logout from a protected page: go home, don't ask them to log in again
    if (signedOutByUser) return <Navigate to="/" replace />;
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return children;
};
