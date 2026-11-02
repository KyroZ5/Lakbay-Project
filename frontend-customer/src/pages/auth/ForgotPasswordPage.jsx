import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { getErrorMessage } from '../../lib/notify';
import { Compass, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export const ForgotPasswordPage = () => {
  const { resetPassword } = useAuth();
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
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <Compass className="h-6 w-6 stroke-[2.2]" />
            </div>
            <span className="text-2xl font-black text-slate-900 font-heading">
              Lakbay<span className="text-emerald-600">.ph</span>
            </span>
          </Link>
          <h2 className="text-2xl font-extrabold text-slate-900 font-heading">
            Reset Your Password
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Enter your registered email to receive a password reset link.
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

            {success ? (
              <div role="status" className="text-center py-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900">Check Your Inbox</h3>
                <p className="text-xs text-slate-600 mt-2">
                  We sent a reset link to <span className="font-semibold">{email}</span>. Click the link in the email to set a new password.
                </p>
                <Button asChild variant="outline" className="mt-6 text-xs font-semibold">
                  <Link to="/login">
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
                    to="/login"
                    className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-emerald-700"
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
    </div>
  );
};
