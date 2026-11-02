import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStaffAuth } from '../contexts/StaffAuthContext';
import { Button } from '../components/ui/button';
import { notify } from '../lib/notify';
import { AlertTriangle } from 'lucide-react';

export const RoleRoute = ({ allowedRoles = [], children }) => {
  const { user, role, loading, logout } = useStaffAuth();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      notify.success('Signed out');
    } catch (err) {
      notify.error(err, 'Failed to sign out. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-600">Verifying staff credentials...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If role is not in allowedRoles (admins always allowed everywhere)
  if (allowedRoles.length > 0 && !allowedRoles.includes(role) && role !== 'admin') {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center px-4">
        <div className="mb-4 rounded-full bg-red-100 p-4 text-red-600">
          <AlertTriangle className="h-10 w-10" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">403 - Permission Denied</h2>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          Your staff role (<strong>{role}</strong>) does not have access to view or manage this section.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
          <Button onClick={handleLogout} variant="destructive">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return children;
};
