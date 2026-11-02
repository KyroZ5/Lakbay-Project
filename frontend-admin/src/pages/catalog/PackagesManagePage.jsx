import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
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
import { ImageUpload } from '../../components/common/ImageUpload';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { TableRowsSkeleton } from '../../components/common/Skeletons';
import { FieldError } from '../../components/common/FieldError';
import { notify, getErrorMessage } from '../../lib/notify';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Package,
  Check,
  Clock,
  Info,
  Building2,
  XCircle,
  Loader2,
  X,
} from 'lucide-react';

const ALL_DESTINATIONS = 'all';

export const PackagesManagePage = () => {
  const { role } = useStaffAuth();
  const [packages, setPackages] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [destFilter, setDestFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending_approval' | 'approved' | 'rejected'

  // Approval / Moderation State
  const [approvingId, setApprovingId] = useState(null);
  const [rejectModalPkg, setRejectModalPkg] = useState(null);
  const [rejectReason, setRejectReason] = useState('Tour details or compliance documents require revision.');
  const [isRejecting, setIsRejecting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    destinationId: '',
    category: 'Island Hopping',
    description: '',
    pricePerPerson: '',
    discountPercent: 0,
    durationDays: 3,
    durationNights: 2,
    cancellationCutoffDays: 7,
    inclusions: '',
    exclusions: '',
    imageUrls: '',
    isPublished: true,
    isFeatured: false,
    itinerary: [
      {
        dayNumber: 1,
        dayTitle: 'Arrival & Welcome',
        activities: [
          { timeSlot: '09:00 AM', activityName: 'Hotel check-in & Briefing', locationName: '', description: '' },
        ],
      },
    ],
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [pkgRes, destRes] = await Promise.all([
        adminApi.getPackages(),
        adminApi.getDestinations(),
      ]);
      setPackages(pkgRes.data || pkgRes || []);
      setDestinations(destRes.data || destRes || []);
    } catch (err) {
      console.error('[PackagesManagePage] Fetch error:', err);
      setError(getErrorMessage(err, 'Failed to load packages.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatPHP = (val) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(val || 0);

  const openCreateModal = () => {
    setEditingPackage(null);
    setFormErrors({});
    setFormData({
      name: '',
      destinationId: destinations[0]?.id || '',
      category: 'Island Hopping',
      description: '',
      pricePerPerson: '',
      discountPercent: 0,
      durationDays: 3,
      durationNights: 2,
      cancellationCutoffDays: 7,
      inclusions: 'Boat transfers, Environmental fees, Licensed tour guide, Buffet lunch',
      exclusions: 'Personal travel insurance, Souvenirs, Gratuities',
      imageUrls: '',
      isPublished: true,
      isFeatured: false,
      itinerary: [
        {
          dayNumber: 1,
          dayTitle: 'Arrival & Island Exploration',
          activities: [
            { timeSlot: '08:30 AM', activityName: 'Meet & Greet', locationName: '', description: '' },
          ],
        },
      ],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (pkg) => {
    setEditingPackage(pkg);
    setFormErrors({});
    setFormData({
      name: pkg.name || '',
      destinationId: pkg.destinationId || '',
      category: pkg.category || 'Island Hopping',
      description: pkg.description || '',
      pricePerPerson: pkg.pricePerPerson?.toString() || '',
      discountPercent: pkg.discountPercent || 0,
      durationDays: pkg.durationDays || 1,
      durationNights: pkg.durationNights || 0,
      cancellationCutoffDays: pkg.cancellationCutoffDays || 7,
      inclusions: (pkg.inclusions || []).join(', '),
      exclusions: (pkg.exclusions || []).join(', '),
      imageUrls: (pkg.imageUrls || []).join('\n'),
      isPublished: Boolean(pkg.isPublished),
      isFeatured: Boolean(pkg.isFeatured),
      itinerary: pkg.itinerary && pkg.itinerary.length > 0
        ? pkg.itinerary
        : [
            {
              dayNumber: 1,
              dayTitle: 'Day 1 Itinerary',
              activities: [{ timeSlot: '09:00 AM', activityName: 'Sightseeing', locationName: '', description: '' }],
            },
          ],
    });
    setIsModalOpen(true);
  };

  // Itinerary builder handlers
  const addDay = () => {
    const nextDayNum = formData.itinerary.length + 1;
    setFormData({
      ...formData,
      itinerary: [
        ...formData.itinerary,
        {
          dayNumber: nextDayNum,
          dayTitle: `Day ${nextDayNum} Excursion`,
          activities: [{ timeSlot: '09:00 AM', activityName: 'Activity', locationName: '', description: '' }],
        },
      ],
    });
  };

  const removeDay = (index) => {
    const updated = formData.itinerary.filter((_, i) => i !== index);
    setFormData({ ...formData, itinerary: updated });
  };

  const updateDayTitle = (index, title) => {
    const updated = [...formData.itinerary];
    updated[index].dayTitle = title;
    setFormData({ ...formData, itinerary: updated });
  };

  const addActivity = (dayIndex) => {
    const updated = [...formData.itinerary];
    updated[dayIndex].activities.push({
      timeSlot: '12:00 PM',
      activityName: 'New Activity',
      locationName: '',
      description: '',
    });
    setFormData({ ...formData, itinerary: updated });
  };

  const updateActivityField = (dayIndex, actIndex, field, value) => {
    const updated = [...formData.itinerary];
    updated[dayIndex].activities[actIndex][field] = value;
    setFormData({ ...formData, itinerary: updated });
  };

  const removeActivity = (dayIndex, actIndex) => {
    const updated = [...formData.itinerary];
    updated[dayIndex].activities = updated[dayIndex].activities.filter((_, i) => i !== actIndex);
    setFormData({ ...formData, itinerary: updated });
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Package name is required.';
    if (!formData.destinationId) errors.destinationId = 'Destination is required.';
    if (!formData.pricePerPerson) errors.pricePerPerson = 'Price per person is required.';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      setSaving(true);
      const payload = {
        name: formData.name.trim(),
        destinationId: formData.destinationId,
        category: formData.category,
        description: formData.description,
        pricePerPerson: Number(formData.pricePerPerson),
        discountPercent: Number(formData.discountPercent) || 0,
        durationDays: Number(formData.durationDays),
        durationNights: Number(formData.durationNights),
        cancellationCutoffDays: Number(formData.cancellationCutoffDays),
        inclusions: formData.inclusions.split(',').map((s) => s.trim()).filter(Boolean),
        exclusions: formData.exclusions.split(',').map((s) => s.trim()).filter(Boolean),
        imageUrls: formData.imageUrls.split('\n').map((s) => s.trim()).filter(Boolean),
        itinerary: formData.itinerary,
        isPublished: formData.isPublished,
        isFeatured: formData.isFeatured,
      };

      if (editingPackage) {
        await adminApi.updatePackage(editingPackage.id, payload);
        notify.success(`Package "${payload.name}" updated.`);
      } else {
        await adminApi.createPackage(payload);
        notify.success(`Package "${payload.name}" created.`);
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      notify.error(err, 'Failed to save tour package.');
    } finally {
      setSaving(false);
    }
  };

  // Toggle publish
  const handleTogglePublish = async (pkg) => {
    if (togglingId) return;
    try {
      setTogglingId(pkg.id);
      const updated = !pkg.isPublished;
      await adminApi.updatePackage(pkg.id, { isPublished: updated });
      setPackages((prev) =>
        prev.map((p) => (p.id === pkg.id ? { ...p, isPublished: updated } : p))
      );
      notify.success(updated ? `"${pkg.name}" is now live.` : `"${pkg.name}" moved to draft.`);
    } catch (err) {
      notify.error(err, 'Failed to update published status.');
    } finally {
      setTogglingId(null);
    }
  };

  // Tour Approval (Admin / Coordinator)
  const handleApprovePackage = async (pkg) => {
    const packageId = pkg.id;
    if (approvingId) return;
    try {
      setApprovingId(packageId);
      await adminApi.approvePackage(packageId);
      setPackages((prev) =>
        prev.map((p) =>
          p.id === packageId ? { ...p, approvalStatus: 'approved', isPublished: true } : p
        )
      );
      notify.success(`"${pkg.name}" approved and published.`);
    } catch (err) {
      notify.error(err, 'Failed to approve package.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectPackageConfirm = async () => {
    if (!rejectModalPkg) return;
    try {
      setIsRejecting(true);
      await adminApi.rejectPackage(rejectModalPkg.id, rejectReason);
      setPackages((prev) =>
        prev.map((p) =>
          p.id === rejectModalPkg.id
            ? { ...p, approvalStatus: 'rejected', isPublished: false, rejectionReason: rejectReason }
            : p
        )
      );
      notify.success(`"${rejectModalPkg.name}" rejected. Feedback sent to the operator.`);
      setRejectModalPkg(null);
    } catch (err) {
      notify.error(err, 'Failed to reject package.');
    } finally {
      setIsRejecting(false);
    }
  };

  // Delete
  const confirmDelete = async () => {
    if (!packageToDelete) return;
    try {
      setIsDeleting(true);
      await adminApi.deletePackage(packageToDelete.id);
      notify.success(`Package "${packageToDelete.name}" deleted.`);
      setPackageToDelete(null);
      fetchData();
    } catch (err) {
      notify.error(err, 'Failed to delete package.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = packages.filter((pkg) => {
    const matchesSearch =
      !search ||
      pkg.name?.toLowerCase().includes(search.toLowerCase()) ||
      pkg.destinationName?.toLowerCase().includes(search.toLowerCase()) ||
      pkg.operatorName?.toLowerCase().includes(search.toLowerCase());
    const matchesDest = !destFilter || pkg.destinationId === destFilter;
    const matchesStatus =
      !statusFilter || statusFilter === 'all'
        ? true
        : (pkg.approvalStatus || 'approved') === statusFilter;
    return matchesSearch && matchesDest && matchesStatus;
  });

  const clearFilters = () => {
    setSearch('');
    setDestFilter('');
    setStatusFilter('all');
  };

  // Skeleton only on initial load; refreshes keep the current rows visible
  const showSkeleton = loading && packages.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-heading">
            {role === 'operator' ? 'My Tour Packages' : 'Tour Packages Catalog'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {role === 'operator'
              ? 'Create, manage, and submit tour packages for compliance approval.'
              : 'Manage multi-day itineraries, pricing, inclusions, and publication visibility.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={openCreateModal} className="font-medium flex items-center gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            Create Tour Package
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search package name or operator..."
            aria-label="Search packages"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filter by approval status" className="w-[170px] text-slate-700">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={destFilter || ALL_DESTINATIONS}
            onValueChange={(v) => setDestFilter(v === ALL_DESTINATIONS ? '' : v)}
          >
            <SelectTrigger aria-label="Filter by destination" className="w-[180px] text-slate-700">
              <SelectValue placeholder="All Destinations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_DESTINATIONS}>All Destinations</SelectItem>
              {destinations.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchData}
                disabled={loading}
                aria-label="Refresh packages"
                className="text-slate-500 hover:text-slate-800"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Error State */}
      {error && <ErrorState message={error} onRetry={fetchData} retrying={loading} />}

      {/* Packages Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" aria-busy={loading}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Preview</TableHead>
              <TableHead>Package Name</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Price / Person</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              <TableRowsSkeleton
                rows={5}
                columns={['h-10 w-12', 'w-44', 'w-28', 'w-14', 'w-20', 'w-16', 'ml-auto w-16']}
              />
            ) : filtered.length === 0 ? (
              error ? null : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    {packages.length > 0 ? (
                      <EmptyState filtered onClearFilters={clearFilters} />
                    ) : (
                      <EmptyState
                        icon={Package}
                        title="No tour packages yet"
                        description={
                          role === 'operator'
                            ? 'Create your first tour package and submit it for compliance approval.'
                            : 'Create your first tour package to start building the catalog.'
                        }
                        action={
                          <Button size="sm" onClick={openCreateModal}>
                            <Plus className="mr-1.5 h-4 w-4" />
                            Create Tour Package
                          </Button>
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            ) : (
              filtered.map((pkg) => {
                const dest = destinations.find((d) => d.id === pkg.destinationId);
                return (
                  <TableRow key={pkg.id}>
                    <TableCell>
                      {pkg.imageUrls?.[0] ? (
                        <img
                          src={pkg.imageUrls[0]}
                          alt={pkg.name}
                          className="h-10 w-12 rounded object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="flex h-10 w-12 items-center justify-center rounded bg-slate-100 text-slate-400">
                          <Package className="h-4 w-4" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{pkg.name}</span>
                        {pkg.isFeatured && (
                          <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                            Featured
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-normal">
                        {pkg.category} &bull; {pkg.cancellationCutoffDays || 7}-day refund cutoff
                      </div>
                      {pkg.operatorName && pkg.operatorId !== 'platform' && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                            <Building2 className="h-2.5 w-2.5 text-emerald-600" />
                            {pkg.operatorName}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {dest?.name || pkg.destinationName || 'Destination'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 font-medium">
                      {pkg.durationDays}D / {pkg.durationNights || 0}N
                    </TableCell>
                    <TableCell className="text-slate-900">
                      {pkg.discountPercent > 0 ? (
                        <div>
                          <div className="font-bold text-emerald-700 flex items-center gap-1.5">
                            {formatPHP(pkg.effectivePrice || pkg.discountPrice)}
                            <span className="text-[10px] font-extrabold bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded">
                              -{pkg.discountPercent}%
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 line-through">
                            {formatPHP(pkg.pricePerPerson)}
                          </div>
                        </div>
                      ) : (
                        <span className="font-bold">{formatPHP(pkg.pricePerPerson)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {pkg.approvalStatus === 'pending_approval' ? (
                        <Badge className="bg-amber-100 text-amber-800 border-none font-semibold text-[10px] flex items-center gap-1 w-fit">
                          <Clock className="h-2.5 w-2.5" /> Pending Review
                        </Badge>
                      ) : pkg.approvalStatus === 'rejected' ? (
                        pkg.rejectionReason ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                tabIndex={0}
                                className="inline-block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <Badge className="bg-red-100 text-red-800 border-none font-semibold text-[10px] flex items-center gap-1 w-fit">
                                  <XCircle className="h-2.5 w-2.5" /> Rejected
                                  <span className="sr-only">: {pkg.rejectionReason}</span>
                                </Badge>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs whitespace-normal">
                              {pkg.rejectionReason}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-none font-semibold text-[10px] flex items-center gap-1 w-fit">
                            <XCircle className="h-2.5 w-2.5" /> Rejected
                          </Badge>
                        )
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleTogglePublish(pkg)}
                              disabled={togglingId === pkg.id}
                              aria-label={`${pkg.isPublished ? 'Unpublish' : 'Publish'} ${pkg.name}`}
                              className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                            >
                              {pkg.isPublished ? (
                                <Badge variant="success" className="flex items-center gap-1">
                                  <Check className="h-3 w-3" /> Live
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-500 border-slate-300">
                                  Draft (Hidden)
                                </Badge>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Click to toggle publish status</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Admin / Coordinator Approval Quick Actions */}
                        {['admin', 'coordinator'].includes(role) && pkg.approvalStatus === 'pending_approval' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprovePackage(pkg)}
                              disabled={approvingId === pkg.id}
                              aria-label={approvingId === pkg.id ? `Approving ${pkg.name}` : `Approve ${pkg.name}`}
                              className="h-7 text-[11px] gap-1"
                            >
                              {approvingId === pkg.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-3 w-3" /> Approve
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRejectModalPkg(pkg)}
                              aria-label={`Reject ${pkg.name}`}
                              className="h-7 text-[11px] text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 gap-1"
                            >
                              <XCircle className="h-3 w-3" /> Reject
                            </Button>
                          </>
                        )}

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(pkg)}
                              aria-label={`Edit ${pkg.name}`}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-emerald-600"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit package</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPackageToDelete(pkg)}
                              aria-label={`Delete ${pkg.name}`}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete package</TooltipContent>
                        </Tooltip>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingPackage ? 'Edit Tour Package' : 'Create New Tour Package'}
            </DialogTitle>
            <DialogDescription>
              Configure duration, pricing, inclusions, and multi-day itinerary.
            </DialogDescription>
          </DialogHeader>

          {editingPackage && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-800 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Price Preservation:</strong> Changing the base price here only applies to future reservations. Existing bookings maintain their locked historical price.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 py-2" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pkg-name" className="text-xs font-semibold">
                  Package Title *
                </Label>
                <Input
                  id="pkg-name"
                  placeholder="e.g. El Nido Ultimate Island Hopping Expedition"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  aria-invalid={Boolean(formErrors.name)}
                  aria-describedby={formErrors.name ? 'pkg-name-error' : undefined}
                />
                <FieldError id="pkg-name-error">{formErrors.name}</FieldError>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pkg-dest" className="text-xs font-semibold">
                  Destination *
                </Label>
                <Select
                  value={formData.destinationId ? String(formData.destinationId) : ''}
                  onValueChange={(v) => setFormData({ ...formData, destinationId: v })}
                >
                  <SelectTrigger
                    id="pkg-dest"
                    className="text-slate-700"
                    aria-required="true"
                    aria-invalid={Boolean(formErrors.destinationId)}
                    aria-describedby={formErrors.destinationId ? 'pkg-dest-error' : undefined}
                  >
                    <SelectValue placeholder="Select Destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinations.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name} ({d.region})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError id="pkg-dest-error">{formErrors.destinationId}</FieldError>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pkg-price" className="text-xs font-semibold">
                  Price per Person (PHP) *
                </Label>
                <Input
                  id="pkg-price"
                  type="number"
                  placeholder="12500"
                  value={formData.pricePerPerson}
                  onChange={(e) => setFormData({ ...formData, pricePerPerson: e.target.value })}
                  required
                  aria-invalid={Boolean(formErrors.pricePerPerson)}
                  aria-describedby={formErrors.pricePerPerson ? 'pkg-price-error' : undefined}
                />
                <FieldError id="pkg-price-error">{formErrors.pricePerPerson}</FieldError>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pkg-discount" className="text-xs font-semibold">
                    Discount (%)
                  </Label>
                  {Number(formData.discountPercent) > 0 && Number(formData.pricePerPerson) > 0 && (
                    <span className="text-[10px] font-bold text-emerald-600">
                      Pays {formatPHP(Math.round(Number(formData.pricePerPerson) * (1 - Number(formData.discountPercent) / 100)))}
                    </span>
                  )}
                </div>
                <Input
                  id="pkg-discount"
                  type="number"
                  min="0"
                  max="90"
                  placeholder="0 (e.g. 15 for 15% off)"
                  value={formData.discountPercent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discountPercent: Math.max(0, Math.min(90, parseInt(e.target.value) || 0)),
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pkg-days" className="text-xs font-semibold">
                  Duration (Days / Nights)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="pkg-days"
                    type="number"
                    min="1"
                    aria-label="Duration days"
                    placeholder="Days"
                    value={formData.durationDays}
                    onChange={(e) =>
                      setFormData({ ...formData, durationDays: parseInt(e.target.value) || 1 })
                    }
                  />
                  <Input
                    type="number"
                    min="0"
                    aria-label="Duration nights"
                    placeholder="Nights"
                    value={formData.durationNights}
                    onChange={(e) =>
                      setFormData({ ...formData, durationNights: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pkg-cutoff" className="text-xs font-semibold">
                  Refund Cutoff (Days)
                </Label>
                <Input
                  id="pkg-cutoff"
                  type="number"
                  min="1"
                  placeholder="7"
                  value={formData.cancellationCutoffDays}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cancellationCutoffDays: parseInt(e.target.value) || 7,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pkg-desc" className="text-xs font-semibold">
                Overview & Description
              </Label>
              <Textarea
                id="pkg-desc"
                rows={2}
                placeholder="Comprehensive tour description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-0"
              />
            </div>

            {/* Inclusions and Exclusions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pkg-inc" className="text-xs font-semibold">
                  Inclusions (Comma-separated)
                </Label>
                <Textarea
                  id="pkg-inc"
                  rows={2}
                  placeholder="Boat transfers, Environmental fees, Buffet lunch"
                  value={formData.inclusions}
                  onChange={(e) => setFormData({ ...formData, inclusions: e.target.value })}
                  className="min-h-0 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pkg-exc" className="text-xs font-semibold">
                  Exclusions (Comma-separated)
                </Label>
                <Textarea
                  id="pkg-exc"
                  rows={2}
                  placeholder="Airfare, Personal expenses, Travel insurance"
                  value={formData.exclusions}
                  onChange={(e) => setFormData({ ...formData, exclusions: e.target.value })}
                  className="min-h-0 text-xs"
                />
              </div>
            </div>

            {/* Daily Itinerary Builder */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Day-by-Day Itinerary Builder
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Define scheduled activities and stops. Location names are auto-geocoded for the customer map.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDay}
                  className="h-7 text-xs bg-white text-emerald-700 border-emerald-300"
                >
                  <Plus className="mr-1 h-3 w-3" /> Add Day
                </Button>
              </div>

              <div className="space-y-4">
                {formData.itinerary.map((day, dayIdx) => (
                  <div key={dayIdx} className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 max-w-md">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                          {dayIdx + 1}
                        </span>
                        <Input
                          aria-label={`Day ${dayIdx + 1} title`}
                          value={day.dayTitle}
                          onChange={(e) => updateDayTitle(dayIdx, e.target.value)}
                          placeholder={`Day ${dayIdx + 1} Title`}
                          className="h-8 text-xs font-semibold"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addActivity(dayIdx)}
                          className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
                        >
                          + Activity
                        </Button>
                        {formData.itinerary.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDay(dayIdx)}
                            className="h-7 text-xs text-red-500 hover:text-red-700"
                          >
                            Remove Day
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Activities List */}
                    <div className="space-y-2 pl-6 border-l-2 border-emerald-100">
                      {day.activities.map((act, actIdx) => (
                        <div key={actIdx} className="grid grid-cols-12 gap-2 items-center">
                          <Input
                            aria-label={`Day ${dayIdx + 1} activity ${actIdx + 1} time`}
                            placeholder="09:00 AM"
                            value={act.timeSlot}
                            onChange={(e) =>
                              updateActivityField(dayIdx, actIdx, 'timeSlot', e.target.value)
                            }
                            className="col-span-3 h-7 text-xs"
                          />
                          <Input
                            aria-label={`Day ${dayIdx + 1} activity ${actIdx + 1} name`}
                            placeholder="Activity name"
                            value={act.activityName}
                            onChange={(e) =>
                              updateActivityField(dayIdx, actIdx, 'activityName', e.target.value)
                            }
                            className="col-span-4 h-7 text-xs"
                          />
                          <Input
                            aria-label={`Day ${dayIdx + 1} activity ${actIdx + 1} location`}
                            placeholder="Location / Spot"
                            value={act.locationName}
                            onChange={(e) =>
                              updateActivityField(dayIdx, actIdx, 'locationName', e.target.value)
                            }
                            className="col-span-4 h-7 text-xs"
                          />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeActivity(dayIdx, actIdx)}
                                aria-label={`Remove day ${dayIdx + 1} activity ${actIdx + 1}`}
                                className="col-span-1 h-7 w-7 justify-self-center text-slate-400 hover:text-red-500"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remove activity</TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Images */}
            <ImageUpload
              folder="packages"
              label="Tour Package Photos (Direct Upload)"
              value={formData.imageUrls}
              onChange={(urls) => setFormData({ ...formData, imageUrls: urls.join('\n') })}
              maxFiles={10}
            />

            {/* Visibility Toggles */}
            <div className="flex flex-wrap items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="pkg-published"
                  checked={formData.isPublished}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPublished: checked })}
                />
                <Label
                  htmlFor="pkg-published"
                  className="text-sm font-medium normal-case tracking-normal text-slate-700 cursor-pointer"
                >
                  Published (Visible on Customer Catalog)
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="pkg-featured"
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
                />
                <Label
                  htmlFor="pkg-featured"
                  className="text-sm font-medium normal-case tracking-normal text-slate-700 cursor-pointer"
                >
                  Featured on Homepage
                </Label>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : editingPackage ? 'Update Package' : 'Create Package'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(packageToDelete)}
        onOpenChange={(open) => !open && setPackageToDelete(null)}
        title="Delete tour package?"
        description={
          <>
            Are you sure you want to permanently delete{' '}
            <strong className="text-slate-800">{packageToDelete?.name}</strong>? This can't be undone.
          </>
        }
        confirmLabel="Confirm Delete"
        loadingLabel="Deleting..."
        loading={isDeleting}
        onConfirm={confirmDelete}
      >
        <p className="text-xs text-slate-500">
          Note: Packages with existing departure schedules cannot be deleted to protect active itineraries and booking history.
        </p>
      </ConfirmDialog>

      {/* Reject Package Confirmation */}
      <ConfirmDialog
        open={Boolean(rejectModalPkg)}
        onOpenChange={(open) => !open && setRejectModalPkg(null)}
        title="Reject tour package?"
        description={
          <>
            Provide feedback for <strong className="text-slate-900">{rejectModalPkg?.name}</strong> explaining
            why this package was not approved for publication.
          </>
        }
        confirmLabel="Confirm Rejection"
        loadingLabel="Rejecting..."
        loading={isRejecting}
        onConfirm={handleRejectPackageConfirm}
      >
        <div className="space-y-1.5">
          <Label htmlFor="pkg-reject-reason" className="text-xs font-bold text-slate-700 normal-case tracking-normal">
            Rejection Reason / Required Adjustments
          </Label>
          <Textarea
            id="pkg-reject-reason"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="rounded-xl text-xs"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
};
