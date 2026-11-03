import React from 'react';
import { AlertCircle, Inbox, RefreshCw, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Empty dataset or "no results" message.
 * Pass `filtered` when the list is empty because of search/filters rather than missing data.
 */
export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  filtered = false,
  onClearFilters,
  className,
}) => {
  const FallbackIcon = filtered ? SearchX : Inbox;
  const DisplayIcon = Icon || FallbackIcon;
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-4 py-10 text-center sm:px-6 sm:py-12', className)}>
      <div className="mb-1 rounded-full bg-slate-100 p-3 text-slate-400">
        <DisplayIcon className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-slate-800">
        {title || (filtered ? 'No matching results' : 'Nothing here yet')}
      </p>
      {(description || filtered) && (
        <p className="max-w-sm text-sm text-slate-500">
          {description || 'Try adjusting your search or filters.'}
        </p>
      )}
      {(action || (filtered && onClearFilters)) && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {filtered && onClearFilters && (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
};

/** Inline error panel for a failed section load, with an optional retry. */
export const ErrorState = ({ title = 'Unable to load data', message, onRetry, retrying = false, className }) => (
  <div
    role="alert"
    className={cn(
      'flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center',
      className
    )}
  >
    <AlertCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
    <div className="min-w-0 flex-1 break-words">
      <p className="font-semibold">{title}</p>
      {message && <p className="text-red-700">{message}</p>}
    </div>
    {onRetry && (
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={retrying}
        className="border-red-200 bg-white text-red-700 hover:bg-red-100 hover:text-red-800"
      >
        <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', retrying && 'animate-spin')} />
        Try again
      </Button>
    )}
  </div>
);
