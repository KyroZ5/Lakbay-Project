import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
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
import { TableRowsSkeleton, StatCardsSkeleton } from '../../components/common/Skeletons';
import { notify, getErrorMessage } from '../../lib/notify';
import {
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  Search,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Loader2,
  UserCheck,
  UserX,
} from 'lucide-react';

export const OperatorsManagePage = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'operators' | 'all_apps'
  const [applications, setApplications] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Reject Dialog
  const [appToReject, setAppToReject] = useState(null);
  const DEFAULT_REJECT_REASON = 'DOT Accreditation or business permit could not be verified';
  const [rejectReason, setRejectReason] = useState(DEFAULT_REJECT_REASON);
  const [isRejecting, setIsRejecting] = useState(false);

  // Approve Dialog
  const [appToApprove, setAppToApprove] = useState(null);
  const [isApproving, setIsApproving] = useState(false);

  // Status toggle action
  const [togglingUid, setTogglingUid] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const [appsRes, opsRes] = await Promise.all([
        adminApi.getOperatorApplications(),
        adminApi.getAllOperators(),
      ]);

      setApplications(appsRes.data || []);
      setOperators(opsRes.data || []);
    } catch (err) {
      console.error('[OperatorsManagePage] Fetch error:', err);
      setError(getErrorMessage(err, 'Failed to load operator records.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApproveConfirm = async () => {
    if (!appToApprove || isApproving) return;
    try {
      setIsApproving(true);
      await adminApi.approveOperatorApplication(appToApprove.id);
      notify.success(`Application approved! ${appToApprove.agencyName} is now an accredited Tour Operator.`);
      setAppToApprove(null);
      await fetchData();
    } catch (err) {
      notify.error(err, 'Failed to approve operator application.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!appToReject || isRejecting) return;
    if (!rejectReason.trim()) {
      notify.error('Please provide a rejection reason for the applicant.');
      return;
    }
    try {
      setIsRejecting(true);
      await adminApi.rejectOperatorApplication(appToReject.id, rejectReason.trim());
      notify.success(`Application for ${appToReject.agencyName} rejected.`);
      setAppToReject(null);
      await fetchData();
    } catch (err) {
      notify.error(err, 'Failed to reject operator application.');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleToggleOperatorStatus = async (operator) => {
    if (togglingUid) return;
    try {
      setTogglingUid(operator.uid);
      const newStatus = operator.accountStatus === 'active' ? 'deactivated' : 'active';
      await adminApi.setOperatorStatus(operator.uid, newStatus);

      setOperators((prev) =>
        prev.map((op) => (op.uid === operator.uid ? { ...op, accountStatus: newStatus } : op))
      );

      notify.success(`Operator account ${operator.agencyName || operator.fullName} ${newStatus}.`);
    } catch (err) {
      notify.error(err, 'Failed to update operator account status.');
    } finally {
      setTogglingUid(null);
    }
  };

  // Metrics
  const pendingApps = applications.filter((a) => a.status === 'pending');
  const activeOps = operators.filter((o) => o.accountStatus === 'active');
  const deactivatedOps = operators.filter((o) => o.accountStatus === 'deactivated');

  // Filtered applications
  const filteredApps = (
    activeTab === 'pending'
      ? pendingApps
      : applications
  ).filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (a.agencyName || '').toLowerCase().includes(q) ||
      (a.accreditationNumber || '').toLowerCase().includes(q) ||
      (a.contactPerson || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q)
    );
  });

  // Filtered operators
  const filteredOperators = operators.filter((op) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (op.agencyName || '').toLowerCase().includes(q) ||
      (op.accreditationNumber || '').toLowerCase().includes(q) ||
      (op.fullName || '').toLowerCase().includes(q) ||
      (op.email || '').toLowerCase().includes(q)
    );
  });

  // Skeletons only on the initial load; refreshes keep current content visible
  const showStatsSkeleton = loading && applications.length === 0 && operators.length === 0;
  const showOperatorsSkeleton = loading && operators.length === 0;
  const showAppsSkeleton = loading && applications.length === 0;
  const clearSearch = () => setSearch('');

  // Shared between desktop table rows and mobile cards
  const renderOperatorStatusBadge = (op) =>
    op.accountStatus === 'active' ? (
      <Badge variant="success" className="border-none font-semibold text-[10px]">
        Active
      </Badge>
    ) : (
      <Badge variant="destructive" className="border-none font-semibold text-[10px]">
        Deactivated
      </Badge>
    );

  const renderOperatorToggle = (op, mobile = false) => {
    const isToggling = togglingUid === op.uid;
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={isToggling}
        onClick={() => handleToggleOperatorStatus(op)}
        className={`${mobile ? 'h-10 w-full' : 'h-8'} text-xs ${
          op.accountStatus === 'active'
            ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
            : 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50'
        }`}
      >
        {isToggling ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Updating status" />
        ) : op.accountStatus === 'active' ? (
          <>
            <UserX className="h-3.5 w-3.5 mr-1" /> Deactivate
          </>
        ) : (
          <>
            <UserCheck className="h-3.5 w-3.5 mr-1" /> Reactivate
          </>
        )}
      </Button>
    );
  };

  const renderAppStatus = (app) =>
    app.status === 'approved' ? (
      <Badge variant="success" className="border-none font-semibold text-[10px]">
        Approved
      </Badge>
    ) : app.status === 'rejected' ? (
      <div>
        <Badge variant="destructive" className="border-none font-semibold text-[10px]">
          Rejected
        </Badge>
        {app.reviewNotes && (
          <p className="text-[10px] text-red-600 mt-0.5 max-w-[150px] truncate" title={app.reviewNotes}>
            {app.reviewNotes}
          </p>
        )}
      </div>
    ) : (
      <Badge variant="warning" className="border-none font-semibold text-[10px]">
        Pending
      </Badge>
    );

  const renderAppActions = (app, mobile = false) =>
    app.status === 'pending' ? (
      <div className={mobile ? 'grid grid-cols-2 gap-2' : 'flex items-center justify-end gap-1.5'}>
        <Button
          size="sm"
          onClick={() => setAppToApprove(app)}
          aria-label={`Approve ${app.agencyName}`}
          className={`${mobile ? 'h-10' : 'h-8'} font-semibold text-xs gap-1`}
        >
          <CheckCircle className="h-3.5 w-3.5" /> Approve
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setRejectReason(DEFAULT_REJECT_REASON);
            setAppToReject(app);
          }}
          aria-label={`Reject ${app.agencyName}`}
          className={`${mobile ? 'h-10' : 'h-8'} text-red-600 hover:bg-red-50 border-red-200 font-semibold text-xs gap-1`}
        >
          <XCircle className="h-3.5 w-3.5" /> Reject
        </Button>
      </div>
    ) : (
      <span className="text-[11px] text-slate-400">Reviewed</span>
    );

  const mobileCardSkeleton = (
    <ul className="divide-y divide-slate-100" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="space-y-2 p-4">
          <Skeleton className="h-4 w-40 max-w-full" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-48 max-w-full" />
          <Skeleton className="h-9 w-full" />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-heading">
            Tour Operator Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review agency accreditation applications, provision operator roles, and oversee accredited partners.
          </p>
        </div>

        <Button
          onClick={fetchData}
          variant="outline"
          size="sm"
          disabled={loading}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={fetchData} retrying={loading} />}

      {/* Metric Cards */}
      {showStatsSkeleton ? (
        <StatCardsSkeleton count={4} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600">Pending Applications</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2 font-heading">{pendingApps.length}</div>
          <span className="text-[11px] text-slate-400">Awaiting compliance review</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600">Active Operators</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2 font-heading">{activeOps.length}</div>
          <span className="text-[11px] text-emerald-600/80">Authorized to publish tours</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Partners</span>
            <Building2 className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-heading">{operators.length}</div>
          <span className="text-[11px] text-slate-400">Registered agency partners</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-600">Deactivated</span>
            <XCircle className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-700 mt-2 font-heading">{deactivatedOps.length}</div>
          <span className="text-[11px] text-slate-400">Suspended privileges</span>
        </div>
      </div>
      )}

      {/* Navigation Tabs and Search */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4 bg-white p-3 sm:p-4 rounded-xl border border-slate-200">
        <TabsList className="h-auto min-w-0 justify-start gap-1.5 overflow-x-auto bg-transparent p-0 pb-1 lg:pb-0">
          <TabsTrigger value="pending" className="h-auto shrink-0 rounded-lg px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 data-[state=active]:bg-slate-900 data-[state=active]:font-semibold data-[state=active]:text-white data-[state=active]:shadow-none">
            Pending Queue ({pendingApps.length})
          </TabsTrigger>
          <TabsTrigger value="operators" className="h-auto shrink-0 rounded-lg px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 data-[state=active]:bg-slate-900 data-[state=active]:font-semibold data-[state=active]:text-white data-[state=active]:shadow-none">
            Accredited Operators ({operators.length})
          </TabsTrigger>
          <TabsTrigger value="all_apps" className="h-auto shrink-0 rounded-lg px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 data-[state=active]:bg-slate-900 data-[state=active]:font-semibold data-[state=active]:text-white data-[state=active]:shadow-none">
            All Applications ({applications.length})
          </TabsTrigger>
        </TabsList>

        <div className="relative w-full lg:w-72 lg:shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search agency, DOT license, email..."
            aria-label="Search operators and applications"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 sm:h-9 text-xs"
          />
        </div>
      </div>

      {/* Content Section */}
      <TabsContent value={activeTab} className="mt-6">
      {activeTab === 'operators' ? (
        /* ACCREDITED OPERATORS TABLE */
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm" aria-busy={loading}>
            {/* Mobile: stacked operator cards */}
            <div className="md:hidden">
              {showOperatorsSkeleton ? (
                mobileCardSkeleton
              ) : filteredOperators.length === 0 ? (
                error ? null : operators.length > 0 ? (
                  <EmptyState filtered onClearFilters={clearSearch} />
                ) : (
                  <EmptyState
                    icon={Building2}
                    title="No accredited tour operators found"
                    description="Approved applications will appear here as active agency accounts."
                  />
                )
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filteredOperators.map((op) => (
                    <li key={op.uid} className="space-y-3 p-4 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 break-words">{op.agencyName || op.fullName}</div>
                          <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 inline-block mt-0.5 max-w-full break-all">
                            {op.accreditationNumber || 'Accredited Partner'}
                          </span>
                        </div>
                        <div className="shrink-0">{renderOperatorStatusBadge(op)}</div>
                      </div>

                      <div className="space-y-1 text-slate-600">
                        <div className="font-medium text-slate-800">{op.fullName || 'Official Representative'}</div>
                        <div className="flex items-start gap-1">
                          <Mail className="h-3 w-3 mt-0.5 shrink-0 text-slate-400" />
                          <span className="min-w-0 break-all">{op.email}</span>
                        </div>
                        {op.phone && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Phone className="h-3 w-3 shrink-0 text-slate-400" /> {op.phone}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500">
                          Managed Tours: <span className="font-bold text-slate-800">{op.totalPackages || 0}</span>
                        </div>
                      </div>

                      {renderOperatorToggle(op, true)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/70">
                    <TableHead className="text-xs font-bold text-slate-700">Agency & Accreditation</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Representative</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Contact Details</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-center">Managed Tours</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Account Status</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {showOperatorsSkeleton ? (
                    <TableRowsSkeleton rows={5} columns={['w-40', 'w-28', 'w-44', 'mx-auto w-8', 'w-16', 'ml-auto w-24']} />
                  ) : filteredOperators.length === 0 ? (
                    error ? null : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6}>
                          {operators.length > 0 ? (
                            <EmptyState filtered onClearFilters={clearSearch} />
                          ) : (
                            <EmptyState
                              icon={Building2}
                              title="No accredited tour operators found"
                              description="Approved applications will appear here as active agency accounts."
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  ) : filteredOperators.map((op) => {
                    return (
                      <TableRow key={op.uid} className="hover:bg-slate-50/50">
                        <TableCell className="text-xs">
                          <div className="font-bold text-slate-900">{op.agencyName || op.fullName}</div>
                          <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 inline-block mt-0.5">
                            {op.accreditationNumber || 'Accredited Partner'}
                          </span>
                        </TableCell>

                        <TableCell className="text-xs font-medium text-slate-800">
                          {op.fullName || 'Official Representative'}
                        </TableCell>

                        <TableCell className="text-xs text-slate-600">
                          <div className="flex items-center gap-1 break-all">
                            <Mail className="h-3 w-3 shrink-0 text-slate-400" /> {op.email}
                          </div>
                          {op.phone && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                              <Phone className="h-3 w-3 text-slate-400" /> {op.phone}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-center font-bold text-slate-800">
                          {op.totalPackages || 0}
                        </TableCell>

                        <TableCell className="text-xs">
                          {renderOperatorStatusBadge(op)}
                        </TableCell>

                        <TableCell className="text-xs text-right">
                          {renderOperatorToggle(op)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
        </div>
      ) : (
        /* APPLICATIONS QUEUE & HISTORY */
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm" aria-busy={loading}>
            {/* Mobile: stacked application cards */}
            <div className="md:hidden">
              {showAppsSkeleton ? (
                mobileCardSkeleton
              ) : filteredApps.length === 0 ? (
                error ? null : search.trim() && (activeTab === 'pending' ? pendingApps : applications).length > 0 ? (
                  <EmptyState filtered onClearFilters={clearSearch} />
                ) : (
                  <EmptyState
                    icon={Clock}
                    title="No applications in this view"
                    description={
                      activeTab === 'pending'
                        ? 'All pending operator applications have been reviewed.'
                        : 'No submitted applications found.'
                    }
                  />
                )
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filteredApps.map((app) => (
                    <li key={app.id} className="space-y-3 p-4 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 break-words">{app.agencyName}</div>
                          <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 inline-block mt-0.5 max-w-full break-all">
                            {app.accreditationNumber}
                          </span>
                        </div>
                        <div className="shrink-0 text-right">{renderAppStatus(app)}</div>
                      </div>

                      <div className="space-y-1">
                        <div className="font-semibold text-slate-800">{app.contactPerson}</div>
                        <div className="flex items-start gap-1 text-[11px] text-slate-500">
                          <Mail className="h-3 w-3 mt-0.5 shrink-0 text-slate-400" />
                          <span className="min-w-0 break-all">{app.email}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Phone className="h-3 w-3 shrink-0 text-slate-400" /> {app.phone}
                        </div>
                      </div>

                      <div className="text-slate-600">
                        {app.officeAddress && (
                          <div className="flex items-start gap-1 text-[11px] text-slate-500 mb-1">
                            <MapPin className="h-3 w-3 mt-0.5 text-slate-400 shrink-0" />
                            <span className="min-w-0 break-words">{app.officeAddress}</span>
                          </div>
                        )}
                        <p className="line-clamp-3 leading-relaxed text-slate-700 break-words">
                          {app.description || 'No agency description provided.'}
                        </p>
                      </div>

                      <div className="text-[11px] text-slate-500">
                        Submitted: {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'N/A'}
                      </div>

                      {renderAppActions(app, true)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/70">
                    <TableHead className="text-xs font-bold text-slate-700">Agency & Accreditation</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Applicant Details</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 w-1/3">Services & Address</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Submitted</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Status</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-right">Review Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {showAppsSkeleton ? (
                    <TableRowsSkeleton rows={5} columns={['w-40', 'w-32', 'w-56', 'w-20', 'w-16', 'ml-auto w-36']} />
                  ) : filteredApps.length === 0 ? (
                    error ? null : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6}>
                          {search.trim() && (activeTab === 'pending' ? pendingApps : applications).length > 0 ? (
                            <EmptyState filtered onClearFilters={clearSearch} />
                          ) : (
                            <EmptyState
                              icon={Clock}
                              title="No applications in this view"
                              description={
                                activeTab === 'pending'
                                  ? 'All pending operator applications have been reviewed.'
                                  : 'No submitted applications found.'
                              }
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  ) : filteredApps.map((app) => (
                    <TableRow key={app.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-xs">
                        <div className="font-bold text-slate-900">{app.agencyName}</div>
                        <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 inline-block mt-0.5">
                          {app.accreditationNumber}
                        </span>
                      </TableCell>

                      <TableCell className="text-xs">
                        <div className="font-semibold text-slate-800">{app.contactPerson}</div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 break-all">
                          <Mail className="h-3 w-3 shrink-0 text-slate-400" /> {app.email}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Phone className="h-3 w-3 text-slate-400" /> {app.phone}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-slate-600 min-w-[12rem]">
                        {app.officeAddress && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-1">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{app.officeAddress}</span>
                          </div>
                        )}
                        <p className="line-clamp-2 leading-relaxed text-slate-700">
                          {app.description || 'No agency description provided.'}
                        </p>
                      </TableCell>

                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'N/A'}
                      </TableCell>

                      <TableCell className="text-xs">
                        {renderAppStatus(app)}
                      </TableCell>

                      <TableCell className="text-xs text-right">
                        {renderAppActions(app)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
        </div>
      )}
      </TabsContent>
      </Tabs>

      {/* Approve Confirmation */}
      <ConfirmDialog
        open={!!appToApprove}
        onOpenChange={(open) => !open && setAppToApprove(null)}
        variant="default"
        title="Approve Tour Operator Application?"
        description={
          <>
            You are approving <strong className="text-slate-900">{appToApprove?.agencyName}</strong> (License:{' '}
            {appToApprove?.accreditationNumber}). This will grant this agency the{' '}
            <strong className="text-emerald-700">Tour Operator</strong> role, allowing them to access the portal,
            create tour packages, schedule departures, and oversee passenger manifests.
          </>
        }
        confirmLabel="Confirm Approval"
        loadingLabel="Approving..."
        loading={isApproving}
        onConfirm={handleApproveConfirm}
      />

      {/* Reject Confirmation */}
      <ConfirmDialog
        open={!!appToReject}
        onOpenChange={(open) => !open && setAppToReject(null)}
        title="Reject Operator Application?"
        description={
          <>
            Provide feedback for <strong className="text-slate-900">{appToReject?.agencyName}</strong> explaining why
            accreditation could not be granted.
          </>
        }
        confirmLabel="Reject Application"
        loadingLabel="Rejecting..."
        loading={isRejecting}
        onConfirm={handleRejectConfirm}
      >
        <div className="space-y-1.5">
          <Label htmlFor="operator-reject-reason" className="text-xs font-bold text-slate-700">
            Rejection Reason / Notes
          </Label>
          <Textarea
            id="operator-reject-reason"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            disabled={isRejecting}
            className="text-xs"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
};
