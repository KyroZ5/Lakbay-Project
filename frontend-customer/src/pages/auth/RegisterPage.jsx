import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import { Card, CardContent } from '../../components/ui/card';
import { FieldError } from '../../components/common/FieldError';
import { notify, getErrorMessage } from '../../lib/notify';
import { AuthShell } from '../../components/common/AuthShell';
import { getSafeRedirect, withRedirect } from '../../lib/redirect';
import { Compass, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const redirectPath = getSafeRedirect(location.search);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    const errors = {};
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match. Please verify.';
    }
    if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters long.';
    }
    if (!termsAccepted) {
      errors.terms = 'You must agree to the Terms & Conditions to create an account.';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);

    try {
      await register(email, password, fullName, phone);
      notify.success('Account created. Welcome to Lakbay!');
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error('Registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already registered. Please log in instead.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else {
        setError(getErrorMessage(err, 'Failed to create account. Please try again.'));
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
            Create Your <span className="text-gradient">Traveler Account</span>
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Join thousands of travelers exploring the Philippine archipelago.
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
                <Label htmlFor="register-name" className="text-xs font-semibold text-slate-700">Full Name</Label>
                <Input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="Juan Dela Cruz"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="register-email" className="text-xs font-semibold text-slate-700">Email Address</Label>
                <Input
                  id="register-email"
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
                <Label htmlFor="register-phone" className="text-xs font-semibold text-slate-700">Mobile Phone Number</Label>
                <Input
                  id="register-phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  placeholder="+63 917 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="register-password" className="text-xs font-semibold text-slate-700">Password</Label>
                <div className="relative">
                  <Input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(formErrors.password)}
                    aria-describedby={formErrors.password ? 'register-password-error' : undefined}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-2.5 rounded text-slate-400 hover:text-slate-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FieldError id="register-password-error">{formErrors.password}</FieldError>
              </div>

              <div className="space-y-1">
                <Label htmlFor="register-confirm-password" className="text-xs font-semibold text-slate-700">Confirm Password</Label>
                <Input
                  id="register-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  placeholder="Re-type your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={Boolean(formErrors.confirmPassword)}
                  aria-describedby={formErrors.confirmPassword ? 'register-confirm-password-error' : undefined}
                />
                <FieldError id="register-confirm-password-error">{formErrors.confirmPassword}</FieldError>
              </div>

              <div className="space-y-1 pt-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    aria-invalid={Boolean(formErrors.terms)}
                    aria-describedby={formErrors.terms ? 'terms-error' : undefined}
                    className="mt-0.5"
                  />
                  <label htmlFor="terms" className="text-xs text-slate-600 leading-tight cursor-pointer">
                    I agree to the <Link to="/legal#terms" className="text-emerald-600 underline">Terms & Conditions</Link> and acknowledge the package cancellation policies.
                  </label>
                </div>
                <FieldError id="terms-error">{formErrors.terms}</FieldError>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full font-bold h-11 mt-4 shadow-md shadow-emerald-600/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-500">
              Already have an account?{' '}
              <Link to={withRedirect('/login', redirectPath)} className="font-bold text-emerald-600 hover:underline">
                Log In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthShell>
  );
};
