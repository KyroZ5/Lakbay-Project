import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
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
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { TableRowsSkeleton } from '../../components/common/Skeletons';
import { FieldError } from '../../components/common/FieldError';
import { notify, getErrorMessage } from '../../lib/notify';
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  ShieldCheck,
  UserX,
  UserCheck,
  Shield,
  Edit,
} from 'lucide-react';

const STAFF_ROLES = ['coordinator', 'support', 'guide', 'admin'];

export const StaffCustomersPage = () => {
  const { user: currentStaffUser } = useStaffAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Create Staff Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    role: 'support',
  });

  // Change Role Modal
  const [selectedUserForRole, setSelectedUserForRole] = useState(null);
  const [newRole, setNewRole] = useState('support');
  const [updatingRole, setUpdatingRole] = useState(false);

  // Account status confirmation
  const [statusTarget, setStatusTarget] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await adminApi.getUsers({
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        limit: 200,
      });
      setUsers(res.data || res || []);
    } catch (err) {
      console.error('[StaffCustomersPage] Error:', err);
      setError(getErrorMessage(err, 'Failed to load users.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  // Create Staff
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (creating) return;
    const nextErrors = {};
    if (!createForm.fullName.trim()) nextErrors.fullName = 'Full Name is required.';
    if (!createForm.email) nextErrors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email.trim()))
      nextErrors.email = 'Enter a valid email address.';
    if (!createForm.password) nextErrors.password = 'Password is required.';
    else if (createForm.password.length < 6)
      nextErrors.password = 'Password must be at least 6 characters.';
    if (createForm.phone.trim() && !/^\+[1-9]\d{6,14}$/.test(createForm.phone.trim()))
      nextErrors.phone = 'Use international format, e.g. +639171234567.';
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }
    setFormErrors({});

    try {
      setCreating(true);
      await adminApi.createStaffAccount({
        ...createForm,
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim(),
      });
      notify.success(`Staff account for ${createForm.fullName} (${createForm.role}) created successfully!`);
      setIsCreateModalOpen(false);
      setCreateForm({
        fullName: '',
        email: '',
        password: '',
        phone: '',
        role: 'support',
      });
      fetchUsers();
    } catch (err) {
      notify.error(err, 'Failed to create staff account.');
    } finally {
      setCreating(false);
    }
  };

  // Toggle Account Status
  const requestToggleStatus = (userRecord) => {
    if ((userRecord.uid || userRecord.id) === currentStaffUser?.uid) {
      notify.warning('You cannot deactivate your own administrative account.');
      return;
    }
    setStatusTarget(userRecord);
  };

  const handleToggleStatus = async () => {
    const userRecord = statusTarget;
    if (!userRecord || updatingStatus) return;

    const currentStatus = userRecord.accountStatus || 'active';
    const targetStatus = currentStatus === 'active' ? 'deactivated' : 'active';

    try {
      setUpdatingStatus(true);
      await adminApi.setUserAccountStatus(userRecord.uid || userRecord.id, targetStatus);
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === userRecord.uid || u.id === userRecord.id
            ? { ...u, accountStatus: targetStatus }
            : u
        )
      );
      notify.success(`${userRecord.fullName || userRecord.email}'s account is now ${targetStatus}.`);
      setStatusTarget(null);
    } catch (err) {
      notify.error(err, 'Failed to update account status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Update Role
  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!selectedUserForRole || updatingRole) return;

    try {
      setUpdatingRole(true);
      await adminApi.setUserRole(selectedUserForRole.uid || selectedUserForRole.id, newRole);
      notify.success(`Role for ${selectedUserForRole.fullName} updated to ${newRole}`);
      setSelectedUserForRole(null);
      fetchUsers();
    } catch (err) {
      notify.error(err, 'Failed to update role.');
    } finally {
      setUpdatingRole(false);
    }
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      u.fullName?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      String(u.phone || '').toLowerCase().includes(term)
    );
  });

  const hasFilters = Boolean(search || roleFilter || statusFilter);
  const clearFilters = () => {
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
  };
  const openCreateModal = () => {
    setFormErrors({});
    setIsCreateModalOpen(true);
  };
  // Skeleton only on the initial load; refreshes keep current rows visible
  const showSkeleton = loading && users.length === 0;
  const statusTargetIsActive = (statusTarget?.accountStatus || 'active') === 'active';

  // Shared between desktop table rows and mobile cards
  const renderRoleBadge = (u) => (
    <Badge
      variant={
        u.role === 'admin'
          ? 'destructive'
          : u.role === 'coordinator'
          ? 'info'
          : u.role === 'guide'
          ? 'success'
          : u.role === 'support'
          ? 'secondary'
          : 'outline'
      }
      className="capitalize font-semibold text-xs"
    >
      {u.role || 'customer'}
    </Badge>
  );

  const renderUserActions = (u, mobile = false) => {
    const isSelf = (u.uid || u.id) === currentStaffUser?.uid;
    const isActive = (u.accountStatus || 'active') === 'active';
    const isOperator = u.role === 'operator';
    const size = mobile ? 'h-10 w-10' : 'h-8 w-8';
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isOperator}
              onClick={() => {
                setSelectedUserForRole(u);
                setNewRole(u.role || 'customer');
              }}
              className={`${size} p-0 text-slate-600 hover:text-emerald-600`}
              aria-label={`Change role for ${u.fullName || u.email}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isOperator ? 'Manage operators from the Operators page' : 'Change Role'}</TooltipContent>
        </Tooltip>
        {isSelf ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Focusable wrapper so the explanation is reachable while the button is disabled */}
              <span
                tabIndex={0}
                className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  disabled
                  aria-label="Deactivate Account (unavailable for your own account)"
                  className={`${size} p-0 text-slate-600`}
                >
                  <UserX className="h-4 w-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>You cannot deactivate your own administrative account.</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => requestToggleStatus(u)}
                className={`${size} p-0 ${
                  isActive
                    ? 'text-slate-600 hover:text-red-600'
                    : 'text-slate-600 hover:text-emerald-600'
                }`}
                aria-label={`${isActive ? 'Deactivate' : 'Reactivate'} ${u.fullName || u.email}`}
              >
                {isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isActive ? 'Deactivate Account' : 'Reactivate Account'}</TooltipContent>
          </Tooltip>
        )}
      </>
    );
  };

  const emptyUsersState = hasFilters ? (
    <EmptyState filtered onClearFilters={clearFilters} />
  ) : (
    <EmptyState
      icon={Users}
      title="No user accounts yet"
      description="Provision a staff member to get started."
      action={
        <Button size="sm" onClick={openCreateModal}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Provision Staff Member
        </Button>
      }
    />
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Identity & Access Management (IAM)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage staff credentials, custom security claims, role permissions, and customer accounts.
          </p>
        </div>
        <div className="flex w-full items-center gap-3 md:w-auto md:shrink-0">
          <Button
            onClick={openCreateModal}
            className="h-10 w-full md:w-auto font-medium flex items-center justify-center gap-1.5 shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Provision Staff Member
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm md:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name, email, phone..."
            aria-label="Search users"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <Select
            value={roleFilter || 'all'}
            onValueChange={(v) => setRoleFilter(v === 'all' ? '' : v)}
          >
            <SelectTrigger aria-label="Filter by role" className="w-full min-w-0 sm:w-40 text-slate-700">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="coordinator">Coordinator</SelectItem>
              <SelectItem value="support">Support Agent</SelectItem>
              <SelectItem value="guide">Tour Guide</SelectItem>
              <SelectItem value="operator">Tour Operator</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter || 'all'}
            onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
          >
            <SelectTrigger aria-label="Filter by account status" className="w-full min-w-0 sm:w-40 text-slate-700">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="deactivated">Deactivated</SelectItem>
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchUsers}
                disabled={loading}
                aria-label="Refresh users"
                className="h-10 w-10 p-0 text-slate-500 hover:text-slate-800"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh users</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchUsers} retrying={loading} />}

      {/* Users Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" aria-busy={loading}>
        {/* Mobile: stacked user cards */}
        <div className="md:hidden">
          {showSkeleton ? (
            <ul className="divide-y divide-slate-100" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 p-4">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-36 max-w-full" />
                    <Skeleton className="h-3 w-48 max-w-full" />
                  </div>
                </li>
              ))}
            </ul>
          ) : filtered.length === 0 ? (
            error ? null : emptyUsersState
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((u) => {
                const isSelf = (u.uid || u.id) === currentStaffUser?.uid;
                const isActive = (u.accountStatus || 'active') === 'active';
                return (
                  <li key={u.id || u.uid} className="space-y-3 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 text-xs border border-slate-200">
                        {u.fullName?.charAt(0) || u.email?.charAt(0) || 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 text-sm flex flex-wrap items-center gap-1.5">
                          <span className="break-words">{u.fullName || 'User'}</span>
                          {isSelf && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              You
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 break-all">{u.email}</div>
                      </div>
                      <div className="flex shrink-0 items-center -mr-2 -mt-1">
                        {renderUserActions(u, true)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-12 text-xs text-slate-600">
                      {renderRoleBadge(u)}
                      <Badge
                        variant={isActive ? 'success' : 'destructive'}
                        className="text-xs font-medium"
                      >
                        {u.accountStatus || 'active'}
                      </Badge>
                      <span>{u.phone || 'N/A'}</span>
                      <span className="text-slate-400">{(u.createdAt || '').substring(0, 10)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User Profile</TableHead>
              <TableHead>Role / Custom Claim</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Account Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              <TableRowsSkeleton
                rows={6}
                columns={['h-9 w-48', 'w-20', 'w-24', 'w-16', 'w-20', 'ml-auto w-16']}
              />
            ) : filtered.length === 0 ? (
              error ? null : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6}>
                    {emptyUsersState}
                  </TableCell>
                </TableRow>
              )
            ) : (
              filtered.map((u) => {
                const isSelf = (u.uid || u.id) === currentStaffUser?.uid;
                // Missing accountStatus is treated as active (matches the badge + toggle logic)
                const isActive = (u.accountStatus || 'active') === 'active';
                return (
                  <TableRow key={u.id || u.uid}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 text-xs border border-slate-200">
                          {u.fullName?.charAt(0) || u.email?.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                            <span>{u.fullName || 'User'}</span>
                            {isSelf && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                You
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 break-all">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {renderRoleBadge(u)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {u.phone || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={isActive ? 'success' : 'destructive'}
                        className="text-xs font-medium"
                      >
                        {u.accountStatus || 'active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                      {(u.createdAt || '').substring(0, 10)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {renderUserActions(u)}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Create Staff Account Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={(open) => !creating && setIsCreateModalOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Provision Staff Account
            </DialogTitle>
            <DialogDescription>
              Creates a Firebase Auth user, assigns a custom claim role, and provisions the database record.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStaff} className="space-y-4 py-2" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="staff-name" className="text-xs font-semibold">
                Full Legal Name *
              </Label>
              <Input
                id="staff-name"
                placeholder="Juan Dela Cruz"
                value={createForm.fullName}
                onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                required
                aria-invalid={Boolean(formErrors.fullName)}
                aria-describedby={formErrors.fullName ? 'staff-name-error' : undefined}
              />
              <FieldError id="staff-name-error">{formErrors.fullName}</FieldError>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-email" className="text-xs font-semibold">
                Staff Corporate Email *
              </Label>
              <Input
                id="staff-email"
                type="email"
                placeholder="juan@lakbay.ph"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                required
                aria-invalid={Boolean(formErrors.email)}
                aria-describedby={formErrors.email ? 'staff-email-error' : undefined}
              />
              <FieldError id="staff-email-error">{formErrors.email}</FieldError>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-password" className="text-xs font-semibold">
                Temporary Password *
              </Label>
              <Input
                id="staff-password"
                type="password"
                placeholder="At least 6 characters"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                required
                aria-invalid={Boolean(formErrors.password)}
                aria-describedby={formErrors.password ? 'staff-password-error' : undefined}
              />
              <FieldError id="staff-password-error">{formErrors.password}</FieldError>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="staff-role" className="text-xs font-semibold">
                  Assigned Staff Role *
                </Label>
                <Select
                  value={createForm.role}
                  onValueChange={(v) => setCreateForm({ ...createForm, role: v })}
                >
                  <SelectTrigger id="staff-role" className="text-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">Support Agent</SelectItem>
                    <SelectItem value="coordinator">Coordinator</SelectItem>
                    <SelectItem value="guide">Tour Guide</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-phone" className="text-xs font-semibold">
                  Contact Phone
                </Label>
                <Input
                  id="staff-phone"
                  placeholder="+639171234567"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  aria-invalid={Boolean(formErrors.phone)}
                  aria-describedby={formErrors.phone ? 'staff-phone-error' : undefined}
                />
                <FieldError id="staff-phone-error">{formErrors.phone}</FieldError>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                {creating ? 'Provisioning...' : 'Create Staff Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Role Modal */}
      <Dialog
        open={Boolean(selectedUserForRole)}
        onOpenChange={(open) => !open && !updatingRole && setSelectedUserForRole(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" />
              Update User Role
            </DialogTitle>
            <DialogDescription>
              Assign new security permissions for <strong>{selectedUserForRole?.fullName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRole} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-role-select" className="text-xs font-semibold">
                Select Role
              </Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="new-role-select" className="text-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="support">Support Agent</SelectItem>
                  <SelectItem value="coordinator">Coordinator</SelectItem>
                  <SelectItem value="guide">Tour Guide</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p className="text-[11px] text-slate-500">
              Note: Updating this will refresh the user's custom user token claims in Firebase Auth.
            </p>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedUserForRole(null)}
                disabled={updatingRole}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updatingRole}>
                {updatingRole && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                {updatingRole ? 'Updating...' : 'Save Role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Account Status Confirmation */}
      <ConfirmDialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        variant={statusTargetIsActive ? 'destructive' : 'default'}
        title={statusTargetIsActive ? 'Deactivate account?' : 'Reactivate account?'}
        description={
          <>
            Are you sure you want to change{' '}
            <strong className="text-slate-800">{statusTarget?.fullName || statusTarget?.email}</strong>'s account
            status to {statusTargetIsActive ? 'DEACTIVATED' : 'ACTIVE'}?
          </>
        }
        confirmLabel={statusTargetIsActive ? 'Deactivate Account' : 'Reactivate Account'}
        loadingLabel="Updating..."
        loading={updatingStatus}
        onConfirm={handleToggleStatus}
      />
    </div>
  );
};
