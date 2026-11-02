import React, { useState, useEffect } from 'react';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { adminApi } from '../../api/adminApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { FieldError } from '../../components/common/FieldError';
import { notify } from '../../lib/notify';
import { auth } from '../../firebase/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import {
  User,
  Shield,
  KeyRound,
  RefreshCw,
  Copy,
  CheckCheck,
  Lock,
  Mail,
  Phone,
  Save,
} from 'lucide-react';

export const SettingsPage = () => {
  const { user, profile, role, updateProfileState } = useStaffAuth();

  // Profile Form State
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [languages, setLanguages] = useState(profile?.languages || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});
  const [copiedUid, setCopiedUid] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});

  // Keep state updated if profile loads late
  useEffect(() => {
    if (profile) {
      if (!fullName) setFullName(profile.fullName || '');
      if (!phone) setPhone(profile.phone || '');
      if (!bio) setBio(profile.bio || '');
      if (!languages) setLanguages(profile.languages || '');
    }
  }, [profile]);

  // Copy UID helper
  const handleCopyUid = async () => {
    const uid = profile?.uid || user?.uid;
    if (!uid) return;
    try {
      await navigator.clipboard.writeText(uid);
      notify.success('Copied UID to clipboard.');
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    } catch (err) {
      notify.error(err, 'Failed to copy UID.');
    }
  };

  // Handle Profile Update
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (savingProfile) return;

    if (!fullName.trim()) {
      setProfileErrors({ fullName: 'Full name cannot be empty.' });
      return;
    }
    setProfileErrors({});

    try {
      setSavingProfile(true);
      const payload = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        languages: languages.trim(),
      };

      const res = await adminApi.updateStaffProfile(payload);
      const updated = res.data || payload;

      // Update local context profile state for immediate UI sync
      updateProfileState(updated);
      notify.success('Profile details successfully updated!');
    } catch (err) {
      notify.error(err, 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Password Change with Re-authentication
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (updatingPassword) return;

    if (!currentPassword) {
      setPasswordErrors({ currentPassword: 'Please enter your current password.' });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordErrors({ newPassword: 'New password must be at least 8 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrors({ confirmPassword: 'New password and confirmation do not match.' });
      return;
    }
    setPasswordErrors({});

    try {
      setUpdatingPassword(true);
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('No authenticated user session found.');
      }

      // 1. Re-authenticate with current credentials
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // 2. Set new password
      await updatePassword(currentUser, newPassword);

      notify.success('Password successfully changed! Use your new password for your next sign-in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        console.error('[SettingsPage] Password update error:', err);
        setPasswordErrors({ currentPassword: 'Current password is incorrect. Please verify and try again.' });
      } else if (err.code === 'auth/weak-password') {
        console.error('[SettingsPage] Password update error:', err);
        setPasswordErrors({ newPassword: 'Password is too weak. Please use a stronger combination.' });
      } else {
        notify.error(err, 'Failed to update password.');
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  const roleBadgeVariant =
    role === 'admin'
      ? 'destructive'
      : role === 'coordinator'
      ? 'info'
      : role === 'guide'
      ? 'success'
      : 'secondary';

  const roleTitle =
    role === 'admin'
      ? 'Platform Administrator'
      : role === 'coordinator'
      ? 'Tour Coordinator'
      : role === 'guide'
      ? 'Licensed Tour Guide'
      : 'Customer Support Specialist';

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Account Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your personal staff details, password credentials, and platform access.
        </p>
      </div>

      {/* User Header Profile Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-xl border-2 border-emerald-300">
            {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'S'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{profile?.fullName || 'Staff Member'}</h2>
              <Badge variant={roleBadgeVariant} className="capitalize text-xs font-bold px-2 py-0.5">
                {role || 'Staff'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{profile?.email || user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 w-full sm:w-auto justify-between sm:justify-start">
          <span className="font-medium text-slate-600">UID:</span>
          <span className="font-mono">{user?.uid ? `${user.uid.substring(0, 10)}...` : 'N/A'}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyUid}
                className="h-6 w-6 p-0 text-slate-500 hover:text-slate-800"
                aria-label="Copy full UID"
              >
                {copiedUid ? <CheckCheck className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy full UID</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Section 1: Personal Profile */}
        <Card>
          <form onSubmit={handleSaveProfile} noValidate>
            <CardHeader>
              <div className="flex items-center gap-2 text-slate-900">
                <User className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base font-bold">Personal Profile Information</CardTitle>
              </div>
              <CardDescription>
                Update your contact details and display name visible in departures and internal audit records.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700">
                    Full Name <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Maria Santos"
                    required
                    aria-invalid={Boolean(profileErrors.fullName)}
                    aria-describedby={profileErrors.fullName ? 'fullName-error' : undefined}
                  />
                  <FieldError id="fullName-error">{profileErrors.fullName}</FieldError>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">
                    Phone Number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="phone"
                      type="text"
                      className="pl-9"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+63 917 123 4567"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                    Email Address (Account Identifier)
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-9 bg-slate-50 text-slate-500 cursor-not-allowed"
                      value={profile?.email || user?.email || ''}
                      disabled
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Email is linked to authentication credentials and managed by administrators.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Staff Access Role</Label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-slate-700 text-sm">
                    <Shield className="h-4 w-4 text-slate-500" />
                    <span className="font-semibold">{roleTitle}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Access privileges are governed strictly through Staff IAM policies.
                  </p>
                </div>
              </div>

              {/* Tour Guide extra fields */}
              {role === 'guide' && (
                <div className="space-y-4 pt-3 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <Label htmlFor="languages" className="text-xs font-semibold text-slate-700">
                      Languages Spoken
                    </Label>
                    <Input
                      id="languages"
                      type="text"
                      value={languages}
                      onChange={(e) => setLanguages(e.target.value)}
                      placeholder="e.g. English, Tagalog, Cebuano, Ilocano"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bio" className="text-xs font-semibold text-slate-700">
                      Tour Guide Bio & Certifications
                    </Label>
                    <Textarea
                      id="bio"
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="text-xs text-slate-800"
                      placeholder="Brief summary of certifications, years guiding, or local island specialties..."
                    />
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex justify-end border-t border-slate-100 pt-4">
              <Button
                type="submit"
                disabled={savingProfile}
                className="flex items-center gap-2"
              >
                {savingProfile ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Profile Changes</span>
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Section 2: Security & Password */}
        <Card>
          <form onSubmit={handleUpdatePassword} noValidate>
            <CardHeader>
              <div className="flex items-center gap-2 text-slate-900">
                <KeyRound className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base font-bold">Security & Password</CardTitle>
              </div>
              <CardDescription>
                Update your login password. For security, your current password is required before making changes.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword" className="text-xs font-semibold text-slate-700">
                  Current Password <span className="text-red-600" aria-hidden="true">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="currentPassword"
                    type="password"
                    className="pl-9"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    aria-invalid={Boolean(passwordErrors.currentPassword)}
                    aria-describedby={passwordErrors.currentPassword ? 'currentPassword-error' : undefined}
                  />
                </div>
                <FieldError id="currentPassword-error">{passwordErrors.currentPassword}</FieldError>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-xs font-semibold text-slate-700">
                    New Password <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="newPassword"
                      type="password"
                      className="pl-9"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      required
                      aria-invalid={Boolean(passwordErrors.newPassword)}
                      aria-describedby={passwordErrors.newPassword ? 'newPassword-error' : undefined}
                    />
                  </div>
                  <FieldError id="newPassword-error">{passwordErrors.newPassword}</FieldError>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">
                    Confirm New Password <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      className="pl-9"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      required
                      aria-invalid={Boolean(passwordErrors.confirmPassword)}
                      aria-describedby={passwordErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                    />
                  </div>
                  <FieldError id="confirmPassword-error">{passwordErrors.confirmPassword}</FieldError>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex justify-end border-t border-slate-100 pt-4">
              <Button
                type="submit"
                disabled={updatingPassword}
                className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2"
              >
                {updatingPassword ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Verifying & Updating...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    <span>Update Password</span>
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Section 3: Role & Permissions Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-slate-900">
              <Shield className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base font-bold">Role Privileges & Permissions</CardTitle>
            </div>
            <CardDescription>
              Summary of operational abilities associated with your assigned staff role ({roleTitle}).
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                <span className="text-xs font-bold text-slate-800">Tour Operations</span>
                <p className="text-xs text-slate-600 mt-1">
                  {role === 'guide'
                    ? 'Access to assigned departure passenger manifests, live destination weather, and traveler check-in.'
                    : 'Access to Departures schedule management, capacity tracking, and passenger assignments.'}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                <span className="text-xs font-bold text-slate-800">Customer Support & Bookings</span>
                <p className="text-xs text-slate-600 mt-1">
                  {role === 'guide'
                    ? 'View-only passenger manifests and dietary/medical notes for assigned tours.'
                    : 'Search bookings, add internal staff notes, reschedule passenger dates, and review refunds.'}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                <span className="text-xs font-bold text-slate-800">Catalog Management</span>
                <p className="text-xs text-slate-600 mt-1">
                  {role === 'admin' || role === 'coordinator'
                    ? 'Create and edit Philippine destinations, GPS geocoding, and multi-day tour package itineraries.'
                    : 'Read-only access to published travel catalog data.'}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                <span className="text-xs font-bold text-slate-800">Platform Governance & IAM</span>
                <p className="text-xs text-slate-600 mt-1">
                  {role === 'admin'
                    ? 'Full administrative control, Staff IAM account provisioning, and CSV financial exports.'
                    : 'Governed by organization administrators.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
