import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { bookingsApi } from '../../api/bookingsApi';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { LoadingRegion } from '../../components/common/Skeletons';
import { formatCurrency, formatDate } from '../../lib/utils';
import { getErrorMessage } from '../../lib/notify';
import {
  Calendar,
  Clock,
  Compass,
  CheckCircle2,
  ArrowRight,
  Plane,
} from 'lucide-react';

export const DashboardOverview = () => {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await bookingsApi.getMyBookings();
      setBookings(res.data || []);
    } catch (err) {
      console.error('Dashboard bookings load error:', err);
      setError(getErrorMessage(err, 'Failed to load your bookings.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter((b) => b.bookingStatus === 'Confirmed').length;
  const pendingBookings = bookings.filter((b) => b.bookingStatus === 'Pending').length;

  const today = new Date().toISOString().split('T')[0];
  const upcomingTrips = bookings.filter(
    (b) => b.departureDate >= today && (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Pending')
  );

  const nextUpcoming = upcomingTrips.length > 0 ? upcomingTrips[0] : null;

  // Skeleton only on initial load; refreshes keep the current content visible
  const showSkeleton = loading && bookings.length === 0;
  // A failed load with nothing to show: the ErrorState replaces the (misleading, all-zero) metrics and feed
  const showErrorOnly = Boolean(error) && !loading && bookings.length === 0;

  return (
    <div className="space-y-8">
      {/* Welcome Greeting */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 font-heading">
          Mabuhay, {profile?.fullName?.split(' ')[0] || 'Traveler'}!
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Here is a summary of your upcoming departures and active travel itineraries.
        </p>
      </div>

      {error && <ErrorState message={error} onRetry={fetchBookings} retrying={loading} />}

      {/* Next Upcoming Departure Banner */}
      {nextUpcoming && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-800 to-teal-900 p-6 sm:p-8 text-white shadow-lg">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <Badge className="bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider">
                Next Upcoming Trip
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-heading">
                {nextUpcoming.packageName}
              </h2>
              <p className="text-sm text-emerald-200 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Departs {formatDate(nextUpcoming.departureDate)} • {nextUpcoming.numberOfTravelers} Traveler(s)
              </p>
              <p className="text-xs text-slate-300">
                Booking Reference: <span className="font-mono font-bold text-white">{nextUpcoming.bookingReference}</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="bg-white text-emerald-950 hover:bg-slate-100 font-bold text-sm">
                <Link to={`/dashboard/bookings/${nextUpcoming.id}`}>
                  View Full Itinerary
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {showSkeleton ? (
        <LoadingRegion label="Loading your dashboard" className="space-y-8">
          {/* Metrics skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="rounded-2xl border-slate-200">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="mt-3 h-8 w-12" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-xl" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent bookings skeleton */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-hidden="true">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-100 p-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </LoadingRegion>
      ) : showErrorOnly ? null : (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Bookings</p>
                  <p className="text-3xl font-black text-slate-900 font-heading mt-1">{totalBookings}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Compass className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confirmed Trips</p>
                  <p className="text-3xl font-black text-emerald-700 font-heading mt-1">{confirmedBookings}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming Departures</p>
                  <p className="text-3xl font-black text-slate-900 font-heading mt-1">{upcomingTrips.length}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
                  <Calendar className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Confirmation</p>
                  <p className="text-3xl font-black text-amber-700 font-heading mt-1">{pendingBookings}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <Clock className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Bookings Feed */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 font-heading">Recent Booking Activity</h3>
              <Link to="/dashboard/bookings" className="text-xs font-bold text-emerald-700 hover:underline">
                View All ({totalBookings})
              </Link>
            </div>

            {bookings.length === 0 ? (
              <EmptyState
                icon={Plane}
                title="No bookings yet"
                description="Start your Philippine journey today!"
                action={
                  <Button asChild size="sm" className="text-xs">
                    <Link to="/packages">Browse Tour Packages</Link>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {bookings.slice(0, 4).map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-100 p-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-slate-700">{b.bookingReference}</span>
                        <Badge
                          className={
                            b.bookingStatus === 'Confirmed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.bookingStatus === 'Pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }
                        >
                          {b.bookingStatus}
                        </Badge>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 font-heading">{b.packageName}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Departure: {formatDate(b.departureDate)} • {b.numberOfTravelers} traveler(s)
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                      <span className="text-base font-extrabold text-slate-900 font-heading">
                        {formatCurrency(b.totalPrice)}
                      </span>
                      <Button asChild size="sm" variant="outline" className="text-xs font-semibold">
                        <Link to={`/dashboard/bookings/${b.id}`} aria-label={`Details for booking ${b.bookingReference}`}>
                          Details
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
