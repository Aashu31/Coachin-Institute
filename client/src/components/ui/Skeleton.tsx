import type { HTMLAttributes } from 'react';

/**
 * Reusable skeleton loading components for consistent loading states
 */

/**
 * Base skeleton shimmer animation
 */
function SkeletonBase({ className = '', style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse bg-slate-200 rounded ${className}`}
      style={{ background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', ...style }}
      {...props}
    />
  );
}

/**
 * Skeleton for a table row (renders as table row structure)
 */
export function SkeletonRow({ columns = 6, className = '' }: { columns?: number; className?: string }): JSX.Element {
  return (
    <tr className={className}>
      {Array.from({ length: columns }, (_, i) => (
        <td key={i} className="px-4 py-3">
          <SkeletonBase className="h-4 w-3/4" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton for a list row (div-based, works outside tables)
 */
export function SkeletonListRow({ columns = 6, className = '' }: { columns?: number; className?: string }): JSX.Element {
  return (
    <div className={`flex gap-4 p-3 ${className}`}>
      {Array.from({ length: columns }, (_, i) => (
        <div key={i} className="flex-1 min-w-0">
          <SkeletonBase className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for a card (e.g., KPI card, batch card, student card)
 */
export function SkeletonCard({ className = '', variant = 'default' }: { className?: string; variant?: 'default' | 'kpi' | 'table' }): JSX.Element {
  if (variant === 'kpi') {
    return (
      <div className={`card animate-pulse p-4 sm:p-5 ${className}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <SkeletonBase className="h-3 w-24 mb-2" />
            <SkeletonBase className="h-8 w-32" />
          </div>
          <SkeletonBase className="flex h-10 w-10 flex-none items-center justify-center rounded-xl" />
        </div>
        <SkeletonBase className="mt-2 h-3 w-48" />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`card animate-pulse overflow-hidden ${className}`}>
        <div className="border-b border-slate-200 px-5 py-4">
          <SkeletonBase className="h-5 w-48" />
          <SkeletonBase className="mt-1 h-3 w-64" />
        </div>
        <div className="p-5 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <SkeletonBase className="flex-1 min-w-0 h-10 rounded-xl" />
              <SkeletonBase className="flex-1 min-w-0 h-10 rounded-xl" />
              <SkeletonBase className="flex-1 min-w-0 h-10 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`card animate-pulse p-6 ${className}`}>
      <SkeletonBase className="h-6 w-1/3 mb-4" />
      <SkeletonBase className="h-4 w-full mb-2" />
      <SkeletonBase className="h-4 w-2/3" />
    </div>
  );
}

/**
 * Skeleton for a button with spinner
 */
export function ButtonSpinner({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }): JSX.Element {
  const sizeClasses = {
    sm: 'h-3 w-3 border-1.5',
    md: 'h-4 w-4 border-2',
    lg: 'h-5 w-5 border-2',
  };
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-current border-t-transparent ${sizeClasses[size]} ${className}`}
    />
  );
}

/**
 * Skeleton for a list item (e.g., lead list, escalation list)
 */
export function SkeletonListItem({ className = '', lines = 3 }: { className?: string; lines?: number }): JSX.Element {
  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      <SkeletonBase className="h-5 w-1/3" />
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBase key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

/**
 * Skeleton for a form field
 */
export function SkeletonField({ label = true, className = '' }: { label?: boolean; className?: string }): JSX.Element {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <SkeletonBase className="h-4 w-1/4" />}
      <SkeletonBase className="h-10 w-full rounded-lg" />
    </div>
  );
}

/**
 * Skeleton for avatar/profile area
 */
export function SkeletonAvatar({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }): JSX.Element {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };
  return (
    <SkeletonBase className={`rounded-full ${sizeClasses[size]} ${className}`} />
  );
}

/**
 * Full page skeleton for dashboard views
 */
export function PageSkeleton({ title = true, kpiCount = 4, className = '' }: { title?: boolean; kpiCount?: number; className?: string }): JSX.Element {
  return (
    <div className={`animate-fade-in space-y-6 ${className}`}>
      {title && (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SkeletonBase className="h-4 w-32" />
            <SkeletonBase className="mt-2 h-8 w-64" />
            <SkeletonBase className="mt-2 h-4 w-48" />
          </div>
          <SkeletonBase className="h-10 w-24" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: kpiCount }, (_, i) => (
          <SkeletonCard key={i} variant="kpi" />
        ))}
      </div>
      <SkeletonCard variant="table" />
    </div>
  );
}