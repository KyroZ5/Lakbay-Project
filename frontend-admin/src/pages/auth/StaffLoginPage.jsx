import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/card';
import { ShieldCheck, AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { notify, getErrorMessage } from '../../lib/notify';

// Demo quick-fill is only available when explicitly enabled at BUILD time.
// Never ship this to production bundles (set VITE_ENABLE_DEMO_LOGIN=true only for local demos).
const DEMO_LOGIN_ENABLED = import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';

export const StaffLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, authError } = useStaffAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fromLocation = location.state?.from;
  // Default to '/', which redirects each role to a landing page it can access
  const from = fromLocation?.pathname ? fromLocation.pathname + (fromLocation.search || '') : '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!email || !password) {
      setError('Please provide both staff email and password.');
      return;
    }

    try {
      setError('');
      setSubmitting(true);
      await login(email.trim(), password);
      notify.success('Signed in');
      navigate(from, { replace: true });
    } catch (err) {
      console.error('[StaffLoginPage] Login error:', err);
      // Inline banner only (no toast) — Firebase/internal error text is replaced by the fallback
      setError(getErrorMessage(err, 'Failed to sign in. Please verify your credentials.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickFill = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-8 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-500/20 text-white font-extrabold text-2xl">
            L
          </div>
          <h1 className="mt-4 text-xl sm:text-2xl font-bold tracking-tight text-white">
            Lakbay Operations Portal
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Internal Staff & Administration Management System
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
          <CardHeader className="p-5 sm:p-6">
            <CardTitle className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              Staff Authentication
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Restricted to Coordinators, Support Agents, Guides, Tour Operators, and Admins.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
              {(error || authError) && (
                <div
                  id="login-error"
                  role="alert"
                  className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-950/50 p-3 text-red-300 text-sm"
                >
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                  <div className="min-w-0 break-words">
                    <span className="font-semibold block">Access Restricted</span>
                    <span className="text-xs leading-relaxed">{error || authError}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-300">
                  Staff Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@lakbay.ph"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  aria-invalid={Boolean(error) && !email}
                  aria-describedby={error || authError ? 'login-error' : undefined}
                  className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-300">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={Boolean(error) && !password}
                  aria-describedby={error || authError ? 'login-error' : undefined}
                  className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
                className="w-full h-11 hover:bg-emerald-500 font-semibold py-2.5 transition-all shadow-md mt-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Sign In to Staff Portal'
                )}
              </Button>
            </CardContent>
          </form>

          {/* Quick Demo Credentials — only in explicitly-enabled demo builds */}
          {DEMO_LOGIN_ENABLED && (
            <CardFooter className="flex flex-col border-t border-slate-800/80 px-5 pt-4 pb-4 sm:px-6">
              <span className="text-xs font-medium text-slate-400 mb-2.5 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
                Demo Credentials (from Phase 1 Initial Seeder)
              </span>
              <div className="w-full flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickFill('admin@lakbay.ph', 'AdminPassword123')}
                  className="w-full border-slate-700 bg-slate-900 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  Fill Primary Admin
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>

        <div className="text-center text-xs text-slate-500">
          Philippine Tourism Platform &bull; All sessions logged for security audit.
        </div>
      </div>
    </div>
  );
};
