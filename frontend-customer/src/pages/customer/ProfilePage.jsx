import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { customerApi } from '../../api/customerApi';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { notify } from '../../lib/notify';
import { User, Shield, Loader2 } from 'lucide-react';

export const ProfilePage = () => {
  const { user, profile, setProfile, logout } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [saving, setSaving] = useState(false);

  // Deactivation state
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setPhone(profile.phone || '');
      setEmergencyContact(profile.emergencyContact || '');
    }
  }, [profile]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);

    try {
      await customerApi.updateProfile({
        fullName,
        phone,
        emergencyContact,
      });
      setProfile((prev) => ({ ...prev, fullName, phone, emergencyContact }));
      notify.success('Profile details updated successfully.');
    } catch (err) {
      notify.error(err, 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (deactivating) return;
    setDeactivating(true);

    try {
      await customerApi.deactivateAccount();
      await logout();
      notify.success('Your account has been deactivated.');
      setDeactivateOpen(false);
    } catch (err) {
      notify.error(err, 'Failed to deactivate account.');
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <div className="mb-2 h-1.5 w-14 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <h1 className="text-3xl font-black text-slate-900 font-heading">
          Profile & Security
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your personal details, emergency contacts, and account security.
        </p>
      </div>

      {/* Profile Form */}
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-7">
          <form onSubmit={handleProfileSave} className="space-y-5">
            <h3 className="text-lg font-bold text-slate-900 font-heading mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-600" />
              Personal Information
            </h3>

            <div>
              <Label htmlFor="profile-email" className="text-xs font-semibold text-slate-700">Email Address (Read-only)</Label>
              <Input
                id="profile-email"
                type="email"
                disabled
                value={user?.email || ''}
                className="mt-1 bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <Label htmlFor="profile-full-name" className="text-xs font-semibold text-slate-700">
                Full Name <span className="text-red-600" aria-hidden="true">*</span>
              </Label>
              <Input
                id="profile-full-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="profile-phone" className="text-xs font-semibold text-slate-700">
                Phone Number <span className="text-red-600" aria-hidden="true">*</span>
              </Label>
              <Input
                id="profile-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="profile-emergency" className="text-xs font-semibold text-slate-700">Emergency Contact (Name & Number)</Label>
              <Input
                id="profile-emergency"
                type="text"
                placeholder="e.g. Maria Santos (+63 918 765 4321)"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                aria-describedby="profile-emergency-hint"
                className="mt-1"
              />
              <p id="profile-emergency-hint" className="text-[11px] text-slate-400 mt-1">
                Used by tour coordinators during island expeditions if you cannot be reached.
              </p>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="font-bold text-xs h-10 px-6"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone: Deactivate Account */}
      <Card className="rounded-2xl border-red-100 bg-red-50/20 shadow-sm">
        <CardContent className="p-7">
          <h3 className="text-lg font-bold text-red-900 font-heading mb-2 flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-600" />
            Deactivate Account
          </h3>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Deactivating your account will block future logins and disable notifications. You may only deactivate your account if you have no active or pending tour bookings.
          </p>

          <Button
            variant="destructive"
            onClick={() => setDeactivateOpen(true)}
            disabled={deactivating}
            className="text-xs font-bold"
          >
            {deactivating ? 'Verifying Bookings...' : 'Deactivate My Account'}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="Deactivate your account?"
        description={`Are you sure you want to deactivate the account for ${
          user?.email || 'this profile'
        }? You will not be able to log in until reactivated by support.`}
        confirmLabel="Deactivate My Account"
        loadingLabel="Verifying Bookings..."
        loading={deactivating}
        onConfirm={handleDeactivate}
      />
    </div>
  );
};
