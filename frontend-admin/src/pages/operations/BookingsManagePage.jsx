import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
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
import { TableRowsSkeleton, LoadingRegion } from '../../components/common/Skeletons';
import { notify, getErrorMessage } from '../../lib/notify';
import {
  Search,
  RefreshCw,
  Ticket,
  Calendar,
  MessageSquare,
  AlertCircle,
  Eye,
  Clock,
} from 'lucide-react';

const DEFAULT_RESCHEDULE_REJECT_REASON =
  'Unable to accommodate departure change due to guide or boat capacity constraints.';

export const BookingsManagePage = () => {
  const { role } = useStaffAuth();
  // Backend only lets support/admin change paymentStatus (403 for others)
  const canEditPayment = role === 'support' || role === 'admin';
  const [bookings, setBookings] = useState([]);
  const [departures, setDepartures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [rescheduleOnlyFilter, setRescheduleOnlyFilter] = useState(false);

  // Modal State
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingDetails, setBookingDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [moderatingReschedule, setModeratingReschedule] = useState(false);
  const [rescheduleAction, setRescheduleAction] = useState(null); // 'approve' | 'reject' | null
  const [rejectReason, setRejectReason] = useState(DEFAULT_RESCHEDULE_REJECT_REASON);

  // Form in modal
  const [newInternalNote, setNewInternalNote] = useState('');
  const [rescheduleDepId, setRescheduleDepId] = useState('');
  const [editBookingStatus, setEditBookingStatus] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState('');

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await adminApi.getAllBookings({
        bookingStatus: bookingStatusFilter || undefined,
        paymentStatus: paymentStatusFilter || undefined,
        limit: 200,
      });
      setBookings(res.data || res || []);
    } catch (err) {
      console.error('[BookingsManagePage] Error:', err);
      setError(getErrorMessage(err, 'Failed to load bookings.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [bookingStatusFilter, paymentStatusFilter]);

  const formatPHP = (val) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(val || 0);

  const openBookingModal = async (booking) => {
    setSelectedBooking(booking);
    setEditBookingStatus(booking.bookingStatus || 'Confirmed');
    setEditPaymentStatus(booking.paymentStatus || 'Unpaid');
    setRescheduleDepId('');
    setNewInternalNote('');

    try {
      setLoadingDetails(true);
      const [detailRes, depRes] = await Promise.all([
        adminApi.getBookingById(booking.id),
        adminApi.getDepartures({ packageId: booking.packageId }).catch(() => ({ data: [] })),
      ]);
      setBookingDetails(detailRes.data || detailRes);
      // Filter departures to open future ones
      const openDeps = (depRes.data || depRes || []).filter(
        (d) =>
          d.id !== booking.departureId &&
          d.status === 'open' &&
          !d.isDeadlinePassed &&
          (d.capacity || 0) - (d.bookedCount || 0) >= (booking.numberOfTravelers || 1)
      );
      setDepartures(openDeps);
    } catch (err) {
      // Fall back to the summary row so support staff can still act on the booking
      notify.error(err, 'Failed to load complete booking details. Showing summary only.');
      setBookingDetails(booking);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSaveSupportUpdates = async (e) => {
    e.preventDefault();
    if (!selectedBooking || updating) return;

    try {
      setUpdating(true);
      const payload = {};
      if (editBookingStatus && editBookingStatus !== selectedBooking.bookingStatus) {
        payload.bookingStatus = editBookingStatus;
      }
      // Only send paymentStatus when actually changed (and permitted) — the
      // backend rejects any paymentStatus field from non-support/admin roles.
      if (canEditPayment && editPaymentStatus && editPaymentStatus !== selectedBooking.paymentStatus) {
        payload.paymentStatus = editPaymentStatus;
      }

      if (newInternalNote.trim()) {
        payload.internalNotes = newInternalNote.trim();
      }

      if (rescheduleDepId) {
        payload.rescheduleDepartureId = rescheduleDepId;
      }

      if (Object.keys(payload).length === 0) {
        notify.info('No changes to save.');
        return;
      }

      await adminApi.supportUpdateBooking(selectedBooking.id, payload);
      notify.success(`Booking ${selectedBooking.bookingReference} updated successfully.`);
      setSelectedBooking(null);
      fetchBookings();
    } catch (err) {
      notify.error(err, 'Failed to update booking.');
    } finally {
      setUpdating(false);
    }
  };

  const openRescheduleAction = (action) => {
    if (action === 'reject') setRejectReason(DEFAULT_RESCHEDULE_REJECT_REASON);
    setRescheduleAction(action);
  };

  const handleApproveReschedule = async () => {
    if (!selectedBooking || moderatingReschedule) return;
    try {
      setModeratingReschedule(true);
      await adminApi.approveReschedule(selectedBooking.id);
      notify.success('Reschedule request approved. Schedule updated and customer notified.');
      setRescheduleAction(null);
      setSelectedBooking(null);
      fetchBookings();
    } catch (err) {
      notify.error(err, 'Failed to approve reschedule request.');
    } finally {
      setModeratingReschedule(false);
    }
  };

  const handleRejectReschedule = async () => {
    if (!selectedBooking || moderatingReschedule) return;
    try {
      setModeratingReschedule(true);
      await adminApi.rejectReschedule(selectedBooking.id, rejectReason);
      notify.success('Reschedule request rejected and customer notified.');
      setRescheduleAction(null);
      setSelectedBooking(null);
      fetchBookings();
    } catch (err) {
      notify.error(err, 'Failed to reject reschedule request.');
    } finally {
      setModeratingReschedule(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setBookingStatusFilter('');
    setPaymentStatusFilter('');
    setRescheduleOnlyFilter(false);
  };
  const hasFilters = Boolean(search || bookingStatusFilter || paymentStatusFilter || rescheduleOnlyFilter);
  const showSkeleton = loading && bookings.length === 0;

  const pendingRescheduleCount = bookings.filter((b) => b.rescheduleRequest?.status === 'pending').length;

  const filtered = bookings.filter((b) => {
    if (rescheduleOnlyFilter && b.rescheduleRequest?.status !== 'pending') {
      return false;
    }
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      b.bookingReference?.toLowerCase().includes(term) ||
      b.customerName?.toLowerCase().includes(term) ||
      b.customerEmail?.toLowerCase().includes(term) ||
      b.packageName?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Bookings & Reservations Hub
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Search customer reservations, audit payment statuses, reschedule departures, and manage support logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBookings}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-600"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Bookings
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search ref #, name, email..."
            aria-label="Search bookings"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={bookingStatusFilter || 'all'}
            onValueChange={(v) => setBookingStatusFilter(v === 'all' ? '' : v)}
          >
            <SelectTrigger aria-label="Filter by booking status" className="w-auto min-w-[190px] text-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Booking Statuses</SelectItem>
              <SelectItem value="Confirmed">Confirmed</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={paymentStatusFilter || 'all'}
            onValueChange={(v) => setPaymentStatusFilter(v === 'all' ? '' : v)}
          >
            <SelectTrigger aria-label="Filter by payment status" className="w-auto min-w-[190px] text-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payment Statuses</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Unpaid">Unpaid</SelectItem>
              <SelectItem value="Refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>

          <button
            type="button"
            onClick={() => setRescheduleOnlyFilter(!rescheduleOnlyFilter)}
            aria-pressed={rescheduleOnlyFilter}
            className={`h-10 px-3.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              rescheduleOnlyFilter
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Reschedule Requests</span>
            {pendingRescheduleCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  rescheduleOnlyFilter ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {pendingRescheduleCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && <ErrorState message={error} onRetry={fetchBookings} retrying={loading} />}

      {/* Bookings Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" aria-busy={loading}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference & Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Departure</TableHead>
              <TableHead>Travelers & Total</TableHead>
              <TableHead>Statuses</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              <TableRowsSkeleton rows={5} columns={['w-24', 'w-36', 'w-40', 'w-24', 'w-20', 'w-16', 'ml-auto w-16']} />
            ) : filtered.length === 0 ? (
              error ? null : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    {hasFilters ? (
                      <EmptyState
                        filtered
                        description="No reservations found matching your search or filters."
                        onClearFilters={clearFilters}
                      />
                    ) : (
                      <EmptyState
                        icon={Ticket}
                        title="No reservations yet"
                        description="Customer bookings will appear here once travelers reserve a departure."
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            ) : (
              filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className="font-mono font-bold text-slate-900 text-xs">
                      {b.bookingReference}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {(b.createdAt || '').substring(0, 10)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-900 text-sm">
                      {b.customerName}
                    </div>
                    <div className="text-xs text-slate-500">{b.customerEmail}</div>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-800">
                    {b.packageName}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {b.departureDate}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-bold text-slate-900 text-sm">
                      {formatPHP(b.totalPrice)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {b.numberOfTravelers} guest{b.numberOfTravelers === 1 ? '' : 's'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      <Badge
                        variant={
                          b.bookingStatus === 'Confirmed'
                            ? 'success'
                            : b.bookingStatus === 'Pending'
                            ? 'warning'
                            : b.bookingStatus === 'Completed'
                            ? 'info'
                            : 'destructive'
                        }
                        className="text-[10px] px-1.5 py-0"
                      >
                        {b.bookingStatus}
                      </Badge>
                      <Badge
                        variant={
                          b.paymentStatus === 'Paid'
                            ? 'outline'
                            : b.paymentStatus === 'Refunded'
                            ? 'secondary'
                            : 'warning'
                        }
                        className="text-[10px] px-1.5 py-0 font-medium"
                      >
                        Pay: {b.paymentStatus}
                      </Badge>
                      {b.cancellationRequested && b.bookingStatus !== 'Cancelled' && (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0">
                          Review Req.
                        </Badge>
                      )}
                      {b.rescheduleRequest?.status === 'pending' && (
                        <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] px-1 py-0 font-bold">
                          Reschedule Req.
                        </Badge>
                      )}
                      {b.rescheduleRequest?.status === 'approved' && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 text-slate-500">
                          Rescheduled
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openBookingModal(b)}
                      aria-label={`View details for booking ${b.bookingReference}`}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 flex items-center gap-1 ml-auto"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Booking Details & Support Hub Modal */}
      <Dialog
        open={Boolean(selectedBooking)}
        onOpenChange={(open) => !open && !updating && !moderatingReschedule && setSelectedBooking(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-emerald-600" />
                  Booking {selectedBooking?.bookingReference}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Created on {(selectedBooking?.createdAt || '').substring(0, 10)} &bull; Customer UID: {selectedBooking?.customerId}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {loadingDetails ? (
            <LoadingRegion label="Loading complete booking dossier..." className="space-y-5 py-2">
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4" aria-hidden="true">
                {[0, 1].map((col) => (
                  <div key={col} className="space-y-2">
                    <Skeleton className="h-3 w-32 mb-3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
              <div className="space-y-2" aria-hidden="true">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
              <div className="space-y-4 pt-3 border-t border-slate-200" aria-hidden="true">
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <Skeleton className="h-16 w-full" />
              </div>
            </LoadingRegion>
          ) : (
            <div className="space-y-5 py-2">
              {/* Cancellation Exception Request Alert */}
              {bookingDetails?.cancellationRequested && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <AlertCircle className="h-4 w-4" />
                    Customer Requested Cancellation Review
                  </div>
                  <div>
                    <strong>Customer Reason:</strong> {bookingDetails.cancellationRequestReason || 'No reason specified'}
                  </div>
                  <div className="text-[11px] text-amber-700">
                    Window: Departed in {bookingDetails.cancellationDaysRemaining} day(s), cutoff was {bookingDetails.cancellationCutoffDays} days. Exception review required.
                  </div>
                </div>
              )}

              {/* Reschedule Request Review Card */}
              {bookingDetails?.rescheduleRequest?.status === 'pending' && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900 text-sm">
                      <Calendar className="h-4 w-4 text-amber-700" />
                      Customer Requested Departure Reschedule
                    </div>
                    <Badge className="bg-amber-200 text-amber-900 text-[10px] font-bold">
                      Pending Action
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-white/90 rounded-lg p-3 border border-amber-200/60">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Current Departure
                      </span>
                      <p className="font-bold text-slate-800 mt-0.5">
                        {bookingDetails.departureDate} ({bookingDetails.departureTime || '07:00 AM'})
                      </p>
                      <p className="text-[11px] text-slate-500 truncate" title={bookingDetails.meetingPoint}>
                        {bookingDetails.meetingPoint || 'Port Terminal'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
                        Requested Target Departure
                      </span>
                      <p className="font-bold text-emerald-900 mt-0.5">
                        {bookingDetails.rescheduleRequest.targetDepartureDate} ({bookingDetails.rescheduleRequest.targetDepartureTime || '07:00 AM'})
                      </p>
                      <p className="text-[11px] text-emerald-700 truncate" title={bookingDetails.rescheduleRequest.targetMeetingPoint}>
                        {bookingDetails.rescheduleRequest.targetMeetingPoint || 'Port Terminal'}
                      </p>
                    </div>
                  </div>

                  {bookingDetails.rescheduleRequest.reason && (
                    <div className="bg-white/90 rounded-lg p-2.5 border border-amber-200/60 text-slate-700">
                      <span className="font-semibold text-slate-900">Traveler Reason: </span>
                      <span>"{bookingDetails.rescheduleRequest.reason}"</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px]">
                    <span
                      className={
                        bookingDetails.rescheduleRequest.withinCutoff
                          ? 'text-emerald-700 font-semibold'
                          : 'text-amber-800 font-semibold'
                      }
                    >
                      Policy Window:{' '}
                      {bookingDetails.rescheduleRequest.withinCutoff
                        ? 'Submitted within standard modification window'
                        : `Submitted past ${bookingDetails.rescheduleRequest.cutoffDays || 7}-day cutoff (${bookingDetails.rescheduleRequest.daysRemaining} days left)`}
                    </span>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={moderatingReschedule}
                        onClick={() => openRescheduleAction('reject')}
                        className="text-xs h-8 px-3"
                      >
                        Reject Request
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={moderatingReschedule}
                        onClick={() => openRescheduleAction('approve')}
                        className="text-xs h-8 px-3 shadow-sm font-semibold"
                      >
                        {moderatingReschedule ? 'Processing...' : 'Approve Reschedule'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer and Trip Grid */}
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Customer Information
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div>
                      <span className="text-slate-500">Name:</span>{' '}
                      <span className="font-semibold text-slate-900">{bookingDetails?.customerName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Email:</span>{' '}
                      <span className="font-semibold text-slate-900">{bookingDetails?.customerEmail}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Phone:</span>{' '}
                      <span className="font-semibold text-slate-900">{bookingDetails?.customerPhone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Special Notes:</span>{' '}
                      <span className="text-slate-800">{bookingDetails?.specialRequests || 'None'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Tour & Financial
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div>
                      <span className="text-slate-500">Tour Package:</span>{' '}
                      <span className="font-semibold text-slate-900">{bookingDetails?.packageName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Departure Date:</span>{' '}
                      <span className="font-semibold text-slate-900">{bookingDetails?.departureDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Travelers:</span>{' '}
                      <span className="font-semibold text-slate-900">{bookingDetails?.numberOfTravelers} guest(s)</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Total Price:</span>{' '}
                      <span className="font-bold text-emerald-700 text-sm">{formatPHP(bookingDetails?.totalPrice)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Traveler Manifest List */}
              {bookingDetails?.travelerManifest && bookingDetails.travelerManifest.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Traveler Manifest
                  </h4>
                  <div className="space-y-1.5">
                    {bookingDetails.travelerManifest.map((t, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-800">
                            {idx + 1}. {t.fullName || 'Traveler'}
                          </span>
                          <span className="ml-2 text-slate-400">
                            ({t.relationship || 'Traveler'})
                          </span>
                        </div>
                        <div className="text-slate-500">
                          {t.dietaryOrMedicalNotes ? (
                            <Badge variant="outline" className="text-[10px]">
                              Diet: {t.dietaryOrMedicalNotes}
                            </Badge>
                          ) : (
                            'No dietary notes'
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Support Staff Internal Notes Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Internal Support Notes Timeline
                </h4>
                {(!bookingDetails?.internalNotes || bookingDetails.internalNotes.length === 0) ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                    No internal support notes logged yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {bookingDetails.internalNotes.map((n, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"
                      >
                        <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                          <span className="font-semibold text-slate-600">
                            {n.authorName || 'Staff'}
                          </span>
                          <span>{(n.timestamp || '').substring(0, 16).replace('T', ' ')}</span>
                        </div>
                        <p className="text-slate-800">{n.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Support Action Form: Status, Reschedule, Add Note */}
              <form onSubmit={handleSaveSupportUpdates} className="space-y-4 pt-3 border-t border-slate-200">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="booking-edit-status" className="text-xs font-semibold">Booking Status</Label>
                    <Select value={editBookingStatus} onValueChange={setEditBookingStatus}>
                      <SelectTrigger id="booking-edit-status" className="h-9 text-xs text-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Confirmed">Confirmed</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="booking-edit-payment" className="text-xs font-semibold">Payment Status</Label>
                    <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus} disabled={!canEditPayment}>
                      <SelectTrigger id="booking-edit-payment" className="h-9 text-xs text-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paid">Paid</SelectItem>
                        <SelectItem value="Unpaid">Unpaid</SelectItem>
                        <SelectItem value="Refunded">Refunded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Reschedule departure */}
                {departures.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="booking-reschedule-dep" className="text-xs font-semibold flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-blue-600" />
                      Reschedule to New Departure Date
                    </Label>
                    <Select
                      value={rescheduleDepId || 'keep'}
                      onValueChange={(v) => setRescheduleDepId(v === 'keep' ? '' : v)}
                    >
                      <SelectTrigger id="booking-reschedule-dep" className="h-9 text-xs text-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keep">
                          -- Keep Current Departure ({bookingDetails?.departureDate}) --
                        </SelectItem>
                        {departures.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.departureDate} (Available slots: {d.capacity - (d.bookedCount || 0)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Append note */}
                <div className="space-y-1.5">
                  <Label htmlFor="booking-internal-note" className="text-xs font-semibold flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                    Append Internal Note
                  </Label>
                  <Textarea
                    id="booking-internal-note"
                    rows={2}
                    placeholder="Log conversation with customer, special handling, or approval remarks..."
                    value={newInternalNote}
                    onChange={(e) => setNewInternalNote(e.target.value)}
                    className="min-h-0 p-2 text-xs"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedBooking(null)}
                    disabled={updating}
                  >
                    Close
                  </Button>
                  <Button type="submit" disabled={updating} className="text-xs">
                    {updating && <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    {updating ? 'Saving Changes...' : 'Save Support Changes'}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Reschedule Confirmation */}
      <ConfirmDialog
        open={rescheduleAction === 'approve'}
        onOpenChange={(open) => !open && setRescheduleAction(null)}
        variant="default"
        title="Approve reschedule request?"
        description={
          <>
            Booking <strong className="text-slate-800">{selectedBooking?.bookingReference}</strong> will be moved to{' '}
            <strong className="text-slate-800">
              {bookingDetails?.rescheduleRequest?.targetDepartureDate || 'the requested departure'}
            </strong>
            . Seats will be atomically reallocated between departures and the customer will be notified.
          </>
        }
        confirmLabel="Approve Reschedule"
        loadingLabel="Approving..."
        loading={moderatingReschedule}
        onConfirm={handleApproveReschedule}
      />

      {/* Reject Reschedule Confirmation with reason */}
      <ConfirmDialog
        open={rescheduleAction === 'reject'}
        onOpenChange={(open) => !open && setRescheduleAction(null)}
        title="Reject reschedule request?"
        description={
          <>
            The reschedule request for booking{' '}
            <strong className="text-slate-800">{selectedBooking?.bookingReference}</strong> will be declined and the
            traveler will be notified.
          </>
        }
        confirmLabel="Reject Request"
        loadingLabel="Rejecting..."
        loading={moderatingReschedule}
        onConfirm={handleRejectReschedule}
      >
        <div className="space-y-1.5">
          <Label htmlFor="reschedule-reject-reason" className="text-xs font-semibold">
            Explanation for declining (sent to traveler)
          </Label>
          <Textarea
            id="reschedule-reject-reason"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            disabled={moderatingReschedule}
            className="text-sm"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
};
