import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Skeleton } from '../../components/ui/skeleton';
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
import { TableRowsSkeleton, CardSkeleton, LoadingRegion } from '../../components/common/Skeletons';
import { notify, getErrorMessage } from '../../lib/notify';
import {
  Compass,
  Calendar,
  Users,
  CheckCircle2,
  CloudSun,
  RefreshCw,
  Phone,
  Loader2,
} from 'lucide-react';

export const GuideManifestPage = () => {
  const [assignedDepartures, setAssignedDepartures] = useState([]);
  const [selectedDeparture, setSelectedDeparture] = useState(null);
  const [manifestData, setManifestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [manifestError, setManifestError] = useState('');
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);

  // Fetch assigned departures
  const fetchDepartures = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await adminApi.getAssignedDepartures();
      const deps = res.data || res || [];
      setAssignedDepartures(deps);

      // Keep the selected departure in sync with fresh data (e.g. after completion)
      setSelectedDeparture((prev) => {
        if (!prev) return prev;
        return deps.find((d) => d.id === prev.id) || prev;
      });
      if (deps.length > 0 && !selectedDeparture) {
        selectDeparture(deps[0]);
      }
    } catch (err) {
      console.error('[GuideManifestPage] Error:', err);
      setError(getErrorMessage(err, 'Failed to load assigned departures.'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch manifest for a departure
  const selectDeparture = async (dep) => {
    // Switching to another departure clears the previous roster so it is never shown under the wrong tour
    if (dep.id !== selectedDeparture?.id) setManifestData(null);
    setSelectedDeparture(dep);
    try {
      setLoadingManifest(true);
      setManifestError('');
      const res = await adminApi.getDepartureManifest(dep.id);
      setManifestData(res.data || res);
    } catch (err) {
      console.error('[ManifestFetch] Error:', err);
      setManifestError(getErrorMessage(err, 'Failed to load manifest for selected departure.'));
    } finally {
      setLoadingManifest(false);
    }
  };

  useEffect(() => {
    fetchDepartures();
  }, []);

  // Check-in toggle
  const handleToggleCheckIn = async (item) => {
    if (!selectedDeparture) return;
    const newStatus = !item.isCheckedIn;

    try {
      // Optimistic update
      setManifestData((prev) => {
        if (!prev) return prev;
        const updatedList = prev.manifest.map((m) =>
          m.bookingId === item.bookingId && m.travelerIndex === item.travelerIndex
            ? { ...m, isCheckedIn: newStatus }
            : m
        );
        // Fallback entries represent a whole party (headcount > 1)
        const newCheckedInCount = updatedList
          .filter((m) => m.isCheckedIn)
          .reduce((sum, m) => sum + (Number(m.headcount) || 1), 0);
        return {
          ...prev,
          checkedInHeadcount: newCheckedInCount,
          manifest: updatedList,
        };
      });

      await adminApi.updatePassengerCheckIn(selectedDeparture.id, {
        bookingId: item.bookingId,
        travelerIndex: item.travelerIndex,
        isCheckedIn: newStatus,
      });
    } catch (err) {
      notify.error(err, 'Failed to update passenger check-in status.');
      selectDeparture(selectedDeparture); // rollback
    }
  };

  // Mark Departure as Complete (confirmed via ConfirmDialog)
  const handleCompleteDeparture = async () => {
    if (!selectedDeparture || completing) return;

    try {
      setCompleting(true);
      await adminApi.completeDeparture(selectedDeparture.id);
      notify.success('Tour departure successfully finalized and marked as Completed!');
      setConfirmCompleteOpen(false);
      setSelectedDeparture((prev) => (prev ? { ...prev, status: 'completed' } : prev));
      fetchDepartures();
    } catch (err) {
      notify.error(err, 'Failed to complete departure.');
    } finally {
      setCompleting(false);
    }
  };

  const weather = selectedDeparture?.destinationWeather;
  const todayManila = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  // A tour can only be finalized once it has started and is still active
  const canComplete =
    selectedDeparture &&
    !['completed', 'cancelled'].includes(selectedDeparture.status) &&
    (selectedDeparture.departureDate || '') <= todayManila;
  const isClosedDeparture = ['completed', 'cancelled'].includes(selectedDeparture?.status);
  // Skeleton only on the initial load; refreshes keep the current assignments visible
  const showSkeleton = loading && assignedDepartures.length === 0;
  const showManifestSkeleton = loadingManifest && !manifestData;


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Compass className="h-6 w-6 shrink-0 text-emerald-600" />
            Tour Guide Operations & Manifest
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time passenger roster, digital roll-call check-ins, destination weather advisory, and trip completion.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchDepartures}
          disabled={loading}
          className="h-10 w-full shrink-0 text-xs text-slate-600 flex items-center justify-center gap-1.5 sm:w-auto md:h-9"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Assignments
        </Button>
      </div>

      {/* Error alert */}
      {error && <ErrorState message={error} onRetry={fetchDepartures} retrying={loading} />}

      {/* Departure Selector Pills */}
      {showSkeleton ? (
        <LoadingRegion label="Loading assigned tour departures..." className="space-y-6">
          <div className="flex gap-3 overflow-hidden pb-2" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-56 max-w-[80vw] shrink-0 rounded-xl border border-slate-200 bg-white p-3.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="mt-3 h-3 w-28" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <CardSkeleton lines={2} className="lg:col-span-2" />
            <CardSkeleton lines={3} />
          </div>
        </LoadingRegion>
      ) : assignedDepartures.length === 0 ? (
        error ? null : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white">
            <EmptyState
              icon={Compass}
              title="No Assigned Departures"
              description="You currently have no active tour departures assigned to your guide account."
            />
          </div>
        )
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2">
          {assignedDepartures.map((dep) => {
            const isSelected = selectedDeparture?.id === dep.id;
            return (
              <button
                key={dep.id}
                type="button"
                onClick={() => selectDeparture(dep)}
                aria-pressed={isSelected}
                className={`flex min-h-[44px] w-64 max-w-[80vw] shrink-0 snap-start cursor-pointer flex-col rounded-xl border p-3.5 sm:w-auto sm:max-w-xs text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/60 shadow-sm ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="min-w-0 truncate text-xs font-bold text-slate-900">
                    {dep.package?.name || 'Tour Package'}
                  </span>
                  <Badge
                    variant={
                      dep.status === 'completed'
                        ? 'secondary'
                        : dep.status === 'cancelled'
                        ? 'destructive'
                        : 'success'
                    }
                    className="shrink-0 text-[10px] uppercase font-bold"
                  >
                    {dep.status}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    {dep.departureDate}
                  </span>
                  <span>&bull;</span>
                  <span>{dep.bookedCount || 0} Guests</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Departure Dossier & Live Weather */}
      {selectedDeparture && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Departure Card */}
          <Card className="min-w-0 border-slate-200 shadow-sm lg:col-span-2">
            <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-lg font-bold text-slate-900 break-words">
                  {selectedDeparture.package?.name}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                  <span>Schedule: {selectedDeparture.departureDate} to {selectedDeparture.returnDate}</span>
                  <span>&bull;</span>
                  <span>{selectedDeparture.package?.durationDays || 1} Days Tour</span>
                </CardDescription>
              </div>

              {!['completed', 'cancelled'].includes(selectedDeparture.status) && (
                <Button
                  onClick={() => setConfirmCompleteOpen(true)}
                  disabled={completing || !canComplete}
                  title={!canComplete ? 'Tour can be completed on or after its departure date' : undefined}
                  className="h-11 w-full shrink-0 font-semibold text-sm sm:h-10 sm:w-auto sm:text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {completing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {completing ? 'Completing...' : 'Mark Tour as Completed'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {/* Headcount and Check-in Bar */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-semibold">
                  <span className="text-slate-600">Digital Roll-Call Progress</span>
                  <span className="text-emerald-700">
                    {manifestData?.checkedInHeadcount || 0} of {manifestData?.totalHeadcount || 0} Checked In
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                    style={{
                      width: `${
                        manifestData?.totalHeadcount
                          ? Math.round(
                              (manifestData.checkedInHeadcount / manifestData.totalHeadcount) * 100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Destination Weather Preview Card */}
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-blue-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <CloudSun className="h-4 w-4 text-blue-500" />
                Live Destination Weather
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weather ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {weather.temp != null ? `${Math.round(weather.temp)}°C` : '--'}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 capitalize">
                      {weather.condition || weather.description || 'N/A'}
                    </span>
                    {weather.isMock && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        Sample data
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
                    <div>Humidity: <span className="font-semibold text-slate-700">{weather.humidity != null ? `${weather.humidity}%` : 'N/A'}</span></div>
                    {/* OpenWeather metric units report wind in m/s */}
                    <div>Wind: <span className="font-semibold text-slate-700">{weather.windSpeed != null ? `${Math.round(weather.windSpeed * 3.6)} km/h` : 'N/A'}</span></div>
                  </div>
                  {weather.description && (
                    <p className="text-[11px] text-slate-600 font-medium pt-1 capitalize">
                      {weather.description}
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-4 text-xs text-slate-400 text-center">
                  Live destination meteorological data unavailable.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Passenger Manifest Table */}
      {selectedDeparture && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/50 px-4 py-3.5 sm:px-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-emerald-600" />
              Verified Passenger Manifest ({manifestData?.totalHeadcount || 0} Travelers)
            </h3>
            <span className="text-xs text-slate-500">
              Click checkbox to toggle boarding check-in status
            </span>
          </div>

          {manifestError && (
            <div className="p-4">
              <ErrorState
                title="Unable to load passenger manifest"
                message={manifestError}
                onRetry={() => selectDeparture(selectedDeparture)}
                retrying={loadingManifest}
              />
            </div>
          )}

          {/* Mobile: card-based roster with large tap targets (guides use this in the field) */}
          <div className="md:hidden">
            {showManifestSkeleton ? (
              <ul className="divide-y divide-slate-100" aria-hidden="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 p-4">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-40 max-w-full" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : !manifestData?.manifest || manifestData.manifest.length === 0 ? (
              manifestError ? null : (
                <EmptyState
                  icon={Users}
                  title="No passengers yet"
                  description="No confirmed passenger reservations for this departure yet."
                />
              )
            ) : (
              <ul className="divide-y divide-slate-100">
                {manifestData.manifest.map((item) => {
                  const checkId = `checkin-m-${item.bookingId}-${item.travelerIndex}`;
                  return (
                    <li
                      key={`${item.bookingId}-${item.travelerIndex}`}
                      className={item.isCheckedIn ? 'bg-emerald-50/40' : ''}
                    >
                      {/* Whole card toggles the checkbox via the label (native label → button activation) */}
                      <label
                        htmlFor={checkId}
                        className={`flex min-h-[64px] items-start gap-3 p-4 ${
                          isClosedDeparture ? 'cursor-default' : 'cursor-pointer active:bg-slate-50'
                        }`}
                      >
                        <Checkbox
                          id={checkId}
                          checked={Boolean(item.isCheckedIn)}
                          disabled={isClosedDeparture}
                          onCheckedChange={() => handleToggleCheckIn(item)}
                          aria-label={`Check in ${item.fullName}`}
                          className="mt-0.5 h-8 w-8 rounded-md [&_svg]:h-6 [&_svg]:w-6"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="break-words text-base font-semibold text-slate-900">
                              {item.fullName}
                            </span>
                            {item.isCheckedIn && (
                              <Badge variant="success" className="text-[10px] px-1.5 py-0">
                                Boarded
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                            {item.relationship && <span>{item.relationship}</span>}
                            {item.relationship && <span className="text-slate-300">&bull;</span>}
                            <span className="font-mono font-semibold text-slate-800 break-all">
                              {item.bookingReference}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-700">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="break-all">{item.contactPhone || 'N/A'}</span>
                          </div>
                          <div className="mt-2 text-xs">
                            {item.dietaryOrMedicalNotes ? (
                              <span className="inline-block max-w-full break-words font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                {item.dietaryOrMedicalNotes}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">None noted</span>
                            )}
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Tablet and up: full table */}
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px] text-center">Check-In</TableHead>
                <TableHead>Traveler Name</TableHead>
                <TableHead>Party / Role</TableHead>
                <TableHead>Booking Ref</TableHead>
                <TableHead>Emergency Phone</TableHead>
                <TableHead>Dietary & Medical Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showManifestSkeleton ? (
                <TableRowsSkeleton
                  rows={5}
                  columns={['mx-auto h-4 w-4', 'w-36', 'w-20', 'w-24', 'w-28', 'w-32']}
                />
              ) : !manifestData?.manifest || manifestData.manifest.length === 0 ? (
                manifestError ? null : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6}>
                      <EmptyState
                        icon={Users}
                        title="No passengers yet"
                        description="No confirmed passenger reservations for this departure yet."
                      />
                    </TableCell>
                  </TableRow>
                )
              ) : (
                manifestData.manifest.map((item, idx) => (
                  <TableRow
                    key={`${item.bookingId}-${item.travelerIndex}`}
                    className={item.isCheckedIn ? 'bg-emerald-50/30' : ''}
                  >
                    <TableCell className="text-center">
                      <Checkbox
                        checked={Boolean(item.isCheckedIn)}
                        disabled={isClosedDeparture}
                        onCheckedChange={() => handleToggleCheckIn(item)}
                        aria-label={`Check in ${item.fullName}`}
                        className="h-5 w-5 align-middle"
                      />
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{item.fullName}</span>
                        {item.isCheckedIn && (
                          <Badge variant="success" className="text-[9px] px-1.5 py-0">
                            Boarded
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {item.relationship}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-slate-800">
                      {item.bookingReference}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span>{item.contactPhone || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs min-w-[10rem]">
                      {item.dietaryOrMedicalNotes ? (
                        <span className="inline-block break-words font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {item.dietaryOrMedicalNotes}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None noted</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmCompleteOpen}
        onOpenChange={(open) => !completing && setConfirmCompleteOpen(open)}
        variant="default"
        title="Mark tour as completed?"
        description={`Are you sure you want to mark this tour (${selectedDeparture?.package?.name || 'Tour'}) as COMPLETED? All confirmed bookings will be marked as Completed.`}
        confirmLabel="Mark as Completed"
        loadingLabel="Completing..."
        loading={completing}
        onConfirm={handleCompleteDeparture}
      />
    </div>
  );
};
