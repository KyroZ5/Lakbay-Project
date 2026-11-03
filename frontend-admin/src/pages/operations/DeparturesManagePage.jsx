import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '../../components/ui/table';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { TableRowsSkeleton } from '../../components/common/Skeletons';
import { FieldError } from '../../components/common/FieldError';
import { notify, getErrorMessage } from '../../lib/notify';
import {
  Calendar,
  Plus,
  RefreshCw,
  Search,
  Edit2,
  AlertTriangle,
  UserCheck,
  XCircle,
  Clock,
  MapPin,
} from 'lucide-react';

// Timezone-safe YYYY-MM-DD helpers (business TZ: Asia/Manila). Avoids
// new Date('YYYY-MM-DD') UTC parsing and toISOString() day shifts.
const todayInManila = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const addDaysToDateStr = (dateStr, days) => {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Date.UTC(y, m - 1, d + (Number(days) || 0)));
  return dt.toISOString().slice(0, 10);
};

const durationOffset = (pkg) => Math.max(0, (Number(pkg?.durationDays) || 1) - 1);

export const DeparturesManagePage = () => {
  const [departures, setDepartures] = useState([]);
  const [packages, setPackages] = useState([]);
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [packageFilter, setPackageFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeparture, setEditingDeparture] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [cancellingDeparture, setCancellingDeparture] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Form
  const [formData, setFormData] = useState({
    packageId: '',
    departureDate: '',
    returnDate: '',
    departureTime: '07:00 AM',
    meetingPoint: '',
    bookingDeadlineHours: 24,
    capacity: 15,
    assignedGuideId: '',
    status: 'open',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [depsRes, pkgsRes, guidesRes] = await Promise.all([
        adminApi.getDepartures(),
        adminApi.getPackages({ limit: 200 }),
        adminApi.getGuides().catch(() => ({ data: [] })),
      ]);

      setDepartures(depsRes.data || depsRes || []);
      setPackages(pkgsRes.data || pkgsRes || []);
      setGuides(guidesRes.data || guidesRes || []);
    } catch (err) {
      console.error('[DeparturesManagePage] Error:', err);
      setError(getErrorMessage(err, 'Failed to load departure schedules.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingDeparture(null);
    setFormErrors({});
    const firstPkg = packages[0];
    const depStr = addDaysToDateStr(todayInManila(), 7);
    const retStr = firstPkg ? addDaysToDateStr(depStr, durationOffset(firstPkg)) : depStr;

    setFormData({
      packageId: firstPkg?.id || '',
      departureDate: depStr,
      returnDate: retStr,
      departureTime: '07:00 AM',
      meetingPoint: firstPkg?.locationName ? `${firstPkg.locationName} Main Pier / Terminal` : '',
      bookingDeadlineHours: 24,
      capacity: 15,
      assignedGuideId: '',
      status: 'open',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (dep) => {
    setEditingDeparture(dep);
    setFormErrors({});
    setFormData({
      packageId: dep.packageId || '',
      departureDate: dep.departureDate || '',
      returnDate: dep.returnDate || '',
      departureTime: dep.departureTime || '07:00 AM',
      meetingPoint: dep.meetingPoint || '',
      bookingDeadlineHours: dep.bookingDeadlineHours !== undefined ? Number(dep.bookingDeadlineHours) : 24,
      capacity: dep.capacity || 15,
      assignedGuideId: dep.assignedGuideId || '',
      status: dep.status || 'open',
    });
    setIsModalOpen(true);
  };

  // Auto-calculate return date when package or departure date changes
  const handlePackageChange = (pkgId) => {
    const pkg = packages.find((p) => p.id === pkgId);
    let retDate = formData.returnDate;
    if (pkg && formData.departureDate) {
      retDate = addDaysToDateStr(formData.departureDate, durationOffset(pkg));
    }
    setFormData({ ...formData, packageId: pkgId, returnDate: retDate });
  };

  const handleDateChange = (depDate) => {
    const pkg = packages.find((p) => p.id === formData.packageId);
    let retDate = depDate;
    if (pkg && depDate) {
      retDate = addDaysToDateStr(depDate, durationOffset(pkg));
    }
    setFormData({ ...formData, departureDate: depDate, returnDate: retDate });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const errors = {};
    // Package is required (previously enforced by the native select's `required`)
    if (!formData.packageId) {
      errors.packageId = 'Please select a tour package.';
    }
    // Capacity validation guard
    const capNum = Number(formData.capacity);
    if (!Number.isInteger(capNum) || capNum < 1) {
      errors.capacity = 'Capacity must be a whole number of at least 1.';
    } else if (editingDeparture && capNum < (editingDeparture.bookedCount || 0)) {
      errors.capacity = `Cannot reduce capacity to ${formData.capacity}. There are already ${editingDeparture.bookedCount} booked travelers.`;
    }
    if (formData.returnDate && formData.departureDate && formData.returnDate < formData.departureDate) {
      errors.returnDate = 'Return date cannot be before the departure date.';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      setSaving(true);
      const payload = {
        packageId: formData.packageId,
        departureDate: formData.departureDate,
        returnDate: formData.returnDate,
        departureTime: formData.departureTime || '07:00 AM',
        meetingPoint: formData.meetingPoint || '',
        bookingDeadlineHours: Number(formData.bookingDeadlineHours) || 24,
        capacity: Number(formData.capacity),
        assignedGuideId: formData.assignedGuideId || null,
        status: formData.status,
      };

      if (editingDeparture) {
        await adminApi.updateDeparture(editingDeparture.id, payload);
        notify.success(`Departure on ${payload.departureDate} updated.`);
      } else {
        await adminApi.createDeparture(payload);
        notify.success(`Departure on ${payload.departureDate} scheduled.`);
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      notify.error(err, 'Failed to save departure schedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelDeparture = async () => {
    if (!cancellingDeparture || cancelling) return;
    try {
      setCancelling(true);
      await adminApi.cancelDeparture(cancellingDeparture.id, cancelReason || 'Operational rescheduling');
      notify.success(`Departure on ${cancellingDeparture.departureDate} cancelled.`);
      setCancellingDeparture(null);
      setCancelReason('');
      fetchData();
    } catch (err) {
      notify.error(err, 'Failed to cancel departure.');
    } finally {
      setCancelling(false);
    }
  };

  // Backend has no persisted 'full' status — derive it from capacity for oversight
  const displayStatus = (dep) =>
    dep.status === 'open' && (dep.bookedCount || 0) >= (dep.capacity || 0) ? 'full' : dep.status;

  const filtered = departures.filter((dep) => {
    const matchesStatus = !statusFilter || displayStatus(dep) === statusFilter;
    const matchesPackage = !packageFilter || dep.packageId === packageFilter;
    return matchesStatus && matchesPackage;
  });

  const hasFilters = Boolean(statusFilter || packageFilter);
  const clearFilters = () => {
    setStatusFilter('');
    setPackageFilter('');
  };
  // Skeleton only on initial load; refreshes keep the current rows visible
  const showSkeleton = loading && departures.length === 0;
  const cancellingPackageName =
    (packages.find((p) => p.id === cancellingDeparture?.packageId) || cancellingDeparture?.package)?.name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Departure Schedules & Slots
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Schedule future tour departures, assign certified guides, and monitor capacity utilization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={openCreateModal} className="font-medium flex items-center gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            Schedule Departure
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={packageFilter || 'all'}
            onValueChange={(v) => setPackageFilter(v === 'all' ? '' : v)}
          >
            <SelectTrigger aria-label="Filter by tour package" className="w-auto min-w-[200px] text-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tour Packages</SelectItem>
              {packages.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter || 'all'}
            onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
          >
            <SelectTrigger aria-label="Filter by status" className="w-auto min-w-[200px] text-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open (Available)</SelectItem>
              <SelectItem value="full">Full (Capacity Reached)</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              aria-label="Refresh departure schedules"
              className="text-slate-500 hover:text-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>

      {error && <ErrorState message={error} onRetry={fetchData} retrying={loading} />}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" aria-busy={loading}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tour Package</TableHead>
              <TableHead>Schedule & Assembly</TableHead>
              <TableHead>Meeting Point & Cutoff</TableHead>
              <TableHead>Capacity & Bookings</TableHead>
              <TableHead>Assigned Guide</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              <TableRowsSkeleton rows={5} columns={['w-36', 'w-24', 'w-40', 'h-2 w-36', 'w-24', 'w-14', 'ml-auto w-16']} />
            ) : filtered.length === 0 ? (
              error ? null : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    {hasFilters ? (
                      <EmptyState
                        filtered
                        description="No departure dates found matching filters."
                        onClearFilters={clearFilters}
                      />
                    ) : (
                      <EmptyState
                        icon={Calendar}
                        title="No departures scheduled yet"
                        description="Schedule a tour departure to open slots for customer bookings."
                        action={
                          <Button size="sm" onClick={openCreateModal}>
                            <Plus className="mr-1.5 h-4 w-4" />
                            Schedule Departure
                          </Button>
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            ) : (
              filtered.map((dep) => {
                const pkg = packages.find((p) => p.id === dep.packageId) || dep.package;
                const guide = guides.find((g) => g.uid === dep.assignedGuideId || g.id === dep.assignedGuideId) ||
                  (dep.assignedGuideId && dep.assignedGuideName && dep.assignedGuideName !== 'Unassigned'
                    ? { fullName: dep.assignedGuideName }
                    : null);
                const booked = dep.bookedCount || 0;
                const capacity = dep.capacity || 15;
                const pct = Math.min(100, Math.round((booked / capacity) * 100));

                return (
                  <TableRow key={dep.id}>
                    <TableCell className="font-semibold text-slate-900">
                      <div>{pkg?.name || 'Tour Package'}</div>
                      <div className="text-xs text-slate-400 font-normal">
                        {pkg?.durationDays || 1} Days Trip
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">
                      <div className="font-medium flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {dep.departureDate}
                      </div>
                      <div className="text-xs text-slate-400">
                        Until {dep.returnDate || dep.departureDate}
                      </div>
                      <div className="text-xs text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {dep.departureTime || '07:00 AM'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-start gap-1 text-slate-800 text-xs font-medium max-w-[200px]" title={dep.meetingPoint}>
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="truncate">{dep.meetingPoint || 'Designated Harbor / Terminal'}</span>
                      </div>
                      <div className="mt-1">
                        {dep.isDeadlinePassed ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-normal">
                            Cutoff Passed (Rule D)
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            Cutoff: {dep.bookingDeadlineHours !== undefined ? dep.bookingDeadlineHours : 24}h prior
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="w-36 space-y-1">
                        <div className="flex justify-between text-xs font-medium text-slate-600">
                          <span>{booked} / {capacity} Booked</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 100 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {guide ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                          <span>{guide.fullName || guide.displayName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          displayStatus(dep) === 'open'
                            ? 'success'
                            : displayStatus(dep) === 'full'
                            ? 'warning'
                            : dep.status === 'completed'
                            ? 'info'
                            : 'destructive'
                        }
                        className="capitalize text-xs font-semibold"
                      >
                        {displayStatus(dep)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(dep)}
                              aria-label={`Edit departure on ${dep.departureDate}`}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-emerald-600"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Departure</TooltipContent>
                        </Tooltip>
                        {dep.status !== 'cancelled' && dep.status !== 'completed' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCancellingDeparture(dep);
                                  setCancelReason('');
                                }}
                                aria-label={`Cancel departure on ${dep.departureDate}`}
                                className="h-8 w-8 p-0 text-slate-600 hover:text-red-600"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cancel Departure</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Modal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !saving && setIsModalOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDeparture ? 'Edit Departure Schedule' : 'Schedule New Departure'}
            </DialogTitle>
            <DialogDescription>
              Assign packages, dates, passenger capacity, and lead tour guide.
            </DialogDescription>
          </DialogHeader>

          {editingDeparture && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                <strong>Capacity Safety Guard:</strong> Currently has{' '}
                <strong>{editingDeparture.bookedCount || 0} booked passenger(s)</strong>. Capacity cannot be reduced below this number.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dep-pkg" className="text-xs font-semibold">
                Tour Package *
              </Label>
              <Select
                value={formData.packageId}
                onValueChange={(v) => {
                  handlePackageChange(v);
                  setFormErrors((prev) => ({ ...prev, packageId: undefined }));
                }}
                disabled={Boolean(editingDeparture)}
              >
                <SelectTrigger
                  id="dep-pkg"
                  className="text-slate-700 disabled:bg-slate-100"
                  aria-invalid={Boolean(formErrors.packageId)}
                  aria-describedby={formErrors.packageId ? 'dep-pkg-error' : undefined}
                >
                  <SelectValue placeholder="Select Package" />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="dep-pkg-error">{formErrors.packageId}</FieldError>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dep-date" className="text-xs font-semibold">
                  Departure Date *
                </Label>
                <Input
                  id="dep-date"
                  type="date"
                  value={formData.departureDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ret-date" className="text-xs font-semibold">
                  Return Date *
                </Label>
                <Input
                  id="ret-date"
                  type="date"
                  value={formData.returnDate}
                  onChange={(e) => {
                    setFormData({ ...formData, returnDate: e.target.value });
                    setFormErrors((prev) => ({ ...prev, returnDate: undefined }));
                  }}
                  min={formData.departureDate || undefined}
                  required
                  aria-invalid={Boolean(formErrors.returnDate)}
                  aria-describedby={formErrors.returnDate ? 'ret-date-error' : undefined}
                />
                <FieldError id="ret-date-error">{formErrors.returnDate}</FieldError>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dep-time" className="text-xs font-semibold">
                  Assembly / Departure Time *
                </Label>
                <Input
                  id="dep-time"
                  type="text"
                  placeholder="e.g. 06:30 AM"
                  value={formData.departureTime}
                  onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dep-deadline" className="text-xs font-semibold">
                  Booking Cutoff (Rule D) *
                </Label>
                <Select
                  value={String(formData.bookingDeadlineHours)}
                  onValueChange={(v) => setFormData({ ...formData, bookingDeadlineHours: Number(v) })}
                >
                  <SelectTrigger id="dep-deadline" className="text-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12 Hours Before</SelectItem>
                    <SelectItem value="24">24 Hours Before (Standard)</SelectItem>
                    <SelectItem value="48">48 Hours Before (2 Days)</SelectItem>
                    <SelectItem value="72">72 Hours Before (3 Days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dep-meeting" className="text-xs font-semibold">
                Meeting Point & Landmark *
              </Label>
              <Input
                id="dep-meeting"
                type="text"
                placeholder="e.g. El Nido Port Terminal Gate 2 or Hotel Lobby"
                value={formData.meetingPoint}
                onChange={(e) => setFormData({ ...formData, meetingPoint: e.target.value })}
                required
              />
              <p className="text-[11px] text-slate-400">
                Printed on confirmed customer booking vouchers and receipts.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dep-cap" className="text-xs font-semibold">
                  Total Capacity *
                </Label>
                <Input
                  id="dep-cap"
                  type="number"
                  min={editingDeparture?.bookedCount || 1}
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  required
                  aria-invalid={Boolean(formErrors.capacity)}
                  aria-describedby={formErrors.capacity ? 'dep-cap-error' : undefined}
                />
                <FieldError id="dep-cap-error">{formErrors.capacity}</FieldError>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dep-status" className="text-xs font-semibold">
                  Status
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger id="dep-status" className="text-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    {/* Cancelling must go through the Cancel action so affected customers are notified */}
                    {formData.status === 'cancelled' && (
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    )}
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dep-guide" className="text-xs font-semibold">
                Assigned Tour Guide
              </Label>
              <Select
                value={formData.assignedGuideId || 'none'}
                onValueChange={(v) => setFormData({ ...formData, assignedGuideId: v === 'none' ? '' : v })}
              >
                <SelectTrigger id="dep-guide" className="text-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- No Guide Assigned Yet --</SelectItem>
                  {guides.map((g) => (
                    <SelectItem key={g.uid || g.id} value={String(g.uid || g.id)}>
                      {g.fullName || g.displayName} ({g.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : editingDeparture ? 'Update Schedule' : 'Schedule Departure'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Departure Confirmation */}
      <ConfirmDialog
        open={Boolean(cancellingDeparture)}
        onOpenChange={(open) => !open && setCancellingDeparture(null)}
        title="Cancel departure schedule?"
        description={
          <>
            Are you sure you want to cancel the{' '}
            {cancellingPackageName && <strong className="text-slate-800">{cancellingPackageName}</strong>}{' '}
            departure scheduled for <strong className="text-slate-800">{cancellingDeparture?.departureDate}</strong>?
          </>
        }
        confirmLabel="Confirm Cancellation"
        loadingLabel="Cancelling..."
        cancelLabel="Back"
        loading={cancelling}
        onConfirm={handleCancelDeparture}
      >
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason" className="text-xs font-semibold">
            Cancellation Reason (Logged in activity logs)
          </Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            placeholder="e.g. Inclement weather advisory from PAGASA, operational maintenance..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            disabled={cancelling}
            className="p-2.5"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
};
