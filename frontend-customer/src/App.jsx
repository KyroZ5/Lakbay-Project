import React, { useEffect } from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppRoutes } from './routes/AppRoutes';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { signOut } from 'firebase/auth';
import { auth } from './firebase/firebase';

export function App() {
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
      // Return the user to where they were after signing back in
      const from = location.pathname + location.search;
      const onAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);
      navigate(onAuthPage ? '/login' : `/login?redirect=${encodeURIComponent(from)}`, { replace: true });
    };
    window.addEventListener('auth:session-expired', onSessionExpired);
    return () => window.removeEventListener('auth:session-expired', onSessionExpired);
  }, [navigate, location]);

  return (
    <TooltipProvider delayDuration={300}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
      <Toaster position="top-right" />
    </TooltipProvider>
  );
}

export default App;
