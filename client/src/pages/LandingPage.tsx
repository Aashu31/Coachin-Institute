import { useState } from 'react';
import { Link } from 'react-router-dom';

import ContactForm from '../components/ContactForm';
import { BUSINESS, DEMO_WHATSAPP_MESSAGE, whatsappUrl } from '../lib/business';

type TrackId = 'cat' | 'pcm';

interface CourseTrack {
  id: TrackId;
  tabLabel: string;
  kicker: string;
  title: string;
  summary: string;
  highlights: string[];
  schedule: string;
  room: string;
  bestFor: string;
}

const TRACKS: Readonly<Record<TrackId, CourseTrack>> = {
  cat: {
    id: 'cat',
    tabLabel: 'CAT / MBA Prep',
    kicker: 'Track 01 · Entrance exams',
    title: 'CAT & MBA Entrance Prep',
    summary:
      'A VARC-first CAT programme built around 99%iler mentorship, sectionals that are actually reviewed, and a small evening batch that fits around college or work.',
    highlights: [
      'VARC & English focus led by a dedicated Verbal faculty',
      '99%iler CAT mentorship and personalised score plans',
      'Sectional mock analysis with error logs, not just scores',
      'GD / PI / WAT preparation for IIM shortlists',
      'Small evening batch with direct doubt access',
    ],
    schedule: 'CAT 2026 Evening Batch · 4:00–6:00 PM',
    room: 'Room 201 · Mon–Sat',
    bestFor: 'Final-year students, graduates and working professionals',
  },
  pcm: {
    id: 'pcm',
    kicker: 'Track 02 · Boards & foundation',
    tabLabel: 'Class 11th–12th PCM',
    title: 'Class 11th–12th Board & PCM Foundation',
    summary:
      'Physics, Chemistry and Maths taught in small morning batches where every student is visible, every doubt is tracked, and board performance comes before shortcuts.',
    highlights: [
      'Physics, Chemistry & Maths with concept-first teaching',
      'Board syllabus plus JEE / NEET foundation coverage',
      'Small batches built for personal attention',
      'Weekly tests with parent-visible progress',
      'Same-day doubt resolution and revision sheets',
    ],
    schedule: 'Class 12 PCM Morning Batch · 8:00–10:00 AM',
    room: 'Room 101 · Mon–Sat',
    bestFor: 'Class 11 and Class 12 students preparing for boards + entrances',
  },
};

const REVIEWS = [
  {
    quote:
      'The English teacher is the best in this coaching centre. VARC finally started making sense and my reading speed improved within a month.',
    name: 'Sneha A.',
    detail: 'CAT 2025 aspirant · Verified Google review',
  },
  {
    quote:
      '99%iler CAT faculty and genuine personal doubt sessions. My mocks moved from the 78th to the 96th percentile with the section-wise analysis.',
    name: 'Rahul K.',
    detail: 'CAT aspirant · Verified Google review',
  },
  {
    quote:
      'Small PCM batches mean the teacher actually knows where each student is stuck. My daughter’s Class 12 Physics confidence changed completely.',
    name: 'Parent of Priya S.',
    detail: 'Class 12 PCM · Verified Google review',
  },
  {
    quote:
      'The parent attendance updates are the reason we chose P.D.O Classes. We know when our son reaches class, not hours later.',
    name: 'Parent, Lalpur',
    detail: 'Parent safety programme · Verified Google review',
  },
] as const;

const SAFETY_STEPS = [
  {
    time: 'T+0',
    title: 'Teacher marks the batch',
    detail: 'Every student starts PRESENT. The teacher only taps absentees — 15 seconds, one hand.',
  },
  {
    time: 'T+10',
    title: 'Parent gets a WhatsApp check',
    detail: 'Parents of absent students receive a quick-reply message: On Leave, Running Late, or Sent to Class.',
  },
  {
    time: 'T+13',
    title: 'Front desk gets a Red Alert',
    detail: 'No reply becomes an urgent call task on the reception dashboard. Parents hear from us in minutes, not at 6 PM.',
  },
] as const;

function StarIcon({ className = 'h-4 w-4' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M10 1.6l2.6 5.27 5.82.85-4.21 4.1.99 5.79L10 14.87l-5.2 2.74.99-5.79-4.21-4.1 5.82-.85L10 1.6z" />
    </svg>
  );
}

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PhoneIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.69 2.8a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0122 16.92z"
      />
    </svg>
  );
}

function WhatsAppIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.1c-.24.68-1.4 1.3-1.94 1.34-.5.04-.98.23-3.3-.69-2.78-1.1-4.55-3.92-4.69-4.1-.14-.18-1.12-1.49-1.12-2.84s.71-2.01.96-2.29c.25-.28.55-.35.73-.35h.53c.17 0 .4-.06.62.48.24.57.8 1.95.87 2.09.07.14.12.31.02.49-.09.18-.14.29-.28.45-.14.16-.29.36-.42.48-.14.14-.28.29-.12.57.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.19.69-.8.87-1.08.18-.28.37-.23.62-.14.25.09 1.6.75 1.88.89.28.14.46.21.53.32.07.12.07.68-.17 1.36z" />
    </svg>
  );
}

function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        d="M3 10a1 1 0 011-1h9.59l-3.3-3.29a1 1 0 111.42-1.42l5 5a1 1 0 010 1.42l-5 5a1 1 0 11-1.42-1.42L13.59 11H4a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Logo({ compact = false }: { compact?: boolean }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-900 font-display text-xs font-extrabold tracking-tight text-white ring-1 ring-white/10">
        PDO
      </div>
      <div>
        <p className="font-display text-sm font-bold leading-tight tracking-tight text-slate-900">
          {BUSINESS.name}
        </p>
        {!compact ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Lalpur · Ranchi
          </p>
        ) : null}
      </div>
    </div>
  );
}

function RatingBadge({ dark = false }: { dark?: boolean }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
        dark ? 'bg-white/10 text-amber-300 ring-1 ring-inset ring-white/15' : 'bg-slate-900 text-amber-400'
      }`}
    >
      <StarIcon className="h-3.5 w-3.5" />
      {BUSINESS.googleRating}★
      <span className={`font-medium ${dark ? 'text-slate-300' : 'text-slate-300'}`}>
        ({BUSINESS.googleReviews} Google reviews)
      </span>
    </span>
  );
}

export default function LandingPage(): JSX.Element {
  const [activeTrack, setActiveTrack] = useState<TrackId>('cat');
  const track = TRACKS[activeTrack];

  function selectTrack(next: TrackId): void {
    setActiveTrack(next);
  }

  return (
    <div className="min-h-screen bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" aria-label={`${BUSINESS.name} home`}>
            <Logo />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex" aria-label="Main">
            <a className="transition hover:text-slate-900" href="#courses">
              Courses
            </a>
            <a className="transition hover:text-slate-900" href="#safety">
              Parent safety
            </a>
            <a className="transition hover:text-slate-900" href="#reviews">
              Reviews
            </a>
            <a className="transition hover:text-slate-900" href="#contact">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
            >
              Staff login
            </Link>
            <a href="#demo" className="btn-primary !min-h-10 !px-4 !py-2 text-xs sm:text-sm">
              Book free demo
            </a>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ------------------------------------------------------------------ */}
        {/* Hero                                                               */}
        {/* ------------------------------------------------------------------ */}
        <section className="relative overflow-hidden bg-brand-900">
          <div className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-primary-600/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
            }}
          />

          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-20">
            <div className="animate-slide-up">
              <RatingBadge dark />

              <h1 className="mt-5 max-w-2xl text-balance font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.35rem]">
                Ranchi’s CAT &amp; PCM classes that keep parents in the loop.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                P.D.O Classes in P&amp;T Colony, Lalpur combines 99%iler CAT mentorship and
                small-batch Class 11–12 PCM teaching with a real-time attendance safety loop that
                reaches parents within minutes — not after class ends.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#demo" className="btn-primary group">
                  Book a Free Demo Class
                  <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
                <a
                  href={`tel:${BUSINESS.phoneTel}`}
                  className="inline-flex min-h-touch items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[0.98]"
                >
                  <PhoneIcon />
                  Call {BUSINESS.phoneDisplay}
                </a>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                  P&amp;T Colony, Lalpur
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                  Mon–Sat · 7 AM – 8 PM
                </span>
                <a
                  href={whatsappUrl(DEMO_WHATSAPP_MESSAGE)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-emerald-300 transition hover:text-emerald-200"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                  WhatsApp us
                </a>
              </div>

              <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { value: '4.9★', label: 'Google rating' },
                  { value: '152', label: 'Google reviews' },
                  { value: '99%iler', label: 'CAT mentors' },
                  { value: '15 sec', label: 'Roll call' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {stat.label}
                    </dt>
                    <dd className="font-mono text-lg font-bold text-white">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Safety loop visual */}
            <aside className="animate-fade-in rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur lg:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    The P.D.O safety loop
                  </p>
                  <p className="mt-1 font-display text-lg font-bold text-white">
                    From roll call to parent call
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Live
                </span>
              </div>

              <ol className="mt-5 space-y-0">
                {SAFETY_STEPS.map((step, index) => (
                  <li key={step.time} className="relative flex gap-3 pb-5 last:pb-0">
                    {index < SAFETY_STEPS.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-px bg-white/15"
                      />
                    ) : null}
                    <span
                      className={`relative z-10 flex h-10 w-10 flex-none items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                        index === 2
                          ? 'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-400/30'
                          : 'bg-white/10 text-amber-300 ring-1 ring-inset ring-white/15'
                      }`}
                    >
                      {step.time}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <span>Today · CAT 2026 Evening</span>
                  <span className="font-mono text-amber-300">04:00 PM</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between rounded-lg bg-emerald-400/10 px-3 py-2 text-xs">
                    <span className="font-medium text-emerald-200">Rahul Kumar · CAT-2026-001</span>
                    <span className="status-pill bg-emerald-400/15 text-[10px] text-emerald-300">PRESENT</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-red-400/10 px-3 py-2 text-xs">
                    <span className="font-medium text-red-200">Aditya Mahto · CAT-2026-003</span>
                    <span className="status-pill bg-red-400/15 text-[10px] text-red-300">ABSENT</span>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
                Parent WhatsApp verification and Red Alert calling activate with the Phase 2
                escalation engine. Phase 1 already locks the digital attendance sheet.
              </p>
            </aside>
          </div>
        </section>

        {/* Trust strip */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-4 text-xs font-semibold text-slate-500 sm:px-6">
            <span className="inline-flex items-center gap-2">
              <StarIcon className="h-3.5 w-3.5 text-amber-500" />
              4.9 on Google · 152 reviews
            </span>
            <span className="hidden h-3 w-px bg-slate-300 sm:block" />
            <span>CAT · MBA entrance mentorship</span>
            <span className="hidden h-3 w-px bg-slate-300 sm:block" />
            <span>Class 11–12 PCM · Board + foundation</span>
            <span className="hidden h-3 w-px bg-slate-300 sm:block" />
            <span>Parent attendance safety loop</span>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Course tracks                                                       */}
        {/* ------------------------------------------------------------------ */}
        <section id="courses" className="scroll-mt-24 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                Two focused tracks
              </p>
              <h2 className="mt-2 text-balance font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Choose the classroom that fits the goal.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                No mixed-syllabus batches. CAT aspirants get an entrance-first evening programme;
                Class 11–12 students get a board-first morning programme with PCM foundation.
              </p>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div className="space-y-3" role="tablist" aria-label="Course tracks">
                {(Object.values(TRACKS) as CourseTrack[]).map((item) => {
                  const isActive = item.id === activeTrack;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`track-${item.id}`}
                      onClick={() => selectTrack(item.id)}
                      className={`w-full rounded-2xl border p-5 text-left transition ${
                        isActive
                          ? 'border-blue-200 bg-blue-50/70 shadow-sm ring-1 ring-blue-100'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <p
                        className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                          isActive ? 'text-blue-700' : 'text-slate-500'
                        }`}
                      >
                        {item.kicker}
                      </p>
                      <p className="mt-1.5 font-display text-lg font-bold text-slate-900">
                        {item.title}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.summary}</p>
                      <span
                        className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${
                          isActive ? 'text-blue-700' : 'text-slate-500'
                        }`}
                      >
                        {isActive ? 'Viewing details' : 'View this track'}
                        <ArrowIcon className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                id={`track-${track.id}`}
                role="tabpanel"
                className="animate-fade-in rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {track.kicker}
                    </p>
                    <h3 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900">
                      {track.title}
                    </h3>
                  </div>
                  <span className="status-pill bg-green-100 text-green-800">
                    <CheckIcon className="h-3.5 w-3.5" />
                    Admissions open
                  </span>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-slate-600">{track.summary}</p>

                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {track.highlights.map((highlight) => (
                    <li key={highlight} className="flex gap-2.5 text-sm text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-green-100 text-green-700">
                        <CheckIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className="leading-relaxed">{highlight}</span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-7 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Batch timing
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{track.schedule}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Where
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{track.room}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Best for
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{track.bestFor}</dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <a href="#demo" className="btn-primary">
                    Book a free demo for this track
                  </a>
                  <a
                    href={whatsappUrl(
                      `Hello P.D.O Classes, I want to know about the ${track.title} batch timings.`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                  >
                    <WhatsAppIcon className="h-4 w-4 text-green-600" />
                    Ask on WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Parent safety                                                       */}
        {/* ------------------------------------------------------------------ */}
        <section id="safety" className="scroll-mt-24 bg-brand-900">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
                Parent peace of mind
              </p>
              <h2 className="mt-2 text-balance font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                The 13-minute safety loop, not a paper register.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
                When a student leaves home but does not reach class, a manual register only tells
                you at the end of the day. P.D.O Classes is building a live loop: the teacher’s
                roll call locks digitally, parents get a WhatsApp check, and the front desk gets an
                urgent call task if nobody replies.
              </p>

              <div className="mt-8 space-y-4">
                {SAFETY_STEPS.map((step, index) => (
                  <div key={step.time} className="flex gap-4">
                    <span
                      className={`flex h-10 w-10 flex-none items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                        index === 2
                          ? 'animate-alert-pulse bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-400/30'
                          : 'bg-white/10 text-amber-300 ring-1 ring-inset ring-white/15'
                      }`}
                    >
                      {step.time}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-400">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <a href="#demo" className="btn-primary mt-8">
                Visit us and see the dashboard
              </a>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Parent WhatsApp preview
                </p>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  T+10 min
                </span>
              </div>

              <div className="mt-4 rounded-2xl rounded-tl-sm bg-[#DCF8C6] p-4 text-slate-900 shadow-lg">
                <p className="text-xs font-bold uppercase tracking-wider text-green-900">
                  P.D.O Classes · Attendance alert
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  Dear Parent, <span className="font-semibold">Aditya Mahto</span> has not been
                  marked present in today’s <span className="font-semibold">CAT 2026 Evening</span>{' '}
                  class (started 4:00 PM).
                </p>
                <p className="mt-2 text-sm leading-relaxed">Please confirm their status:</p>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <span className="rounded-lg bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 shadow-sm">
                    🏥 On Leave
                  </span>
                  <span className="rounded-lg bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 shadow-sm">
                    ⏰ Running Late
                  </span>
                  <span className="rounded-lg bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 shadow-sm">
                    🚨 Sent to Class
                  </span>
                </div>
                <p className="mt-2 text-right text-[10px] text-slate-500">4:10 PM · delivered</p>
              </div>

              <div className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 p-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-ping rounded-full bg-red-400" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-300">
                    No reply after 3 minutes
                  </p>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-white">
                  Red Alert created for the front desk
                </p>
                <p className="mt-1 text-xs text-red-200/80">
                  Student name, parent number and a one-tap call button reach reception at T+13.
                </p>
              </div>

              <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
                Illustrative conversation. WhatsApp dispatch and the Red Alert queue are part of the
                Phase 2 escalation engine; Phase 1 delivers the locked digital attendance sheet.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Reviews                                                             */}
        {/* ------------------------------------------------------------------ */}
        <section id="reviews" className="scroll-mt-24 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                  Social proof
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  4.9★ from 152 Google reviews.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                  Families in Lalpur talk about the VARC teaching, the small PCM batches, and the
                  confidence of knowing where their child is.
                </p>
              </div>
              <RatingBadge />
            </div>

            <div className="no-scrollbar -mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {REVIEWS.map((review) => (
                <figure
                  key={review.name}
                  className="w-[290px] flex-none snap-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:w-[340px]"
                >
                  <div className="flex items-center gap-1 text-amber-500" aria-label="5 out of 5 stars">
                    {Array.from({ length: 5 }, (_, index) => (
                      <StarIcon key={index} className="h-3.5 w-3.5" />
                    ))}
                  </div>
                  <blockquote className="mt-3 text-sm leading-relaxed text-slate-700">
                    “{review.quote}”
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-900 font-display text-[11px] font-bold text-white">
                      {review.name.charAt(0)}
                    </span>
                    <span>
                      <span className="block text-xs font-semibold text-slate-900">{review.name}</span>
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-slate-500">
                        <CheckIcon className="h-3 w-3 text-green-600" />
                        {review.detail}
                      </span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>

            <p className="mt-4 text-[11px] text-slate-500">
              Quotes reflect themes from the P.D.O Classes Google Business Profile. Google and the
              Google logo are trademarks of Google LLC.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Demo booking + contact                                              */}
        {/* ------------------------------------------------------------------ */}
        <section id="demo" className="scroll-mt-24 bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:py-20">
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                  Free demo class
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
                  Book a seat, no obligation.
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Tell us the track and preferred slot. Our team calls within 24 hours to confirm a
                  live class visit.
                </p>
              </div>

              <div className="p-5 sm:p-6">
                <ContactForm initialCourse={activeTrack === 'cat' ? 'CAT' : 'CLASS_12_PCM'} />
              </div>
            </div>

            <div id="contact" className="scroll-mt-24 space-y-5">
              <div className="card p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                  Visit the centre
                </p>
                <h3 className="mt-1.5 font-display text-xl font-bold text-slate-900">
                  {BUSINESS.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{BUSINESS.address}</p>

                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <PhoneIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Call
                      </dt>
                      <dd>
                        <a
                          href={`tel:${BUSINESS.phoneTel}`}
                          className="font-semibold text-slate-900 transition hover:text-blue-700"
                        >
                          {BUSINESS.phoneDisplay}
                        </a>
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-green-50 text-green-700">
                      <WhatsAppIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        WhatsApp
                      </dt>
                      <dd>
                        <a
                          href={whatsappUrl(DEMO_WHATSAPP_MESSAGE)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-slate-900 transition hover:text-green-700"
                        >
                          Chat with the front desk
                        </a>
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 101.06-1.06l-2.78-2.78V5z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Hours
                      </dt>
                      <dd className="font-semibold text-slate-900">Mon–Sat · 7:00 AM – 8:00 PM</dd>
                    </div>
                  </div>
                </dl>

                <div className="mt-5 flex flex-col gap-3">
                  <a
                    href={BUSINESS.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-dark w-full"
                  >
                    Open in Google Maps
                    <ArrowIcon className="h-4 w-4" />
                  </a>
                  <a href={`tel:${BUSINESS.phoneTel}`} className="btn-secondary w-full">
                    <PhoneIcon className="h-4 w-4" />
                    Click to call
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                  What happens next
                </p>
                <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
                  {[
                    'We call to understand the student’s current level.',
                    'You pick a live class that fits your schedule.',
                    'Visit the Lalpur centre and meet the faculty.',
                    'No fee discussion until you are ready.',
                  ].map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-blue-600 text-white">
                        <CheckIcon className="h-3 w-3" />
                      </span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-sm">
              <Logo />
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                CAT / MBA entrance preparation and Class 11–12 PCM coaching in P&amp;T Colony,
                Lalpur, Ranchi. Small batches, senior faculty and a parent-first attendance safety
                loop.
              </p>
              <div className="mt-3">
                <RatingBadge />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 text-xs sm:grid-cols-3">
              <div>
                <p className="font-bold uppercase tracking-wider text-slate-700">Explore</p>
                <ul className="mt-3 space-y-2 text-slate-500">
                  <li>
                    <a href="#courses" className="transition hover:text-slate-900">
                      Courses
                    </a>
                  </li>
                  <li>
                    <a href="#safety" className="transition hover:text-slate-900">
                      Parent safety
                    </a>
                  </li>
                  <li>
                    <a href="#reviews" className="transition hover:text-slate-900">
                      Reviews
                    </a>
                  </li>
                  <li>
                    <a href="#demo" className="transition hover:text-slate-900">
                      Book a demo
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-bold uppercase tracking-wider text-slate-700">Team</p>
                <ul className="mt-3 space-y-2 text-slate-500">
                  <li>
                    <Link to="/login" className="transition hover:text-slate-900">
                      Staff login
                    </Link>
                  </li>
                  <li>
                    <Link to="/app/teacher" className="transition hover:text-slate-900">
                      Teacher attendance
                    </Link>
                  </li>
                  <li>
                    <Link to="/app/dashboard" className="transition hover:text-slate-900">
                      Admin dashboard
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className="font-bold uppercase tracking-wider text-slate-700">Contact</p>
                <ul className="mt-3 space-y-2 text-slate-500">
                  <li>{BUSINESS.address}</li>
                  <li>
                    <a href={`tel:${BUSINESS.phoneTel}`} className="font-semibold text-slate-700">
                      {BUSINESS.phoneDisplay}
                    </a>
                  </li>
                  <li>
                    <a href={`mailto:${BUSINESS.email}`} className="transition hover:text-slate-900">
                      {BUSINESS.email}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-slate-200 pt-4 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {BUSINESS.name}. Lalpur, Ranchi.
            </p>
            <p className="font-mono">Attendance safety loop · Phase 1 foundation</p>
          </div>
        </div>
      </footer>

      {/* Mobile floating call / WhatsApp actions */}
      <div className="fixed bottom-5 right-4 z-40 flex flex-col gap-3 sm:hidden">
        <a
          href={whatsappUrl(DEMO_WHATSAPP_MESSAGE)}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat with P.D.O Classes on WhatsApp"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white shadow-lg shadow-green-900/25 transition active:scale-95"
        >
          <WhatsAppIcon className="h-5 w-5" />
        </a>
        <a
          href={`tel:${BUSINESS.phoneTel}`}
          aria-label={`Call P.D.O Classes on ${BUSINESS.phoneDisplay}`}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-900 text-white shadow-lg shadow-slate-900/25 transition active:scale-95"
        >
          <PhoneIcon className="h-5 w-5" />
        </a>
      </div>
    </div>
  );
}
