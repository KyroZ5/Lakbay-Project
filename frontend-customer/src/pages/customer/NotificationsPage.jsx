import React, { useState, useEffect } from 'react';
import { customerApi } from '../../api/customerApi';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { EmptyState, ErrorState } from '../../components/common/DataStates';
import { LoadingRegion } from '../../components/common/Skeletons';
import { formatDate } from '../../lib/utils';
import { notify, getErrorMessage } from '../../lib/notify';
import { Bell, CheckCheck, Loader2, Info, CheckCircle2, AlertTriangle, AlertCircle, Calendar, Clock } from 'lucide-react';

export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState(null);

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await customerApi.getNotifications();
      setNotifications(res.data?.notifications || []);
    } catch (err) {
      console.error('Fetch notifications error:', err);
      setError(getErrorMessage(err, 'Failed to load notifications.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id) => {
    if (markingId) return;
    setMarkingId(id);
    try {
      await customerApi.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      notify.error(err, 'Failed to mark notification as read.');
    } finally {
      setMarkingId(null);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'booking_confirmed':
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case 'booking_rescheduled':
        return <Calendar className="h-5 w-5 text-emerald-600" />;
      case 'reschedule_requested':
        return <Clock className="h-5 w-5 text-amber-600" />;
      case 'reschedule_rejected':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case 'booking_cancelled_refunded':
      case 'departure_cancelled':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'cancellation_under_review':
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  // Skeleton only on initial load; refreshes keep the current list visible
  const showSkeleton = loading && notifications.length === 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-2 h-1.5 w-14 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          <h1 className="text-3xl font-black text-slate-900 font-heading">
            Notifications Center
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time updates regarding your tour departures, payments, and refunds.
          </p>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchNotifications} retrying={loading} />}

      {showSkeleton ? (
        <LoadingRegion label="Loading notifications" className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="flex items-start gap-3.5 p-4 rounded-xl border border-slate-200 bg-white"
            >
              <Skeleton className="mt-0.5 h-5 w-5 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full max-w-xl" />
                <Skeleton className="h-3 w-2/3 max-w-md" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
          ))}
        </LoadingRegion>
      ) : notifications.length === 0 ? (
        error ? null : (
          <Card className="rounded-2xl border-slate-200">
            <EmptyState
              icon={Bell}
              title="No notifications"
              description="You're all caught up on your travel updates."
            />
          </Card>
        )
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-4 p-4 rounded-xl border transition-colors ${
                n.isRead
                  ? 'bg-white border-slate-200'
                  : 'bg-emerald-50/40 border-emerald-200 shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5">{getNotificationIcon(n.type)}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">{n.title}</h4>
                    {!n.isRead && (
                      <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 h-4">
                        New
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">{n.message}</p>
                  <span className="text-[10px] text-slate-400 mt-2 block font-medium">
                    {formatDate(n.createdAt)}
                  </span>
                </div>
              </div>

              {!n.isRead && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMarkAsRead(n.id)}
                      disabled={markingId === n.id}
                      aria-label={`Mark "${n.title}" as read`}
                      className="h-7 w-7 shrink-0 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-100/50"
                    >
                      {markingId === n.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCheck className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark as read</TooltipContent>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
