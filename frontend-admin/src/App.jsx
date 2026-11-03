import React, { useEffect } from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { StaffAuthProvider } from './contexts/StaffAuthContext';
import { AdminRoutes } from './routes/AdminRoutes';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { signOut } from 'firebase/auth';
import { auth } from './firebase/firebase';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppInner />
    </BrowserRouter>
  );
}

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onSessionExpired = () => {
      signOut(auth);
      // StaffLoginPage reads state.from to return the user after signing back in
      const state = location.pathname === '/login' ? undefined : { from: location };
      navigate('/login', { replace: true, state });
    };
    window.addEventListener('auth:session-expired', onSessionExpired);
    return () => window.removeEventListener('auth:session-expired', onSessionExpired);
  }, [navigate, location]);

  return (
    <TooltipProvider delayDuration={300}>
      <StaffAuthProvider>
        <AdminRoutes />
      </StaffAuthProvider>
      <Toaster position="top-right" />
    </TooltipProvider>
  );
}
