import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Placeholder rows rendered inside an existing <TableBody> so the real header
 * stays in place and column widths don't jump when data arrives.
 * `columns` may be a number or an array of per-column skeleton widths (Tailwind classes).
 */
export const TableRowsSkeleton = ({ rows = 5, columns = 5 }) => {
  const widths = Array.isArray(columns) ? columns : Array.from({ length: columns }, () => 'w-24');
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} aria-hidden="true" className="hover:bg-transparent">
          {widths.map((w, c) => (
            <TableCell key={c}>
              <Skeleton className={cn('h-4', w)} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
};

/** Row of KPI/stat cards (icon + label + value). */
export const StatCardsSkeleton = ({ count = 4, className }) => (
  <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)} aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        <Skeleton className="mt-4 h-7 w-28" />
        <Skeleton className="mt-2 h-3 w-36" />
      </div>
    ))}
  </div>
);

/** Generic card with a title and a few lines — for detail panels, charts and list blocks. */
export const CardSkeleton = ({ lines = 4, className, bodyClassName }) => (
  <div className={cn('rounded-xl border border-slate-200 bg-white p-6 shadow-sm', className)} aria-hidden="true">
    <Skeleton className="h-5 w-40" />
    <div className={cn('mt-5 space-y-3', bodyClassName)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i % 3 === 2 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  </div>
);

/** Wraps skeleton content with a screen-reader status so loading is announced once. */
export const LoadingRegion = ({ label = 'Loading', children, className }) => (
  <div role="status" aria-live="polite" className={className}>
    <span className="sr-only">{label}</span>
    {children}
  </div>
);
