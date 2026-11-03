import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { bookingsApi } from '../../api/bookingsApi';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { TableRowsSkeleton } from '../../components/common/Skeletons';
import { formatCurrency, formatDate } from '../../lib/utils';
import { getErrorMessage } from '../../lib/notify';
import { Calendar, ArrowRight, CheckCircle2, Clock, X } from 'lucide-react';

export const MyBookingsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchParams, setSearchParams] = useSearchParams();

  // Return params from Stripe checkout (success_url / mock flow) or a manual reservation
  const returnRef = searchParams.get('ref');
  const returnBanner = !returnRef
    ? null
    : searchParams.get('status') === 'success'
      ? {
          tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
          icon: CheckCircle2,
          text: `Payment received for booking ${returnRef}. It will show as Confirmed once Stripe verifies the payment.`,
        }
      : searchParams.get('mock_payment') === 'pending'
        ? {
            tone: 'border-amber-200 bg-amber-50 text-amber-900',
            icon: Clock,
            text: `Payment pending for booking ${returnRef}. Complete payment to secure your seats.`,
          }
        : searchParams.get('status') === 'reserved'
          ? {
              tone: 'border-sky-200 bg-sky-50 text-sky-900',
              icon: CheckCircle2,
              text: `Seats reserved for booking ${returnRef}.`,
            }
          : null;
  const dismissReturnBanner = () => setSearchParams({}, { replace: true });

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (statusFilter !== 'All') params.status = statusFilter;
      const res = await bookingsApi.getMyBookings(params);
      setBookings(res.data || []);
    } catch (err) {
      console.error('Fetch bookings error:', err);
      setError(getErrorMessage(err, 'Failed to load your bookings.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const statuses = ['All', 'Confirmed', 'Pending', 'Cancelled', 'Completed'];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Confirmed':
        return <Badge className="bg-emerald-100 text-emerald-800 border-none font-bold">Confirmed</Badge>;
      case 'Pending':
        return <Badge className="bg-amber-100 text-amber-800 border-none font-bold">Pending Payment</Badge>;
      case 'Cancelled':
        return <Badge className="bg-red-100 text-red-800 border-none font-bold">Cancelled</Badge>;
      case 'Completed':
        return <Badge className="bg-blue-100 text-blue-800 border-none font-bold">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentBadge = (status) => {
    switch (status) {
      case 'Paid':
        return <Badge className="rounded border-none bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">Paid</Badge>;
      case 'Refunded':
        return <Badge className="rounded border-none bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700">Refunded</Badge>;
      case 'Unpaid':
        return <Badge className="rounded border-none bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">Unpaid</Badge>;
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  // Skeleton only on initial load; filter changes / refreshes keep the current rows visible
  const showSkeleton = loading && bookings.length === 0;
  const isFiltered = statusFilter !== 'All';
  // A failed load with nothing to show is covered by the ErrorState alone
  const hideCard = Boolean(error) && !loading && bookings.length === 0;

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 h-1.5 w-14 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-heading">My Tour Bookings</h1>
          <p className="mt-1 text-sm text-slate-500">
            View booking references, track departure schedules, and inspect payment receipts.
          </p>
        </div>

        {/* Status Filter Buttons */}
        <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 lg:flex-nowrap lg:shrink-0" role="group" aria-label="Filter bookings by status">
          {statuses.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              aria-pressed={statusFilter === st}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 sm:py-1.5 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {returnBanner && (
        <div role="status" className={`flex items-start gap-3 rounded-xl border p-4 text-sm font-medium ${returnBanner.tone}`}>
          <returnBanner.icon className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="flex-1 min-w-0 break-words">{returnBanner.text}</p>
          <button
            type="button"
            onClick={dismissReturnBanner}
            aria-label="Dismiss message"
            className="shrink-0 rounded-full p-1.5 -m-1 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={fetchBookings} retrying={loading} />}

      {/* Bookings Table Card */}
      {!hideCard && (
        <Card className="rounded-2xl border-slate-200 overflow-hidden shadow-sm" aria-busy={loading}>
          {!showSkeleton && bookings.length === 0 ? (
            isFiltered ? (
              <EmptyState
                filtered
                title={`No ${statusFilter} bookings found`}
                description="Try another status or show all of your bookings."
                onClearFilters={() => setStatusFilter('All')}
              />
            ) : (
              <EmptyState
                icon={Calendar}
                title="No bookings found"
                description="Book your next trip to explore the Philippines."
                action={
                  <Button asChild size="sm" className="text-xs font-semibold">
                    <Link to="/packages">Explore Tour Packages</Link>
                  </Button>
                }
              />
            )
          ) : (
            <>
            {/* Mobile / tablet: stacked booking cards */}
            <ul className="divide-y divide-slate-100 lg:hidden">
              {showSkeleton
                ? Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} aria-hidden="true" className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                      <Skeleton className="h-5 w-full max-w-60" />
                      <div className="grid grid-cols-2 gap-3">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                      <Skeleton className="h-10 w-full" />
                    </li>
                  ))
                : bookings.map((b) => (
                    <li
                      key={b.id}
                      className={`p-4 space-y-3 ${returnRef && b.bookingReference === returnRef ? 'bg-emerald-50/70' : ''}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800 break-all min-w-0">
                          {b.bookingReference}
                        </span>
                        {getStatusBadge(b.bookingStatus)}
                      </div>
                      <p className="font-semibold text-slate-900 break-words">{b.packageName}</p>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div className="min-w-0">
                          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Departure</dt>
                          <dd className="font-medium text-slate-700">{formatDate(b.departureDate)}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Travelers</dt>
                          <dd className="text-slate-700">{b.numberOfTravelers} guest(s)</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total (PHP)</dt>
                          <dd className="text-sm font-extrabold text-slate-900 break-words">{formatCurrency(b.totalPrice)}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Payment</dt>
                          <dd className="mt-0.5">{getPaymentBadge(b.paymentStatus)}</dd>
                        </div>
                      </dl>
                      <Button asChild size="sm" variant="outline" className="w-full h-10 text-xs font-semibold">
                        <Link to={`/dashboard/bookings/${b.id}`} aria-label={`View booking ${b.bookingReference}`}>
                          View
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </li>
                  ))}
            </ul>

            {/* Laptop / desktop: full table */}
            <div className="hidden lg:block min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Tour Package</TableHead>
                  <TableHead>Departure Date</TableHead>
                  <TableHead className="hidden xl:table-cell">Travelers</TableHead>
                  <TableHead>Total (PHP)</TableHead>
                  <TableHead>Booking Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showSkeleton ? (
                  <TableRowsSkeleton
                    rows={5}
                    columns={['w-24', 'w-40', 'w-24', { className: 'w-16', cellClassName: 'hidden xl:table-cell' }, 'w-20', 'w-20 rounded-full', 'w-12', 'ml-auto w-16']}
                  />
                ) : (
                  bookings.map((b) => (
                    <TableRow key={b.id} className={returnRef && b.bookingReference === returnRef ? 'bg-emerald-50/70' : undefined}>
                      <TableCell className="font-mono text-xs font-bold text-slate-800 whitespace-nowrap">
                        {b.bookingReference}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 min-w-[10rem]">
                        {b.packageName}
                        <span className="block text-xs font-normal text-slate-500 xl:hidden">
                          {b.numberOfTravelers} guest(s)
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-600 whitespace-nowrap">
                        {formatDate(b.departureDate)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-slate-600 whitespace-nowrap">
                        {b.numberOfTravelers} guest(s)
                      </TableCell>
                      <TableCell className="font-extrabold text-slate-900 whitespace-nowrap">
                        {formatCurrency(b.totalPrice)}
                      </TableCell>
                      <TableCell>{getStatusBadge(b.bookingStatus)}</TableCell>
                      <TableCell>{getPaymentBadge(b.paymentStatus)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline" className="text-xs font-semibold">
                          <Link to={`/dashboard/bookings/${b.id}`} aria-label={`View booking ${b.bookingReference}`}>
                            View
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
};
