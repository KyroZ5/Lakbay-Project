import React, { useState, useEffect } from 'react';
import { customerApi } from '../../api/customerApi';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { LoadingRegion } from '../../components/common/Skeletons';
import { FieldError } from '../../components/common/FieldError';
import { notify, getErrorMessage } from '../../lib/notify';
import { Plus, Trash2, Edit2, Loader2, HeartHandshake } from 'lucide-react';

const RELATIONSHIP_OPTIONS = [
  { value: 'Spouse / Partner', label: 'Spouse / Partner' },
  { value: 'Child / Dependant', label: 'Child / Dependant' },
  { value: 'Parent', label: 'Parent' },
  { value: 'Friend', label: 'Friend' },
  { value: 'Colleague', label: 'Colleague' },
  { value: 'Companion', label: 'Other Companion' },
];

export const CoTravelersPage = () => {
  const [coTravelers, setCoTravelers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [relationship, setRelationship] = useState('Companion');
  const [dietaryOrMedicalNotes, setDietaryOrMedicalNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Delete confirmation state
  const [companionToDelete, setCompanionToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCoTravelers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await customerApi.getCoTravelers();
      setCoTravelers(res.data || []);
    } catch (err) {
      console.error('Fetch co-travelers error:', err);
      setError(getErrorMessage(err, 'Failed to load companion profiles.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoTravelers();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFullName('');
    setBirthDate('');
    setRelationship('Companion');
    setDietaryOrMedicalNotes('');
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleOpenEdit = (ct) => {
    setEditingId(ct.id);
    setFullName(ct.fullName || '');
    setBirthDate(ct.birthDate || '');
    setRelationship(ct.relationship || 'Companion');
    setDietaryOrMedicalNotes(ct.dietaryOrMedicalNotes || '');
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!fullName.trim()) {
      setFormErrors({ fullName: 'Full name is required.' });
      return;
    }

    setSaving(true);
    setFormErrors({});

    try {
      const payload = {
        fullName,
        birthDate,
        relationship,
        dietaryOrMedicalNotes,
      };

      if (editingId) {
        await customerApi.updateCoTraveler(editingId, payload);
      } else {
        await customerApi.createCoTraveler(payload);
      }

      await fetchCoTravelers();
      notify.success(editingId ? `${fullName}'s profile updated.` : `${fullName} added to your co-travelers.`);
      setDialogOpen(false);
    } catch (err) {
      notify.error(err, 'Failed to save companion profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!companionToDelete || deleting) return;
    setDeleting(true);
    try {
      await customerApi.deleteCoTraveler(companionToDelete.id);
      await fetchCoTravelers();
      notify.success(`${companionToDelete.fullName} removed from your co-travelers.`);
      setCompanionToDelete(null);
    } catch (err) {
      notify.error(err, 'Failed to delete companion.');
    } finally {
      setDeleting(false);
    }
  };

  // Skeleton only on initial load; refreshes keep the current cards visible
  const showSkeleton = loading && coTravelers.length === 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 font-heading">
            Saved Co-Travelers
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Save family and friends profiles to quickly auto-fill traveler manifests during checkout.
          </p>
        </div>

        <Button onClick={handleOpenAdd} className="font-bold text-xs">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Co-Traveler
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={fetchCoTravelers} retrying={loading} />}

      {showSkeleton ? (
        <LoadingRegion label="Loading companion profiles" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} aria-hidden="true" className="rounded-2xl border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3 w-28" />
                <Skeleton className="mt-3 h-10 w-full rounded-lg" />
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </LoadingRegion>
      ) : coTravelers.length === 0 ? (
        error ? null : (
          <Card className="rounded-2xl border-slate-200">
            <EmptyState
              icon={HeartHandshake}
              title="No companion profiles saved yet"
              description="Add frequent companions such as your spouse, children, or friends for instant one-click booking autofill."
              action={
                <Button onClick={handleOpenAdd} size="sm" className="text-xs">
                  Add Your First Companion
                </Button>
              }
            />
          </Card>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {coTravelers.map((ct) => (
            <Card key={ct.id} className="rounded-2xl border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-base">{ct.fullName}</span>
                    <Badge variant="outline" className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border-emerald-200">
                      {ct.relationship || 'Companion'}
                    </Badge>
                  </div>

                  {ct.birthDate && (
                    <p className="text-xs text-slate-500 mb-1">
                      Born: <span className="font-medium text-slate-700">{ct.birthDate}</span>
                    </p>
                  )}

                  {ct.dietaryOrMedicalNotes ? (
                    <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="font-bold text-slate-700">Notes: </span>
                      {ct.dietaryOrMedicalNotes}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(ct)}
                    aria-label={`Edit ${ct.fullName}`}
                    className="h-8 text-xs text-slate-600 hover:text-slate-900"
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCompanionToDelete(ct)}
                    aria-label={`Delete ${ct.fullName}`}
                    className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Companion Profile' : 'Add New Co-Traveler'}</DialogTitle>
            <DialogDescription className="sr-only">
              Saved companions can be used to auto-fill traveler details during checkout.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 my-2" noValidate>
            <div>
              <Label htmlFor="ct-full-name" className="text-xs font-semibold text-slate-700">
                Full Name <span className="text-red-600" aria-hidden="true">*</span>
              </Label>
              <Input
                id="ct-full-name"
                type="text"
                required
                placeholder="Maria Santos"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={Boolean(formErrors.fullName)}
                aria-describedby={formErrors.fullName ? 'ct-full-name-error' : undefined}
                className="mt-1"
              />
              <div className="mt-1">
                <FieldError id="ct-full-name-error">{formErrors.fullName}</FieldError>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ct-birthdate" className="text-xs font-semibold text-slate-700">Birthdate</Label>
                <Input
                  id="ct-birthdate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="ct-relationship" className="text-xs font-semibold text-slate-700">Relationship</Label>
                <Select value={relationship} onValueChange={setRelationship}>
                  <SelectTrigger id="ct-relationship" className="mt-1 h-10 text-xs font-medium text-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Keep a legacy/unknown stored value selectable so it isn't silently replaced */}
                    {!RELATIONSHIP_OPTIONS.some((o) => o.value === relationship) && relationship && (
                      <SelectItem value={relationship}>{relationship}</SelectItem>
                    )}
                    {RELATIONSHIP_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="ct-notes" className="text-xs font-semibold text-slate-700">Dietary or Medical Notes</Label>
              <Textarea
                id="ct-notes"
                rows={2}
                placeholder="Allergies (e.g. seafood, peanuts), vegetarian, wheelchair assistance, etc."
                value={dietaryOrMedicalNotes}
                onChange={(e) => setDietaryOrMedicalNotes(e.target.value)}
                className="mt-1 min-h-0 p-2.5 text-xs text-slate-800"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="text-xs font-bold">
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : editingId ? 'Update Companion' : 'Save Companion'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(companionToDelete)}
        onOpenChange={(open) => !open && setCompanionToDelete(null)}
        title="Delete companion profile?"
        description={
          companionToDelete
            ? `${companionToDelete.fullName} will be removed from your saved co-travelers. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Companion"
        loadingLabel="Deleting..."
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
};
