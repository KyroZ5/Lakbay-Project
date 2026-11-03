import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { StatCardsSkeleton, CardSkeleton, LoadingRegion } from '../../components/common/Skeletons';
import { getErrorMessage } from '../../lib/notify';
import {
  TrendingUp,
  Users,
  Ticket,
  Calendar,
  Package,
  RefreshCw,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardOverviewPage = () => {
  const { role, profile } = useStaffAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError('');
      const response =
        role === 'operator'
          ? await adminApi.getOperatorDashboardMetrics()
          : await adminApi.getDashboardMetrics();
      setData(response.data || response);
    } catch (err) {
      console.error('[DashboardOverviewPage] Metrics error:', err);
      setError(getErrorMessage(err, 'Failed to load dashboard metrics.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [role]);

  const formatPHP = (amount) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(amount || 0);

  const summary = data?.summary || {};
  const charts = data?.charts || {};
  // Skeleton only on the initial load; refreshes keep the current metrics visible
  const showSkeleton = loading && !data;

  return (
    <div className="space-y-8">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-heading">
            {role === 'operator'
              ? `${profile?.agencyName || 'Tour Operator'} Dashboard`
              : 'Operations & Financial Overview'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {role === 'operator'
              ? 'Performance summary for your accredited tour packages, active departures, and traveler reservations.'
              : 'Real-time Philippine travel booking volume, verified revenue, and departure schedules.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-600"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Metrics
          </Button>
        </div>
      </div>

      {error && (
        <ErrorState
          title="Failed to Load Dashboard"
          message={error}
          onRetry={fetchMetrics}
          retrying={loading}
        />
      )}

      {showSkeleton ? (
        <LoadingRegion label="Aggregating platform revenue and operations data..." className="space-y-8">
          <StatCardsSkeleton count={4} className="gap-5" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" aria-hidden="true">
            <CardSkeleton lines={5} />
            <CardSkeleton lines={5} className="lg:col-span-2" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-hidden="true">
            <Skeleton className="mb-4 h-4 w-48" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-6 w-12" />
                </div>
              ))}
            </div>
          </div>
        </LoadingRegion>
      ) : data ? (
      <>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Collected Revenue */}
        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Verified Revenue
            </CardTitle>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <span className="font-bold text-sm">₱</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {formatPHP(summary.collectedRevenue || summary.totalRevenue || 0)}
            </div>
            <p className="mt-1 text-xs text-emerald-700 flex items-center gap-1 font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              Excludes unpaid and cancelled bookings
            </p>
          </CardContent>
        </Card>

        {/* Total Bookings / Booked Travelers */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {role === 'operator' ? 'Booked Travelers' : 'Total Reservations'}
            </CardTitle>
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <Ticket className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {role === 'operator'
                ? summary.totalBookedTravelers || 0
                : summary.totalBookings || 0}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              {role === 'operator' ? (
                <span className="font-semibold text-emerald-600">On your active departures</span>
              ) : (
                <>
                  <span className="font-semibold text-emerald-600">{summary.confirmedBookings || 0} Confirmed</span>
                  <span>&bull;</span>
                  <span className="font-semibold text-amber-600">{summary.pendingBookings || 0} Pending</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Open Departures */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Departures
            </CardTitle>
            <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {summary.upcomingDeparturesCount || summary.activeDeparturesCount || 0}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Available future departure dates
            </p>
          </CardContent>
        </Card>

        {/* Registered Customers / Tour Packages */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {role === 'operator' ? 'Agency Tour Packages' : 'Registered Travelers'}
            </CardTitle>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              {role === 'operator' ? <Package className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {role === 'operator'
                ? summary.totalPackages || 0
                : summary.totalCustomers || 0}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {role === 'operator'
                ? `${summary.approvalBreakdown?.approved || 0} approved, ${summary.approvalBreakdown?.pending || 0} pending`
                : 'Verified platform traveler profiles'}
            </p>
          </CardContent>
        </Card>
      </div>

      {role === 'operator' ? (
      <>
      {/* Operator: approval pipeline + recent reservations (operator metrics have no charts) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">
              Package Approval Status
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Compliance review state of your submitted tour packages
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!summary.totalPackages ? (
              <EmptyState
                icon={Package}
                title="No packages yet"
                description="Create a tour package and submit it for approval."
                className="py-8"
              />
            ) : (
              <div className="space-y-4">
                {[
                  { key: 'approved', label: 'Approved', color: 'bg-emerald-500' },
                  { key: 'pending', label: 'Pending Approval', color: 'bg-amber-400' },
                  { key: 'rejected', label: 'Rejected', color: 'bg-red-400' },
                  { key: 'draft', label: 'Draft', color: 'bg-slate-400' },
                ].map(({ key, label, color }) => {
                  const count = summary.approvalBreakdown?.[key] || 0;
                  const pct = Math.round((count / (summary.totalPackages || 1)) * 100);
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-slate-700">{label}</span>
                        <span className="font-semibold text-slate-900">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Recent Reservations
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Latest bookings on your tour packages
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              <Link to="/operations/bookings">
                View Bookings <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(!data.recentBookings || data.recentBookings.length === 0) ? (
              <EmptyState
                icon={Ticket}
                title="No reservations yet"
                description="Bookings on your packages will appear here."
                className="py-8"
              />
            ) : (
              <div className="space-y-3">
                {data.recentBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">
                        {b.packageName || 'Tour Package'}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {b.bookingReference || b.id} &bull; {b.customerName || 'Traveler'} &bull;{' '}
                        {b.numberOfTravelers || 1} pax &bull; Departs {b.departureDate || 'N/A'}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-bold text-slate-900">{formatPHP(b.totalPrice)}</span>
                      <Badge variant="outline" className="bg-white text-[10px] font-semibold text-slate-700">
                        {b.bookingStatus || 'Pending'} / {b.paymentStatus || 'Unpaid'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </>
      ) : (
      <>
      {/* Breakdown and Top Packages Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Booking Status Distribution */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">
              Booking Status Breakdown
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Current operational distribution of customer reservations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(!charts.bookingStatusBreakdown || charts.bookingStatusBreakdown.length === 0) ? (
              <EmptyState
                icon={BarChart3}
                title="No bookings yet"
                description="Reservation status distribution will appear once bookings are made."
                className="py-8"
              />
            ) : (
            <div className="space-y-4">
              {charts.bookingStatusBreakdown.map((item) => {
                const total = summary.totalBookings || 1;
                const pct = Math.round((item.count / total) * 100);
                return (
                  <div key={item.status} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-700">{item.status}</span>
                      <span className="font-semibold text-slate-900">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          item.status === 'Confirmed'
                            ? 'bg-emerald-500'
                            : item.status === 'Pending'
                            ? 'bg-amber-400'
                            : item.status === 'Completed'
                            ? 'bg-blue-500'
                            : 'bg-red-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </CardContent>
        </Card>

        {/* Top Tour Packages */}
        <Card className="border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Most Popular Tour Packages
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Ranked by total booked passenger headcount
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              <Link to="/catalog/packages">
                View Packages <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(!charts.topPackages || charts.topPackages.length === 0) ? (
              <EmptyState
                icon={Package}
                title="No popularity data yet"
                description="No booking records found for popularity ranking."
                className="py-8"
              />
            ) : (
              <div className="space-y-3">
                {charts.topPackages.map((pkg, idx) => (
                  <div
                    key={pkg.name}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {pkg.name}
                      </span>
                    </div>
                    <Badge variant="outline" className="font-semibold bg-white text-slate-700">
                      {pkg.travelers} traveler{pkg.travelers === 1 ? '' : 's'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Catalog Quick Stats */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
          Catalog Inventory Summary
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
            <span className="text-xs font-medium text-slate-500">Destinations</span>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {summary.totalDestinations || 0}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
            <span className="text-xs font-medium text-slate-500">Tour Packages</span>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {summary.totalPackages || 0}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
            <span className="text-xs font-medium text-slate-500">Completed Tours</span>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {summary.completedBookings || 0}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
            <span className="text-xs font-medium text-slate-500">Cancelled Bookings</span>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {summary.cancelledBookings || 0}
            </div>
          </div>
        </div>
      </div>
      </>
      )}
      </>
      ) : null}
    </div>
  );
};
