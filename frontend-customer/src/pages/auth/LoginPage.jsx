import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { notify, getErrorMessage } from '../../lib/notify';
import { AuthShell } from '../../components/common/AuthShell';
import { getSafeRedirect, withRedirect } from '../../lib/redirect';
import { Compass, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Same-origin redirect target (validated to block open redirects)
  const redirectPath = getSafeRedirect(location.search);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      notify.success('Signed in. Welcome back!');
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please verify your credentials.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed login attempts. Please try again later.');
      } else {
        setError(getErrorMessage(err, 'Failed to sign in. Please check your network connection.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full space-y-6">
        <div className="text-center lg:text-left">
          <h2 className="text-2xl font-extrabold text-slate-900 font-heading">
            Welcome back, <span className="text-gradient">Traveler</span>
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Sign in to manage your tour bookings, co-travelers, and trip itineraries.
          </p>
        </div>

        <Card className="rounded-2xl border-slate-200 shadow-md">
          <CardContent className="p-8">
            {error && (
              <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="login-email" className="text-xs font-semibold text-slate-700">Email Address</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="juan@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className="text-xs font-semibold text-slate-700">Password</Label>
                  <Link
                    to={withRedirect('/forgot-password', redirectPath)}
                    className="text-xs font-semibold text-emerald-600 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative mt-1">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-2.5 rounded text-slate-400 hover:text-slate-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full font-bold h-11 mt-2 shadow-md shadow-emerald-600/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  'Log In'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-500">
              Don't have an account yet?{' '}
              <Link to={withRedirect('/register', redirectPath)} className="font-bold text-emerald-600 hover:underline">
                Create Account
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthShell>
  );
};
