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
import { todayInManila } from '../../lib/dates';
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

  const today = todayInManila();
  const upcomingTrips = bookings
    .filter((b) => b.departureDate >= today && (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Pending'))
    // Soonest departure first (bookings arrive newest-booked first)
    .sort((a, b) => String(a.departureDate).localeCompare(String(b.departureDate)));
  const nextUpcoming = upcomingTrips.length > 0 ? upcomingTrips[0] : null;

  // Skeleton only on initial load; refreshes keep the current content visible
  const showSkeleton = loading && bookings.length === 0;
  // A failed load with nothing to show: the ErrorState replaces the (misleading, all-zero) metrics and feed
  const showErrorOnly = Boolean(error) && !loading && bookings.length === 0;

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      {/* Welcome Greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-600 bg-[length:200%_auto] animate-gradient-x px-5 py-5 sm:px-8 sm:py-6 text-white shadow-lg shadow-emerald-500/20">
        <div className="pointer-events-none absolute inset-0 bg-dots-light opacity-20" />
        <div className="pointer-events-none absolute -right-6 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-24 -bottom-6 h-24 w-24 rounded-full bg-white/10" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-100/90 mb-1">
              {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="text-2xl sm:text-3xl font-black font-heading break-words">
              Mabuhay, {profile?.fullName?.split(' ')[0] || 'Traveler'}! 👋
            </h1>
            <p className="mt-1 text-sm text-emerald-50/90">
              Here is a summary of your upcoming departures and active travel itineraries.
            </p>
          </div>
          <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur animate-bounce-soft">
            <Plane className="h-8 w-8 text-white" />
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchBookings} retrying={loading} />}

      {/* Next Upcoming Departure Banner */}
      {nextUpcoming && (
        <div className="relative overflow-hidden rounded-2xl p-5 sm:p-8 text-white shadow-xl shadow-emerald-900/20">
          <img src="/images/island.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/95 via-teal-900/85 to-emerald-800/60" />
          <div className="orb orb-coral right-10 -top-8 h-32 w-32 opacity-40" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 min-w-0">
              <Badge className="bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider">
                Next Upcoming Trip
              </Badge>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold font-heading break-words">
                {nextUpcoming.packageName}
              </h2>
              <p className="text-sm text-emerald-200 flex items-start sm:items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
                Departs {formatDate(nextUpcoming.departureDate)} • {nextUpcoming.numberOfTravelers} Traveler(s)
              </p>
              <p className="text-xs text-slate-300">
                Booking Reference: <span className="font-mono font-bold text-white break-all">{nextUpcoming.bookingReference}</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Button asChild className="w-full sm:w-auto h-11 sm:h-10 bg-white text-emerald-950 hover:bg-slate-100 font-bold text-sm">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm" aria-hidden="true">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-6 w-40 sm:w-56" />
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
                    <Skeleton className="h-5 w-full max-w-48" />
                    <Skeleton className="h-3 w-full max-w-56" />
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
            <Card className="rounded-2xl border-slate-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/60 transition-all">
              <CardContent className="p-5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Bookings</p>
                  <p className="text-3xl font-black text-slate-900 font-heading mt-1">{totalBookings}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-lg">
                  <Compass className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-200/60 transition-all">
              <CardContent className="p-5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confirmed Trips</p>
                  <p className="text-3xl font-black text-emerald-700 font-heading mt-1">{confirmedBookings}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-teal-200/60 transition-all">
              <CardContent className="p-5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming Departures</p>
                  <p className="text-3xl font-black text-slate-900 font-heading mt-1">{upcomingTrips.length}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/30">
                  <Calendar className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-200/60 transition-all">
              <CardContent className="p-5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Confirmation</p>
                  <p className="text-3xl font-black text-amber-700 font-heading mt-1">{pendingBookings}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30">
                  <Clock className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Bookings Feed */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-heading">Recent Booking Activity</h3>
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
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-slate-700 break-all">{b.bookingReference}</span>
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
                      <h4 className="text-base font-bold text-slate-900 font-heading break-words">{b.packageName}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Departure: {formatDate(b.departureDate)} • {b.numberOfTravelers} traveler(s)
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 shrink-0">
                      <span className="text-base font-extrabold text-slate-900 font-heading">
                        {formatCurrency(b.totalPrice)}
                      </span>
                      <Button asChild size="sm" variant="outline" className="h-10 sm:h-9 text-xs font-semibold">
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
