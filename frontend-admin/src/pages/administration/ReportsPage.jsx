import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';
import axiosClient from '../../api/axiosClient';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '../../components/ui/table';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { TableRowsSkeleton } from '../../components/common/Skeletons';
import { notify, getErrorMessage } from '../../lib/notify';
import { FileSpreadsheet, Download, RefreshCw, FileText, Loader2 } from 'lucide-react';

export const ReportsPage = () => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Date range filters (default to current month in Asia/Manila). Built as
  // plain YYYY-MM-DD strings — toISOString() on local midnight shifts the day.
  const [initialRange] = useState(() => {
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const [y, m] = todayStr.split('-').map(Number);
    const lastDayNum = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const mm = String(m).padStart(2, '0');
    return { first: `${y}-${mm}-01`, last: `${y}-${mm}-${String(lastDayNum).padStart(2, '0')}` };
  });

  const [startDate, setStartDate] = useState(initialRange.first);
  const [endDate, setEndDate] = useState(initialRange.last);
  // The range the currently displayed report was generated for (CSV exports this range)
  const [appliedRange, setAppliedRange] = useState({ startDate: initialRange.first, endDate: initialRange.last });
  const [exporting, setExporting] = useState(false);

  const fetchReport = async () => {
    if (startDate && endDate && startDate > endDate) {
      notify.error('"From" date must be on or before the "To" date.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const res = await adminApi.getReports({ startDate: startDate || undefined, endDate: endDate || undefined });
      setReportData(res.data || res);
      setAppliedRange({ startDate, endDate });
    } catch (err) {
      console.error('[ReportsPage] Error:', err);
      setError(getErrorMessage(err, 'Failed to generate financial report.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const formatPHP = (val) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(val || 0);

  // Download CSV
  const downloadCSV = async () => {
    const { startDate: from, endDate: to } = appliedRange;
    // The axios response interceptor already unwraps response.data, so this is the Blob itself
    const response = await axiosClient.get('/admin/reports', {
      params: {
        startDate: from || undefined,
        endDate: to || undefined,
        format: 'csv',
      },
      responseType: 'blob',
    });

    // Prepend a UTF-8 BOM so Excel renders non-ASCII names (e.g. ñ, ₱) correctly
    const blob = new Blob(['\ufeff', response], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lakbay-financial-report-${from || 'all'}-to-${to || 'all'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revocation so the browser has started the download
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  const handleExportCSV = async () => {
    if (exporting) return;
    try {
      setExporting(true);
      await notify.promise(downloadCSV(), {
        loading: 'Generating CSV...',
        success: 'CSV report downloaded.',
        error: 'Failed to download CSV.',
      });
    } catch {
      // Failure already reported (and logged) by the notify.promise error toast
    } finally {
      setExporting(false);
    }
  };

  const bookings = reportData?.bookings || [];
  // Skeletons only before the first report arrives; date re-filters keep the current preview visible
  const showSkeleton = loading && !reportData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2 sm:text-2xl">
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600 sm:h-6 sm:w-6" />
            Financial & Operational Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit realized booking revenues, filter by departure timeline, and export official CSV statements.
          </p>
        </div>
        <div className="flex w-full shrink-0 items-center gap-3 md:w-auto">
          <Button
            onClick={handleExportCSV}
            disabled={exporting || bookings.length === 0}
            className="h-10 w-full font-medium flex items-center justify-center gap-1.5 shadow-sm md:w-auto"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Generating CSV...' : 'Export to CSV'}
          </Button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Label htmlFor="start-date" className="w-10 shrink-0 text-xs font-semibold text-slate-600 sm:w-auto">
              From:
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 min-w-0 flex-1 text-xs sm:h-9 sm:w-40 sm:flex-none"
            />
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Label htmlFor="end-date" className="w-10 shrink-0 text-xs font-semibold text-slate-600 sm:w-auto">
              To:
            </Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 min-w-0 flex-1 text-xs sm:h-9 sm:w-40 sm:flex-none"
            />
          </div>

          <Button
            onClick={fetchReport}
            size="sm"
            disabled={loading}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-10 w-full sm:h-9 sm:w-auto"
          >
            {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Filter Dates
          </Button>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchReport}
              disabled={loading}
              aria-label="Refresh report"
              className="h-10 w-10 self-end p-0 text-slate-500 hover:text-slate-800 sm:h-9 sm:w-9 sm:self-auto"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh report</TooltipContent>
        </Tooltip>
      </div>

      {error && <ErrorState message={error} onRetry={fetchReport} retrying={loading} />}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Verified Revenue in Window
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showSkeleton ? (
              <Skeleton className="h-8 w-32" aria-hidden="true" />
            ) : (
              <div className="text-2xl font-extrabold text-emerald-700 break-words">
                {formatPHP(reportData?.totalCollected)}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Paid bookings scheduled in selected dates
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Booking Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showSkeleton ? (
              <Skeleton className="h-8 w-16" aria-hidden="true" />
            ) : (
              <div className="text-2xl font-extrabold text-slate-900">
                {reportData?.recordCount || 0}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Total reservations matching date query
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Format Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-slate-800 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                UTF-8 CSV
              </Badge>
              <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
                Real-time JSON
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Compatible with Microsoft Excel & Google Sheets
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mobile: stacked card list (same data as the table) */}
      <div className="space-y-3 md:hidden" aria-busy={loading}>
        {showSkeleton ? (
          <>
            <span className="sr-only" role="status">Generating report preview...</span>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-hidden="true">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-full" />
                <Skeleton className="mt-3 h-5 w-32" />
              </div>
            ))}
          </>
        ) : bookings.length === 0 ? (
          error ? null : (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <EmptyState
                icon={FileText}
                title="No reservations in this window"
                description="No reservations found within the selected departure dates. Try a wider date range."
              />
            </div>
          )
        ) : (
          bookings.map((b) => (
            <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-all font-mono font-bold text-xs text-slate-900">
                  {b.bookingReference}
                </span>
                <span className="shrink-0 text-sm font-bold text-slate-900">
                  {formatPHP(b.totalPrice)}
                </span>
              </div>
              <div className="mt-2 min-w-0">
                <div className="font-semibold text-slate-800 text-xs break-words">{b.customerName}</div>
                <div className="text-[11px] text-slate-400 break-all">{b.customerEmail}</div>
              </div>
              <div className="mt-2 text-xs text-slate-700 font-medium break-words">{b.packageName}</div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-[11px] text-slate-400">Departure Date</dt>
                  <dd className="text-slate-700">{b.departureDate}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-400">Travelers</dt>
                  <dd className="text-slate-800 font-medium">{b.numberOfTravelers || 1}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant={b.paymentStatus === 'Paid' ? 'success' : 'secondary'}
                  className="text-[10px] px-1.5 py-0"
                >
                  {b.paymentStatus}
                </Badge>
                <Badge
                  variant={
                    b.bookingStatus === 'Confirmed'
                      ? 'success'
                      : b.bookingStatus === 'Completed'
                      ? 'info'
                      : 'outline'
                  }
                  className="text-[10px] px-1.5 py-0"
                >
                  {b.bookingStatus}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Table (tablet and up; scrolls horizontally when narrower than its columns) */}
      <div className="hidden min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden md:block" aria-busy={loading}>
        {showSkeleton && <span className="sr-only" role="status">Generating report preview...</span>}
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow>
              <TableHead>Ref Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Departure Date</TableHead>
              <TableHead>Travelers</TableHead>
              <TableHead>Gross PHP</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Booking Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              <TableRowsSkeleton
                rows={6}
                columns={['w-24', 'w-32', 'w-36', 'w-20', 'w-8', 'w-20', 'w-12', 'w-16']}
              />
            ) : bookings.length === 0 ? (
              error ? null : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8}>
                    <EmptyState
                      icon={FileText}
                      title="No reservations in this window"
                      description="No reservations found within the selected departure dates. Try a wider date range."
                    />
                  </TableCell>
                </TableRow>
              )
            ) : (
              bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="whitespace-nowrap font-mono font-bold text-xs text-slate-900">
                    {b.bookingReference}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-800 text-xs">{b.customerName}</div>
                    <div className="text-[11px] text-slate-400 break-all">{b.customerEmail}</div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 font-medium">
                    {b.packageName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-slate-700">
                    {b.departureDate}
                  </TableCell>
                  <TableCell className="text-xs text-slate-800 font-medium">
                    {b.numberOfTravelers || 1}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs font-bold text-slate-900">
                    {formatPHP(b.totalPrice)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={b.paymentStatus === 'Paid' ? 'success' : 'secondary'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {b.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        b.bookingStatus === 'Confirmed'
                          ? 'success'
                          : b.bookingStatus === 'Completed'
                          ? 'info'
                          : 'outline'
                      }
                      className="text-[10px] px-1.5 py-0"
                    >
                      {b.bookingStatus}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
