import { useState, useRef, useEffect } from 'react';
import { useTheme, type Theme } from '../lib/theme';

function SunIcon({ className = 'h-4 w-4' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon({ className = 'h-4 w-4' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon({ className = 'h-4 w-4' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

interface ThemeToggleProps {
  className?: string;
  variant?: 'compact' | 'segmented';
}

export default function ThemeToggle({ className = '', variant = 'compact' }: ThemeToggleProps): JSX.Element {
  const { theme, effectiveTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (variant === 'segmented') {
    const options: { id: Theme; label: string; icon: JSX.Element }[] = [
      { id: 'light', label: 'Light', icon: <SunIcon className="h-4 w-4" /> },
      { id: 'dark', label: 'Dark', icon: <MoonIcon className="h-4 w-4" /> },
      { id: 'system', label: 'System', icon: <MonitorIcon className="h-4 w-4" /> },
    ];

    return (
      <div className={`inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900 ${className}`} role="group" aria-label="Theme selection">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTheme(opt.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              theme === opt.id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  // Compact variant with dropdown
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
        aria-label={`Toggle theme (currently ${theme})`}
        title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
      >
        {theme === 'system' ? (
          <MonitorIcon className="h-4 w-4" />
        ) : effectiveTheme === 'dark' ? (
          <MoonIcon className="h-4 w-4 text-amber-400" />
        ) : (
          <SunIcon className="h-4 w-4 text-amber-500" />
        )}
      </button>

      {isOpen && (
        <div className="animate-fade-in absolute right-0 mt-2 w-36 origin-top-right rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:border-slate-700 dark:bg-slate-800 z-50">
          <button
            type="button"
            onClick={() => { setTheme('light'); setIsOpen(false); }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition ${
              theme === 'light'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-bold'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            <SunIcon className="h-4 w-4 text-amber-500" />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => { setTheme('dark'); setIsOpen(false); }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition ${
              theme === 'dark'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-bold'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            <MoonIcon className="h-4 w-4 text-amber-400" />
            <span>Dark</span>
          </button>

          <button
            type="button"
            onClick={() => { setTheme('system'); setIsOpen(false); }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition ${
              theme === 'system'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-bold'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            <MonitorIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span>System Default</span>
          </button>
        </div>
      )}
    </div>
  );
}
