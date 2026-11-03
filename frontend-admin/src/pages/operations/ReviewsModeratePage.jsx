import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';
import { useStaffAuth } from '../../contexts/StaffAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
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
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { TableRowsSkeleton } from '../../components/common/Skeletons';
import { notify, getErrorMessage } from '../../lib/notify';
import {
  Star,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  Flag,
  Trash2,
  CheckCircle,
  MessageSquare,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

export const ReviewsModeratePage = () => {
  const { role } = useStaffAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'approved' | 'hidden' | 'flagged'

  // Delete Dialog State
  const [reviewToDelete, setReviewToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Action Loading State per review id
  const [updatingId, setUpdatingId] = useState(null);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await adminApi.getReviews({ limit: 500 });
      setReviews(res.data || []);
    } catch (err) {
      console.error('[ReviewsModeratePage] Error:', err);
      setError(getErrorMessage(err, 'Failed to load customer reviews.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleToggleApproval = async (review) => {
    if (updatingId) return;
    try {
      setUpdatingId(review.id);
      const newStatus = !review.isApproved;
      await adminApi.moderateReview(review.id, { isApproved: newStatus });

      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, isApproved: newStatus } : r))
      );

      notify.success(`Review marked as ${newStatus ? 'Approved (Visible)' : 'Hidden'}.`);
    } catch (err) {
      notify.error(err, 'Failed to update review approval status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleFlag = async (review) => {
    if (updatingId) return;
    try {
      setUpdatingId(review.id);
      const newFlagged = !review.isFlagged;
      await adminApi.moderateReview(review.id, { isFlagged: newFlagged });

      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, isFlagged: newFlagged } : r))
      );

      notify.success(`Review ${newFlagged ? 'flagged for inspection' : 'unflagged'}.`);
    } catch (err) {
      notify.error(err, 'Failed to update review flag status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!reviewToDelete || isDeleting) return;

    try {
      setIsDeleting(true);
      await adminApi.deleteReview(reviewToDelete.id);
      setReviews((prev) => prev.filter((r) => r.id !== reviewToDelete.id));
      notify.success('Review deleted and tour package rating recalculated.');
      setReviewToDelete(null);
    } catch (err) {
      notify.error(err, 'Failed to delete review.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Metrics calculation
  const totalReviews = reviews.length;
  const approvedCount = reviews.filter((r) => r.isApproved).length;
  const hiddenCount = reviews.filter((r) => !r.isApproved).length;
  const flaggedCount = reviews.filter((r) => r.isFlagged).length;
  const avgRating =
    approvedCount > 0
      ? (
          reviews
            .filter((r) => r.isApproved)
            .reduce((sum, r) => sum + Number(r.rating || 0), 0) / approvedCount
        ).toFixed(1)
      : '0.0';

  // Filter and search
  const filteredReviews = reviews.filter((r) => {
    if (statusFilter === 'approved' && !r.isApproved) return false;
    if (statusFilter === 'hidden' && r.isApproved) return false;
    if (statusFilter === 'flagged' && !r.isFlagged) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchPkg = (r.packageName || '').toLowerCase().includes(q);
      const matchCust = (r.customerName || '').toLowerCase().includes(q);
      const matchRef = (r.bookingReference || '').toLowerCase().includes(q);
      const matchComment = (r.comment || '').toLowerCase().includes(q);
      return matchPkg || matchCust || matchRef || matchComment;
    }
    return true;
  });

  const canModerate = role === 'admin' || role === 'support';
  const canDelete = role === 'admin';
  // Skeleton only on the initial load; refreshes keep the current rows visible
  const showSkeleton = loading && reviews.length === 0;
  const isFiltered = statusFilter !== 'all' || search.trim() !== '';
  const clearFilters = () => {
    setStatusFilter('all');
    setSearch('');
  };

  // Shared between the desktop table row and the mobile card (larger touch targets on mobile)
  const renderModerationActions = (rev, mobile = false) => {
    const isUpdating = updatingId === rev.id;
    const btnHeight = mobile ? 'h-10' : 'h-8';
    return (
      <>
        {canModerate && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={isUpdating}
              onClick={() => handleToggleApproval(rev)}
              aria-label={rev.isApproved ? 'Hide Review' : 'Approve & Publish'}
              className={`${btnHeight} text-[11px] font-semibold ${mobile ? 'flex-1' : ''}`}
            >
              {isUpdating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : rev.isApproved ? (
                <>
                  <EyeOff className="h-3.5 w-3.5 mr-1 text-slate-500" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  Approve
                </>
              )}
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isUpdating}
                  onClick={() => handleToggleFlag(rev)}
                  aria-label={rev.isFlagged ? 'Remove Flag' : 'Flag for Inspection'}
                  className={`${btnHeight} text-[11px] ${mobile ? 'w-10 px-0' : ''} ${
                    rev.isFlagged ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : ''
                  }`}
                >
                  <Flag className={`h-3.5 w-3.5 ${rev.isFlagged ? 'fill-red-600 text-red-600' : 'text-slate-400'}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{rev.isFlagged ? 'Remove Flag' : 'Flag for Inspection'}</TooltipContent>
            </Tooltip>
          </>
        )}

        {canDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReviewToDelete(rev)}
                className={`${btnHeight} ${mobile ? 'w-10 px-0' : ''} text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200`}
                aria-label="Delete Review Permanently"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete Review Permanently</TooltipContent>
          </Tooltip>
        )}
      </>
    );
  };

  const renderStars = (rating) => (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
        />
      ))}
    </div>
  );

  const renderStatusBadges = (rev) => (
    <>
      {rev.isApproved ? (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none font-semibold text-[10px]">
          Approved (Live)
        </Badge>
      ) : (
        <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 border-none font-semibold text-[10px]">
          Hidden
        </Badge>
      )}

      {rev.isFlagged && (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-none font-semibold text-[10px] flex items-center gap-1">
          <Flag className="h-2.5 w-2.5 fill-red-600 text-red-600" /> Flagged
        </Badge>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-heading">
            Customer Reviews & Ratings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Audit, moderate, and publish traveler reviews. Complies with Rule D: Only travelers with completed bookings can review.
          </p>
        </div>

        <Button
          onClick={fetchReviews}
          variant="outline"
          size="sm"
          disabled={loading}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Load error */}
      {error && <ErrorState message={error} onRetry={fetchReviews} retrying={loading} />}

      {/* Metric Cards */}
      {showSkeleton ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
              <Skeleton className="mt-3 h-7 w-16" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Reviews</span>
            <MessageSquare className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-heading">{totalReviews}</div>
          <span className="text-[11px] text-slate-400">All submitted feedback</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600">Approved (Live)</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2 font-heading">{approvedCount}</div>
          <span className="text-[11px] text-emerald-600/80">Visible on public catalog</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600">Average Rating</span>
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2 font-heading">{avgRating} / 5.0</div>
          <span className="text-[11px] text-slate-400">Approved reviews average</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-600">Hidden / Flagged</span>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-700 mt-2 font-heading">
            {hiddenCount} / {flaggedCount}
          </div>
          <span className="text-[11px] text-slate-400">{hiddenCount} hidden, {flaggedCount} flagged</span>
        </div>
      </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-3 sm:p-4 rounded-xl border border-slate-200">
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'all', label: `All (${totalReviews})` },
            { key: 'approved', label: `Approved (${approvedCount})` },
            { key: 'hidden', label: `Hidden (${hiddenCount})` },
            { key: 'flagged', label: `Flagged (${flaggedCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              aria-pressed={statusFilter === tab.key}
              className={`px-3 py-2 sm:py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                statusFilter === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 lg:w-72 sm:shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search package, customer, comment..."
            aria-label="Search reviews"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 sm:h-9 text-xs"
          />
        </div>
      </div>

      {/* Reviews Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm" aria-busy={loading}>
        {!showSkeleton && filteredReviews.length === 0 ? (
          error ? null : reviews.length > 0 && isFiltered ? (
            <EmptyState
              filtered
              title="No reviews found"
              description={search ? 'Try clearing your search query.' : 'No customer reviews submitted in this category.'}
              onClearFilters={clearFilters}
            />
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="No reviews yet"
              description="Reviews appear here once travelers with completed bookings submit feedback."
            />
          )
        ) : (
          <>
          {/* Mobile: stacked review cards */}
          <div className="md:hidden">
            {showSkeleton ? (
              <ul className="divide-y divide-slate-100" aria-hidden="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="space-y-2 p-4">
                    <Skeleton className="h-4 w-40 max-w-full" />
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredReviews.map((rev) => (
                  <li key={rev.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 break-words">
                          {rev.packageName || 'Tour Package'}
                        </div>
                        <span className="text-[11px] text-slate-400">ID: {rev.packageId?.slice(0, 8)}...</span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {renderStatusBadges(rev)}
                      </div>
                    </div>

                    <div className="text-xs">
                      <div className="font-semibold text-slate-800 break-words">{rev.customerName || 'Verified Traveler'}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                        <span className="font-mono break-all">
                          Ref: {rev.bookingReference || rev.bookingId?.slice(0, 8) || 'N/A'}
                        </span>
                        <span className="text-slate-400">
                          {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs">
                      {renderStars(rev.rating)}
                      <span className="font-bold text-slate-800 ml-1">{rev.rating}</span>
                    </div>

                    <div className="text-xs text-slate-700">
                      {rev.comment ? (
                        <p className="leading-relaxed whitespace-pre-wrap break-words">{rev.comment}</p>
                      ) : (
                        <span className="text-slate-400 italic">No written comment provided</span>
                      )}
                    </div>

                    {(canModerate || canDelete) && (
                      <div className="flex items-center gap-2 pt-1">
                        {renderModerationActions(rev, true)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/70">
                  <TableHead className="text-xs font-bold text-slate-700">Tour Package</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700">Customer & Booking</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700">Rating</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 w-1/3">Feedback / Comment</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700">Status</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 text-right">Moderation Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showSkeleton ? (
                  <TableRowsSkeleton rows={5} columns={['w-32', 'w-28', 'w-24', 'w-full', 'w-20', 'ml-auto w-28']} />
                ) : filteredReviews.map((rev) => {
                  return (
                    <TableRow key={rev.id} className="hover:bg-slate-50/50">
                      {/* Tour Package */}
                      <TableCell className="font-medium text-slate-900 text-xs min-w-[9rem]">
                        <div className="font-bold">{rev.packageName || 'Tour Package'}</div>
                        <span className="text-[11px] text-slate-400">ID: {rev.packageId?.slice(0, 8)}...</span>
                      </TableCell>

                      {/* Customer & Booking */}
                      <TableCell className="text-xs min-w-[8rem]">
                        <div className="font-semibold text-slate-800">{rev.customerName || 'Verified Traveler'}</div>
                        <div className="text-[11px] text-slate-500 font-mono break-all">
                          Ref: {rev.bookingReference || rev.bookingId?.slice(0, 8) || 'N/A'}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : 'N/A'}
                        </div>
                      </TableCell>

                      {/* Rating */}
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          {renderStars(rev.rating)}
                          <span className="font-bold text-slate-800 ml-1">{rev.rating}</span>
                        </div>
                      </TableCell>

                      {/* Comment */}
                      <TableCell className="text-xs text-slate-700 min-w-[14rem]">
                        {rev.comment ? (
                          <p className="leading-relaxed whitespace-pre-wrap break-words">{rev.comment}</p>
                        ) : (
                          <span className="text-slate-400 italic">No written comment provided</span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-1 items-start">
                          {renderStatusBadges(rev)}
                        </div>
                      </TableCell>

                      {/* Moderation Actions */}
                      <TableCell className="text-xs text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {renderModerationActions(rev)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!reviewToDelete}
        onOpenChange={(open) => !open && setReviewToDelete(null)}
        title="Delete Customer Review"
        description={
          <>
            Are you sure you want to permanently delete this review for{' '}
            <strong className="text-slate-900">{reviewToDelete?.packageName}</strong> submitted by{' '}
            <strong className="text-slate-900">{reviewToDelete?.customerName}</strong>? This will remove the review
            document and automatically recalculate the tour package&apos;s average rating and total review count.
            This action cannot be undone.
          </>
        }
        confirmLabel="Delete Permanently"
        loadingLabel="Deleting..."
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};
