# P.D.O Classes — Phase 3 Core Application

Multi-tenant coaching platform and real-time attendance escalation engine for
**P.D.O Classes, P&T Colony, Lalpur, Ranchi, Jharkhand 834001** · `083404 06593`.

This repository contains the completed Phase 3 core: the strict TypeScript
monorepo, PostgreSQL schema with Row Level Security, JWT auth, the public
landing page and demo-booking flow, role-aware staff dashboards, the
15-second teacher mobile attendance sheet with offline draft caching, the
**Real-Time WhatsApp Alert & Red Alert Escalation Engine**, and the
**Institute Admin Management & Demo Lead Pipeline**.

---

## Repository layout

```
.
├── client/                 React 18 + Vite + Tailwind CSS + strict TypeScript
│   └── src/
│       ├── App.tsx         Route map + auth guard
│       ├── lib/
│       │   ├── api.ts      Typed API client with refresh-token retry
│       │   ├── auth.tsx    Session context
│       │   └── attendanceDraft.ts  localStorage draft + offline queue
│       └── pages/
│           ├── LandingPage.tsx      Public marketing + demo form
│           ├── LoginPage.tsx        Staff sign-in
│           └── dashboard/
│               ├── DashboardLayout.tsx
│               ├── OverviewPage.tsx
│               ├── TeacherAttendancePage.tsx
│               ├── EscalationDashboard.tsx   # Phase 2: Red Alert call queue
│               ├── LeadsManager.tsx          # Phase 3: Demo lead pipeline UI
│               ├── StudentsBatchesManager.tsx # Phase 3: Student & batch CRUD + CSV import
│               └── AttendanceAnalytics.tsx    # Phase 3: Daily attendance report & CSV export
├── server/                 Node.js + Express + strict TypeScript
│   ├── src/
│   │   ├── config/env.ts   Zod-validated environment
│   │   ├── db/
│   │   │   ├── migrations/001_initial_schema.sql
│   │   │   ├── migrations/002_phase1_public_leads_and_attendance.sql
│   │   │   ├── migrate.ts  Transactional migration runner with checksums
│   │   │   ├── pool.ts     pg pool + tenant-scoped transactions
│   │   │   └── seed.ts     Idempotent P.D.O Classes seed
│   │   ├── middleware/     JWT auth, tenant context, error envelope
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── health.routes.ts
│   │   │   ├── lead.routes.ts
│   │   │   ├── batch.routes.ts
│   │   │   ├── attendance.routes.ts
│   │   │   ├── escalation.routes.ts      # Phase 2: Red Alert CRUD
│   │   │   ├── webhooks.ts               # Phase 2: WhatsApp webhook receiver
│   │   │   └── admin.routes.ts           # Phase 3: Admin CRUD (leads, batches, students, reports)
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── lead.service.ts
│   │   │   ├── batch.service.ts
│   │   │   ├── attendance.service.ts
│   │   │   ├── whatsapp.service.ts       # Phase 2: Meta Cloud API wrapper + mock mode
│   │   │   ├── escalation.service.ts     # Phase 2: Red Alert task lifecycle
│   │   │   ├── socket.service.ts         # Phase 2: Socket.io server for real-time alerts
│   │   │   └── admin.service.ts          # Phase 3: Admin CRUD & daily attendance report
│   │   ├── queues/
│   │   │   ├── redis.ts                  # Phase 2: ioredis client + locks
│   │   │   └── attendanceQueue.ts        # Phase 2: BullMQ workers (verify-absentees, check-parent-reply)
│   │   └── ...
│   └── ...
└── docs/                   Product, architecture and governance specifications
```

---

## Prerequisites

- Node.js **20+** and npm **10+**
- PostgreSQL **15+** running locally
- Redis **7+** (required for BullMQ job queues in Phase 2)
- A Meta WhatsApp Cloud API account (values are placeholders; `WHATSAPP_MOCK_MODE=true` enables local testing without credentials)

---

## Setup

```bash
# 1. Install all workspaces
npm install

# 2. Create the database
createdb pdo_classes

# 3. Configure the API
cp server/.env.example server/.env
#    -> set DATABASE_URL (pdo_app), DATABASE_MIGRATION_URL (owner), JWT secrets
#    -> PUBLIC_INSTITUTE_SLUG defaults to pdo-classes
#    -> ATTENDANCE_VERIFY_DELAY_MS=600000 (10 min), PARENT_REPLY_WINDOW_MS=180000 (3 min)
#    -> WHATSAPP_MOCK_MODE=true (local testing without Meta credentials)

# 4. Configure the web client
cp client/.env.example client/.env

# 5. Create the schema and seed the pilot tenant (connects as the owner)
npm run db:setup

# 6. Enable the restricted API role with the password used in DATABASE_URL
psql -U postgres -d pdo_classes -c "ALTER ROLE pdo_app LOGIN PASSWORD 'change_me_to_your_app_password';"

# 7. Run both apps
npm run dev
```

- Public site: <http://localhost:5173/>
- Staff login: <http://localhost:5173/login>
- Teacher attendance: <http://localhost:5173/app/teacher>
- API: <http://localhost:4000>
- Health: <http://localhost:4000/api/v1/health>

### Tenant-isolation probe

```bash
# 1. Log in as the seeded institute admin
curl -s http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pdoclasses.in","password":"PdoClasses@2026"}'

# 2. Call the tenant-scoped probe with the returned accessToken
curl -s http://localhost:4000/api/v1/tenant/health \
  -H "Authorization: Bearer <accessToken>"
```

`rlsActive: true` and non-zero `visibleStudents` / `visibleBatches` confirm that
`app.current_institute_id` was applied to the transaction.

---

## Seeded data

| Role | Name | Login |
| --- | --- | --- |
| Institute Admin | Prakash Dev Ojha | `admin@pdoclasses.in` |
| Front Desk / Receptionist | Neha Kumari | `reception@pdoclasses.in` |
| CAT / English Mentor | Ananya Sinha | `ananya.sinha@pdoclasses.in` |
| Class 12 PCM Faculty | Rakesh Verma | `rakesh.verma@pdoclasses.in` |

All demo accounts share `SEED_DEFAULT_PASSWORD` from `server/.env` (never sent to
the client bundle). Re-running `npm run db:seed` is safe: it upserts on natural
keys and resets the demo password.

| Batch | Time | Room | Students |
| --- | --- | --- | --- |
| CAT 2026 Evening Batch | 16:00–18:00, Mon–Sat | Room 201 | Rahul Kumar, Sneha Agarwal, Aditya Mahto |
| Class 12 PCM Morning Batch | 08:00–10:00, Mon–Sat | Room 101 | Priya Singh, Karan Oraon, Fatima Ansari |

---

## Row Level Security contract

The migration enables RLS on `institutes`, `users`, `batches`, `students`,
`attendance_sessions`, `attendance_logs`, `escalation_tasks` and `leads`, with a
single `tenant_isolation_policy` per table:

```sql
USING      (institute_id = app_current_institute_id())
WITH CHECK (institute_id = app_current_institute_id())
```

`app_current_institute_id()` reads `current_setting('app.current_institute_id', true)`
and returns `NULL` when the value is absent or not a UUID → deny by default.

`server/src/db/pool.ts` executes every tenant statement inside:

```sql
BEGIN;
SELECT set_config('app.current_institute_id', $1, TRUE);  -- transaction-local
-- ...tenant statement...
COMMIT;  -- setting is discarded, so pooled connections cannot leak tenants
```

### Role model (required for enforcement)

PostgreSQL table owners bypass RLS unless `FORCE ROW LEVEL SECURITY` is set. This
project deliberately relies on that:

- **Migrations + seed** run through `DATABASE_MIGRATION_URL` as the database
  owner (`postgres` / `pdo_migrator`). The `SECURITY DEFINER` login functions
  run as this owner so authentication can resolve a globally-unique email before
  a tenant is known.
- **The API** connects through `DATABASE_URL` as the restricted `pdo_app` role
  created by the migration. That role is `NOLOGIN` until an operator enables it:

```sql
ALTER ROLE pdo_app LOGIN PASSWORD '<strong-random-password>';
```

Then set `DATABASE_URL=postgresql://pdo_app:<password>@localhost:5432/pdo_classes`.
Both pools are created in `server/src/db/pool.ts`; request handlers can only ever
receive the tenant-scoped `Pool` from `DATABASE_URL`.

Do **not** add `FORCE ROW LEVEL SECURITY` to `users` or `institutes`; it would
block the pre-authentication lookup functions.

### Cross-tenant verification

```sql
BEGIN;
SELECT set_config('app.current_institute_id', '<institute-A-uuid>', TRUE);
SELECT COUNT(*) FROM students;   -- only institute A rows
COMMIT;
```

---

## Phase 1 application routes

| Client route | Access | Screen |
| --- | --- | --- |
| `/` | Public | Landing page, dual course tracks, Google reviews, demo booking |
| `/login` | Public | Staff sign-in with seeded demo account shortcuts |
| `/app` | Bearer session | Redirects by role (`TEACHER` → attendance) |
| `/app/dashboard` | Admin / Receptionist | Today’s timetable, KPI cards, attendance snapshot |
| `/app/teacher` | All staff | 375px-first attendance sheet, draft cache, submit modal |

The teacher sheet defaults every student to **PRESENT**, uses ≥48px tap rows,
saves a localStorage draft on every tap, queues submissions made offline, and
retries the queue automatically on `online`. Teachers can only see and submit
their own assigned batches.

---

## API surface (Phase 1 + 2)

`/api/v1/...` is the canonical surface. The Phase 1 specification’s `/api/...`
paths are mounted as aliases to the same handlers.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | Public | Liveness + PostgreSQL clock |
| `POST` | `/api/v1/auth/login` | Public | Issue 15-minute access + refresh tokens |
| `POST` | `/api/v1/auth/refresh` | Public | Rotate tokens after re-validating the user |
| `GET` | `/api/v1/auth/me` | Bearer + tenant | Current staff profile (RLS-scoped) |
| `GET` | `/api/v1/tenant/health` | Bearer + tenant | Proves tenant GUC and RLS filter |
| `POST` | `/api/v1/leads/demo` | Public | Demo booking → `leads` row (tenant-scoped write) |
| `GET` | `/api/v1/batches` | Bearer + tenant | Today’s timetable + all active batches |
| `GET` | `/api/v1/batches/:id/students` | Bearer + tenant | Roster + today’s existing sheet |
| `POST` | `/api/v1/attendance/submit` | Bearer + tenant | Lock a daily sheet idempotently |

### Phase 2: Escalation Engine

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/escalation/tasks` | Bearer + tenant | List active Red Alert tasks |
| `POST` | `/api/v1/escalation/tasks/resolve` | Bearer + tenant | Resolve a Red Alert (call outcome + notes) |
| `GET` | `/api/v1/webhooks/whatsapp` | Public (Meta challenge) | WhatsApp webhook verification |
| `POST` | `/api/v1/webhooks/whatsapp` | Public (Meta callback) | Parent quick-reply handler (button payload) |

The `POST /api/v1/attendance/submit` now enqueues a delayed **verify-absentees** job (BullMQ) that fires at `T+10 min` (configurable via `ATTENDANCE_VERIFY_DELAY_MS`). For each `ABSENT_UNCONFIRMED` student it dispatches an interactive WhatsApp template message (Quick Reply buttons: *On Leave*, *Running Late*, *Sent to Class*), updates the log to `ALERT_SENT`, and enqueues a **check-parent-reply** job at `T+3 min` (`PARENT_REPLY_WINDOW_MS`). If no reply arrives, the log becomes `ESCALATION_CALL_REQUIRED`, a high-priority `escalation_task` is created, and a Socket.io `escalation:new_alert` event is emitted to the institute's room.

The WhatsApp webhook (`/api/v1/webhooks/whatsapp`) verifies HMAC signatures (skipped in `WHATSAPP_MOCK_MODE`), parses button payloads (`BTN_LEAVE|LATE|BUNK_<logId>`), updates the log to `PARENT_VERIFIED_LEAVE|LATE|BUNK`, auto-resolves any open escalation task, and broadcasts `attendance:status_updated` via Socket.io.

### Phase 3: Admin Management & Lead Pipeline

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/leads` | Bearer + tenant (Admin/Receptionist) | Paginated list of demo leads with status filter |
| `PATCH` | `/api/v1/admin/leads/:id` | Bearer + tenant (Admin/Receptionist) | Update lead status (`NEW` → `CONTACTED` → `DEMO_SCHEDULED` → `ENROLLED`/`LOST`) + notes |
| `GET` | `/api/v1/admin/batches` | Bearer + tenant (Admin/Receptionist) | List all batches with student counts |
| `POST` | `/api/v1/admin/batches` | Bearer + tenant (Admin/Receptionist) | Create a batch (name, course, teacher, schedule, room) |
| `PATCH` | `/api/v1/admin/batches/:id` | Bearer + tenant (Admin/Receptionist) | Update batch details |
| `GET` | `/api/v1/admin/students` | Bearer + tenant (Admin/Receptionist) | Paginated student list with optional batch filter |
| `POST` | `/api/v1/admin/students` | Bearer + tenant (Admin/Receptionist) | Create a student (name, roll, parent, WhatsApp, batch) |
| `PATCH` | `/api/v1/admin/students/:id` | Bearer + tenant (Admin/Receptionist) | Update student details |
| `POST` | `/api/v1/admin/students/bulk` | Bearer + tenant (Admin/Receptionist) | CSV bulk import (Name, Roll No, Parent Name, Parent WhatsApp, Secondary Phone, Batch ID) |
| `GET` | `/api/v1/admin/reports/daily` | Bearer + tenant (Admin/Receptionist) | Daily attendance report: totals, per-batch breakdown, present %, avg parent response time, unresolved red alerts |

The **Leads Inbox** (`/app/admin/leads`) shows incoming demo requests with one-tap WhatsApp follow-up links and a status pipeline dropdown. The **Students & Batches Manager** (`/app/admin/students`) supports individual CRUD and CSV roster upload with instant validation preview. The **Daily Attendance Report** (`/app/admin/analytics`) provides clean summary cards and an exportable CSV table so the institute owner can review batch-wise punctuality.

### Attendance submit contract

```json
{
  "batchId": "c0000000-0000-4000-8000-000000000001",
  "attendanceDate": "2026-11-23",
  "records": [
    { "studentId": "d0000000-0000-4000-8000-000000000001", "status": "PRESENT" },
    { "studentId": "d0000000-0000-4000-8000-000000000003", "status": "ABSENT" }
  ]
}
```

- Every active student must appear exactly once; otherwise `422 ROSTER_INCOMPLETE`,
  `422 ROSTER_MISMATCH` or `422 DUPLICATE_STUDENT`.
- `ABSENT` is persisted as `ABSENT_UNCONFIRMED`, the Phase 2 WhatsApp queue state.
- One session per `(batch_id, session_date)` is enforced by a unique index.
- An identical replay returns `200` with `idempotentReplay: true`.
- A changed mark on a locked sheet returns `409 ATTENDANCE_LOCKED`.
- Only today’s sheet (Asia/Kolkata) can be submitted, preserving the 10-minute
  marking window rule.
- Parent WhatsApp numbers are never selected by batch or roster APIs.

Errors use the governance envelope:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TENANT_ID",
    "message": "The provided institute ID is invalid or inactive.",
    "timestamp": "2026-11-23T19:24:00Z"
  }
}
```

---

## Engineering rules enforced here

- `strict: true`, `noUncheckedIndexedAccess`, no `any` in either package.
- JWT claims: `sub`, `institute_id`, `role`, `type`; 15-minute access TTL.
- Bcrypt cost is validated at `>= 10` (default 12).
- Parent WhatsApp numbers are never part of a client response or bundle.
- All SQL is parameterised; the tenant id uses `set_config`, not interpolation.
- The client validates the API envelope at runtime and types every DTO; the
  session bearer token is attached per request, with a single refresh retry.
- Prettier: 2 spaces, single quotes, trailing commas.
- Tailwind brand tokens: `#0F172A` navy, `#2563EB` primary, `#16A34A` present,
  `#DC2626` absent, `#D97706` warning, `JetBrains Mono` timers.
- **Phase 2**: BullMQ job idempotency via Redis locks (`lock:wa_webhook:{message_id}`),
  webhook HMAC verification, Socket.io JWT-authenticated rooms per institute.
- **Phase 3**: Raw-body capture for webhook HMAC verification, RBAC on admin routes
  (`INSTITUTE_ADMIN`/`RECEPTIONIST`), CSV import with E.164 phone normalization,
  daily report aggregation with parent response time metrics.

## Deliberately out of Phase 3

Audited retro-active edits, PDF analytics exports, multi-tenant SaaS onboarding UI.
The schema, enums, statuses and tenant/attendance/escalation/admin contracts
those features need are already in place.
