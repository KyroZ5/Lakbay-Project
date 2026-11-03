import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { getErrorMessage } from '../../lib/notify';
import { AuthShell } from '../../components/common/AuthShell';
import { getSafeRedirect, withRedirect } from '../../lib/redirect';
import { Compass, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export const ForgotPasswordPage = () => {
  const { resetPassword } = useAuth();
  const location = useLocation();
  const loginLink = withRedirect('/login', getSafeRedirect(location.search));
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err) {
      console.error('Password reset error:', err);
      setError(getErrorMessage(err, 'Failed to send password reset email.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full space-y-6">
        <div className="text-center lg:text-left">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-heading break-words">
            Reset Your <span className="text-gradient">Password</span>
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Enter your registered email to receive a password reset link.
          </p>
        </div>

        <Card className="rounded-2xl border-slate-200 shadow-md">
          <CardContent className="p-5 sm:p-8">
            {error && (
              <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span className="min-w-0 break-words">{error}</span>
              </div>
            )}

            {success ? (
              <div role="status" className="text-center py-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900">Check Your Inbox</h3>
                <p className="text-xs text-slate-600 mt-2">
                  We sent a reset link to <span className="font-semibold break-all">{email}</span>. Click the link in the email to set a new password.
                </p>
                <Button asChild variant="outline" className="mt-6 h-11 sm:h-10 w-full sm:w-auto text-xs font-semibold">
                  <Link to={loginLink}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Back to Login
                  </Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="reset-email" className="text-xs font-semibold text-slate-700">Email Address</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="juan@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full font-bold h-11 shadow-md shadow-emerald-600/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>

                <div className="text-center pt-2">
                  <Link
                    to={loginLink}
                    className="inline-flex min-h-[36px] items-center text-xs font-semibold text-slate-600 hover:text-emerald-700"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    Back to Login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthShell>
  );
};
