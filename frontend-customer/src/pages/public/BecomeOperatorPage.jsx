import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { operatorsApi } from '../../api/operatorsApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { ErrorState } from '../../components/common/DataStates';
import { LoadingRegion } from '../../components/common/Skeletons';
import { FieldError } from '../../components/common/FieldError';
import { notify, getErrorMessage } from '../../lib/notify';
import {
  Compass,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Users,
  ShieldCheck,
  Send,
  Loader2,
  ExternalLink,
} from 'lucide-react';

export const BecomeOperatorPage = () => {
  const { user, profile } = useAuth();

  const [agencyName, setAgencyName] = useState('');
  const [accreditationNumber, setAccreditationNumber] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [submittedData, setSubmittedData] = useState(null);

  // Existing application state
  const [existingApp, setExistingApp] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [existingError, setExistingError] = useState('');

  const fetchExistingApplication = useCallback(() => {
    setLoadingExisting(true);
    setExistingError('');
    operatorsApi
      .getMyApplication()
      .then((res) => {
        if (res.data) setExistingApp(res.data);
      })
      .catch((err) => {
        console.warn('Could not check existing operator application:', err);
        setExistingError(getErrorMessage(err, 'Could not check your existing operator application.'));
      })
      .finally(() => setLoadingExisting(false));
  }, []);

  useEffect(() => {
    if (user) {
      setContactPerson(profile?.fullName || user.displayName || '');
      setEmail(user.email || '');
      setPhone(profile?.phone || '');

      fetchExistingApplication();
    }
  }, [user, profile, fetchExistingApplication]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const errors = {};
    if (!agencyName.trim()) errors.agencyName = 'Agency / business name is required.';
    if (!accreditationNumber.trim()) errors.accreditationNumber = 'DOT / LGU license number is required.';
    if (!contactPerson.trim()) errors.contactPerson = 'Primary contact person is required.';
    if (!email.trim()) errors.email = 'Business email is required.';
    if (!phone.trim()) errors.phone = 'Contact phone number is required.';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSubmitting(true);
      const res = await operatorsApi.apply({
        agencyName,
        accreditationNumber,
        contactPerson,
        email,
        phone,
        officeAddress,
        description,
      });

      setSubmittedData(res.data);
      setExistingApp(res.data);
      setExistingError('');
      notify.success('Operator application submitted. We will review it within 24–48 business hours.');
    } catch (err) {
      notify.error(err, 'Failed to submit operator application. Please verify your info.');
    } finally {
      setSubmitting(false);
    }
  };

  // Hide the form until we know whether the user already applied (avoids a form → status card flash)
  const checkingExisting = loadingExisting && !existingApp && !existingError;

  const fieldProps = (name) => ({
    id: `operator-${name}`,
    'aria-invalid': Boolean(formErrors[name]),
    'aria-describedby': formErrors[name] ? `operator-${name}-error` : undefined,
  });

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        {/* Header Hero */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold mb-3">
            <Compass className="h-3.5 w-3.5 mr-1 text-emerald-600 inline" /> Partner With Lakbay
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 font-heading">
            Expand Your Travel Agency & Tour Operations
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Join the Philippines' curated multi-day tour network. List your exclusive island adventures, manage departures, automate reservations, and verify traveler manifests with DOT accreditation compliance.
          </p>
        </div>

        {/* Existing Application Status: loading / error */}
        {checkingExisting && (
          <LoadingRegion label="Checking your operator application status" className="mb-10">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-hidden="true">
              <div className="flex items-start gap-3">
                <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-64 max-w-full" />
                  <Skeleton className="h-3 w-80 max-w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            </div>
          </LoadingRegion>
        )}

        {existingError && !existingApp && (
          <ErrorState
            className="mb-10"
            title="Unable to check application status"
            message={existingError}
            onRetry={fetchExistingApplication}
            retrying={loadingExisting}
          />
        )}

        {/* Existing Application Status Card */}
        {existingApp && (
          <div className="mb-10">
            <div
              className={`rounded-2xl p-6 border shadow-sm ${
                existingApp.status === 'approved'
                  ? 'bg-emerald-50/80 border-emerald-200'
                  : existingApp.status === 'rejected'
                  ? 'bg-red-50/80 border-red-200'
                  : 'bg-amber-50/80 border-amber-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  {existingApp.status === 'approved' ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                  ) : existingApp.status === 'rejected' ? (
                    <AlertCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900 font-heading">
                        Application Status: {existingApp.status?.toUpperCase()}
                      </h3>
                      <Badge
                        className={`text-xs uppercase font-bold border-none ${
                          existingApp.status === 'approved'
                            ? 'bg-emerald-600 text-white'
                            : existingApp.status === 'rejected'
                            ? 'bg-red-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        {existingApp.status}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-600 mt-1">
                      Agency: <strong className="text-slate-800">{existingApp.agencyName}</strong> (Accreditation: {existingApp.accreditationNumber})
                    </p>

                    {existingApp.status === 'pending' && (
                      <p className="text-xs text-amber-800 mt-2 font-medium">
                        Your application is currently being vetted by the Lakbay compliance team. Please allow 24–48 business hours for review.
                      </p>
                    )}

                    {existingApp.status === 'approved' && (
                      <p className="text-xs text-emerald-800 mt-2 font-medium">
                        Your Tour Operator account is active! You can now log into the Lakbay Operations Portal to create tour packages and manage departures.
                      </p>
                    )}

                    {existingApp.status === 'rejected' && (
                      <div className="mt-2 text-xs text-red-800">
                        <span className="font-bold">Reviewer Feedback:</span> {existingApp.reviewNotes || 'Credentials could not be verified at this time.'}
                      </div>
                    )}
                  </div>
                </div>

                {existingApp.status === 'approved' && (
                  <Button asChild className="shrink-0 font-bold text-xs gap-1.5 shadow-md">
                    <a href={import.meta.env.VITE_ADMIN_URL || 'http://localhost:3001'} target="_blank" rel="noopener noreferrer">
                      Go to Operator Portal <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm p-5">
            <Building2 className="h-7 w-7 text-emerald-600 mb-3" />
            <h3 className="font-bold text-slate-900 text-base font-heading">Direct Agency Ownership</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Create and manage your own tour packages, custom multi-day itineraries, pricing, and high-res photo showcases.
            </p>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm p-5">
            <Users className="h-7 w-7 text-emerald-600 mb-3" />
            <h3 className="font-bold text-slate-900 text-base font-heading">Manifests & Check-In</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Access real-time passenger manifests, passenger emergency contacts, dietary notes, and mobile check-in verification.
            </p>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm p-5">
            <ShieldCheck className="h-7 w-7 text-emerald-600 mb-3" />
            <h3 className="font-bold text-slate-900 text-base font-heading">DOT & LGU Verified</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Build customer trust with official accreditation badges, transparent reviews, and verified traveler feedback.
            </p>
          </Card>
        </div>

        {/* Operator Application Form */}
        {!checkingExisting && (!existingApp || existingApp.status === 'rejected') && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xl">
            <div className="mb-8">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block mb-1">
                Official Registration
              </span>
              <h2 className="text-2xl font-black text-slate-900 font-heading">
                Tour Operator Accreditation Form
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Please provide legitimate enterprise or agency credentials. Applications are vetted prior to activating package publication privileges.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Label htmlFor="operator-agencyName" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Agency / Business Name <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    {...fieldProps('agencyName')}
                    placeholder="e.g. Coron Island Escapes & Tours"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    required
                    className="h-10 text-sm"
                  />
                  <FieldError id="operator-agencyName-error">{formErrors.agencyName}</FieldError>
                </div>

                <div>
                  <Label htmlFor="operator-accreditationNumber" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    DOT / LGU License No. <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    {...fieldProps('accreditationNumber')}
                    placeholder="e.g. DOT-RO4B-TOP-2024-0012"
                    value={accreditationNumber}
                    onChange={(e) => setAccreditationNumber(e.target.value)}
                    required
                    className="h-10 text-sm"
                  />
                  <FieldError id="operator-accreditationNumber-error">{formErrors.accreditationNumber}</FieldError>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <Label htmlFor="operator-contactPerson" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Primary Contact Person <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    {...fieldProps('contactPerson')}
                    placeholder="Full name of representative"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    required
                    className="h-10 text-sm"
                  />
                  <FieldError id="operator-contactPerson-error">{formErrors.contactPerson}</FieldError>
                </div>

                <div>
                  <Label htmlFor="operator-email" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Official Business Email <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    {...fieldProps('email')}
                    type="email"
                    placeholder="agency@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-10 text-sm"
                  />
                  <FieldError id="operator-email-error">{formErrors.email}</FieldError>
                </div>

                <div>
                  <Label htmlFor="operator-phone" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Contact Phone Number <span className="text-red-600" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    {...fieldProps('phone')}
                    placeholder="+63 917 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="h-10 text-sm"
                  />
                  <FieldError id="operator-phone-error">{formErrors.phone}</FieldError>
                </div>
              </div>

              <div>
                <Label htmlFor="operator-officeAddress" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Office / Headquarters Address
                </Label>
                <Input
                  id="operator-officeAddress"
                  placeholder="Street Address, City / Municipality, Province"
                  value={officeAddress}
                  onChange={(e) => setOfficeAddress(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="operator-description" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Agency Overview & Tour Offerings
                </Label>
                <Textarea
                  id="operator-description"
                  rows={4}
                  placeholder="Describe your tour specialties, popular routes, licensed equipment (e.g. motorized outrigger boats, vans), and years in operation..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span className="text-[11px] text-slate-500">
                  By submitting, you certify that all business accreditation details provided are legitimate and current.
                </span>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="font-bold px-8 h-11 rounded-xl shadow-lg shadow-emerald-600/30 shrink-0 gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" aria-hidden="true" /> Submit Application
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
