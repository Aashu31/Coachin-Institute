import type { ReactNode } from 'react';

type EmptyStateTone = 'blue' | 'green' | 'amber' | 'red' | 'slate';
type EmptyStateSize = 'sm' | 'md' | 'lg';

interface EmptyStateProps {
  /** Icon to display (SVG element) */
  icon: ReactNode;
  /** Main heading text */
  title: string;
  /** Descriptive message */
  message: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
    className?: string;
  };
  /** Secondary action (optional) */
  secondaryAction?: {
    label: string;
    onClick: () => void;
    className?: string;
  };
  /** Additional CSS classes */
  className?: string;
  /** Icon color theme */
  tone?: EmptyStateTone;
  /** Size variant */
  size?: EmptyStateSize;
}

const TONE_CLASSES: Record<EmptyStateTone, { bg: string; text: string; icon: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-800', icon: 'text-blue-600' },
  green: { bg: 'bg-green-50', text: 'text-green-800', icon: 'text-green-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-800', icon: 'text-amber-600' },
  red: { bg: 'bg-red-50', text: 'text-red-800', icon: 'text-red-600' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-700', icon: 'text-slate-500' },
};

const SIZE_CLASSES: Record<EmptyStateSize, { container: string; icon: string; title: string; message: string; gap: string }> = {
  sm: { container: 'py-6 px-4', icon: 'h-10 w-10', title: 'text-base', message: 'text-xs', gap: 'gap-2' },
  md: { container: 'py-10 px-6', icon: 'h-14 w-14', title: 'text-lg', message: 'text-sm', gap: 'gap-3' },
  lg: { container: 'py-14 px-8', icon: 'h-16 w-16', title: 'text-xl', message: 'text-base', gap: 'gap-4' },
};

/**
 * Reusable empty state component with consistent styling
 * Use for: no data, no results, first-time setup screens
 */
export function EmptyState({
  icon,
  title,
  message,
  action,
  secondaryAction,
  className = '',
  tone = 'slate',
  size = 'md',
}: EmptyStateProps): JSX.Element {
  const colors = TONE_CLASSES[tone];
  const sizes = SIZE_CLASSES[size];

  return (
    <div className={`card flex flex-col items-center text-center ${sizes.container} ${className}`}>
      <div className={`flex items-center justify-center rounded-2xl ${colors.bg} ${sizes.icon}`}>
        <span className={colors.icon}>{icon}</span>
      </div>
      <div className="mt-4 space-y-2">
        <h3 className={`font-display font-semibold ${sizes.title} ${colors.text}`}>{title}</h3>
        <p className={`leading-relaxed ${sizes.message} text-slate-600`}>{message}</p>
      </div>
      {(action || secondaryAction) && (
        <div className={`mt-6 flex flex-col sm:flex-row items-center justify-center ${sizes.gap}`}>
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className={`btn-secondary flex-1 sm:flex-none ${secondaryAction.className ?? ''}`}
            >
              {secondaryAction.label}
            </button>
          )}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className={`btn-primary flex-1 sm:flex-none ${action.className ?? ''}`}
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Pre-configured empty states for common scenarios
 */

export function EmptyBatches({ onCreate }: { onCreate: () => void }): JSX.Element {
  return (
    <EmptyState
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      }
      title="No batches created yet"
      message="Create your first batch to start taking attendance and managing students."
      action={{ label: 'Create Batch', onClick: onCreate }}
      tone="blue"
    />
  );
}

export function EmptyStudents({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }): JSX.Element {
  return (
    <EmptyState
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M22 21v-2a4 4 0 00-3-3.87M16 3.13A4 4 0 0119 7a4 4 0 01-3 3.87" />
        </svg>
      }
      title="No students in this batch"
      message="Add a student manually or upload a CSV roster to get started."
      action={{ label: 'Add Student', onClick: onAdd }}
      secondaryAction={{ label: 'Import CSV', onClick: onImport }}
      tone="green"
    />
  );
}

export function EmptyLeads({ onViewWebsite }: { onViewWebsite: () => void }): JSX.Element {
  return (
    <EmptyState
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M22 21v-2a4 4 0 00-3-3.87M16 3.13A4 4 0 0119 7a4 4 0 01-3 3.87" />
        </svg>
      }
      title="No demo inquiries yet"
      message="Share your website link to start capturing leads from prospective students."
      action={{ label: 'View Website', onClick: onViewWebsite }}
      tone="amber"
    />
  );
}

export function EmptyEscalation(): JSX.Element {
  return (
    <EmptyState
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M12 8a4 4 0 100-8 4 4 0 000 8z" />
        </svg>
      }
      title="All clear!"
      message="Zero unresolved parent Red Alerts right now. Great job staying on top of attendance!"
      tone="green"
      size="lg"
    />
  );
}

export function EmptyAnalytics({ onSelectDate }: { onSelectDate: () => void }): JSX.Element {
  return (
    <EmptyState
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path strokeLinecap="round" d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      }
      title="No classes scheduled"
      message="No active batches have sessions on this date. Select a different date or create a batch."
      action={{ label: 'Select Another Date', onClick: onSelectDate }}
      tone="slate"
    />
  );
}

export function EmptySearch({ query, onClear }: { query: string; onClear: () => void }): JSX.Element {
  return (
    <EmptyState
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
      }
      title="No results found"
      message={`No matches for "${query}". Try adjusting your search or filters.`}
      action={{ label: 'Clear Search', onClick: onClear }}
      tone="slate"
    />
  );
}