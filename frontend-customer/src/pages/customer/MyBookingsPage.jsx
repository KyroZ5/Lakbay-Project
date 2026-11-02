import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { bookingsApi } from '../../api/bookingsApi';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { TableRowsSkeleton } from '../../components/common/Skeletons';
import { formatCurrency, formatDate } from '../../lib/utils';
import { getErrorMessage } from '../../lib/notify';
import { Calendar, ArrowRight } from 'lucide-react';

export const MyBookingsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 font-heading">My Tour Bookings</h1>
          <p className="mt-1 text-sm text-slate-500">
            View booking references, track departure schedules, and inspect payment receipts.
          </p>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter bookings by status">
          {statuses.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              aria-pressed={statusFilter === st}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Tour Package</TableHead>
                  <TableHead>Departure Date</TableHead>
                  <TableHead>Travelers</TableHead>
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
                    columns={['w-24', 'w-40', 'w-24', 'w-16', 'w-20', 'w-20 rounded-full', 'w-12', 'ml-auto w-16']}
                  />
                ) : (
                  bookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs font-bold text-slate-800">
                        {b.bookingReference}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {b.packageName}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-600">
                        {formatDate(b.departureDate)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {b.numberOfTravelers} guest(s)
                      </TableCell>
                      <TableCell className="font-extrabold text-slate-900">
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
          )}
        </Card>
      )}
    </div>
  );
};
