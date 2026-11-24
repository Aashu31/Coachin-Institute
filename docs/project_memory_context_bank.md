# Project Memory & Context Bank

## Smart Coaching Website & Real-Time Attendance Escalation System

## 1. Project Identification & High-Level Purpose

* **Project Name:** P.D.O Classes Coaching Platform & Real-Time Attendance Escalation Engine
* **Target Institute:** P.D.O Classes (Lalpur, Ranchi, Jharkhand, India)
* **Core Domains:**
  1. **Marketing & Conversion:** High-converting landing page targeting CAT/MBA and Class 12th PCM aspirants, backed by 4.9★ Google review social proof (152+ reviews).
  2. **Classroom Operations:** 15-second mobile attendance marking PWA for teachers with offline support.
  3. **Automated Parent Escalation:** Event-driven pipeline executing WhatsApp parent verification at $T+10\text{ minutes}$ and triggering front-desk WebSocket Red Alerts at $T+13\text{ minutes}$ for unconfirmed absentees.
* **Architecture Style:** Event-driven, multi-tenant SaaS architecture with PostgreSQL Row Level Security (RLS) and micro-task queues (BullMQ + Redis).

## 2. Technology Stack & Key Libraries

| Tier | Component | Chosen Technology / Library | Key Function |
| ----- | ----- | ----- | ----- |
| **Frontend UI** | Website & Dashboard | React / Next.js + Tailwind CSS | Component UI, SSG/SSR, Desktop Dashboard |
| **Mobile PWA** | Classroom Mobile App | React + Workbox + IndexedDB | Offline-first 15-second attendance marking |
| **API Gateway** | REST & Auth Service | Node.js (Express / Fastify) | REST APIs, JWT validation, RBAC middleware |
| **Real-Time Layer**| WebSockets Engine | Socket.io | Zero-latency Red Alert push to staff UI |
| **Queue Engine** | Delayed Timers | Redis + BullMQ | $T+10\text{ min}$ & $T+13\text{ min}$ execution queues |
| **Database** | Relational Store | PostgreSQL 15 + Prisma ORM | Persistent storage with RLS Multi-Tenancy |
| **Third-Party API**| Messaging Gateway | Meta WhatsApp Cloud API | Interactive quick-reply parent dispatches |

## 3. Project Document Suite & Artifact Index

All foundational specifications have been defined in the following project files:

1. `prd_pdo_classes_attendance_system.md`: Product Requirements Document (Functional requirements, user personas, operational SLAs).
2. `trd_pdo_classes_attendance_system.md`: Technical Requirements Document (System boundaries, DB models, API specifications).
3. `pdo_website_and_app_flow.md`: Complete Website & Application Flow Architecture.
4. `ui_ux_brief_pdo_classes.md`: Comprehensive UI/UX Wireframes, Layouts & Mobile Target Specs.
5. `backend_schema_pdo_classes.md`: PostgreSQL DDL Scripts, Foreign Keys, Indexes & RLS Security Policies.
6. `implementation_plan_pdo_classes.md`: Implementation Roadmap, Milestones & Sprint Schedules.
7. `system_architecture_pdo_classes.md`: High-Level Architecture Diagram, Data Flow & Topology.
8. `rules_pdo_classes_attendance_system.md`: Business Logic Rules, Code Standards & Governance.
9. `design_system_pdo_classes.md`: Color Tokens, Typography Scale, Spacing & Tailwind Configuration.
10. `tasks_pdo_classes_attendance_system.md`: 6 Epics, 30 Task Tickets with Estimates and Acceptance Criteria.
11. `project_memory_pdo_classes.md`: (This file) Master Memory & Context Store.

## 4. Core Business Rules & Timed Escalation State Machine

```
   [ T0: Class Start ]
           │
           ▼
[ Teacher Marks Absent ] ──► Status: ABSENT_UNCONFIRMED
           │
           ▼ [ T + 10 Minutes Elapsed (BullMQ Timer A) ]
[ Dispatch WhatsApp Alert ]
           │
   ┌───────┴───────────────────────────────┐
   │ (Parent Responds within 180s)          │ (No Response by T + 13 mins)
   ▼                                       ▼
[ Quick Reply Captured ]                [ Red Alert Triggered ]
 ├── "On Leave"    ──► PARENT_VERIFIED_LEAVE  ├── Status: ESCALATED_CALL_REQUIRED
 ├── "Running Late"──► PARENT_VERIFIED_LATE   ├── Push WebSocket Event (`EVENT_RED_ALERT`)
 └── "Sent Class"  ──► PARENT_FLAGGED_BUNK    └── Staff Flashing Card + Audible Chime
```

* **Default State:** All roster students are `PRESENT` by default in the mobile PWA.
* **Attendance Deadline:** Teachers submit within **10 minutes** of class start ($T_0$).
* **Verification Window ($T+10\text{ min}$):** System sends Meta WhatsApp interactive template message with quick-reply buttons (`On Leave`, `Running Late`, `Sent to Class`).
* **Red Alert Threshold ($T+13\text{ min}$):** If no parent button tap is received within 180 seconds, state upgrades to `ESCALATED_CALL_REQUIRED` and emits a WebSocket payload to reception.
* **Resolution Policy:** Red Alert task cards cannot be dismissed without a staff phone call attempt and documented result code.

## 5. Design System Snapshot

* **Primary Dark Neutral:** `#0F172A` (`slate-900`) - Hero sections, primary headers.
* **Primary Interactive:** `#2563EB` (`blue-600`) - CTAs, active states, focus rings.
* **Status Colors:**
  * **Present / Verified:** `#16A34A` (`green-600`) / Light: `#DCFCE7` (`green-100`)
  * **Absent / Red Alert:** `#DC2626` (`red-600`) / Light: `#FEE2E2` (`red-100`)
  * **Warning / Pending:** `#D97706` (`amber-600`) / Light: `#FEF3C7` (`amber-100`)
* **Typography:** `Inter` (Body & UI), `Plus Jakarta Sans` (Headlines), `JetBrains Mono` (Counters & Timers).
* **Mobile Touch Rule:** All interactive elements on mobile apps must meet a minimum $48\text{px} \times 48\text{px}$ touch target.

## 6. Multi-Tenant & Security Rules

1. **Row Level Security (RLS):** Every table query must enforce `app.current_institute_id` matching the authenticated JWT token payload.
2. **Stateless JWT Authorization:** Tokens store `user_id`, `institute_id`, and `role`. Expiry set to 15 minutes with rolling refresh token rotation.
3. **Data Privacy (DPDP Act):** Parent contact numbers are masked on public endpoints and encrypted at rest using AES-256.
4. **Idempotent Webhooks:** Inbound WhatsApp webhooks must obtain a 60-second Redis lock (`lock:wa_webhook:{message_id}`) to prevent duplicate execution.

## 7. Development Guidelines & Directives for AI / Developers

* **Single-File Component Rule:** React routes, components, and views should be fully self-contained using inline Tailwind CSS.
* **Math & Scientific Formatting:** All formulas and scientific notation must use standard LaTeX enclosing (`$...$` inline, `$$...$$` block). Unicode symbols for math are prohibited.
* **Strict TypeScript:** No implicit or explicit `any` types. All API payloads, database models, and component props must be explicitly typed.
* **Preserve authentic voice:** Coaching and user-facing communications must maintain a professional, supportive, and authoritative tone suitable for premier coaching institutes.

## 8. Current Implementation Status

```
Overall Completion: 10% (Phase 1: Architecture & Design Complete)
Active Phase: Phase 2 - Core Backend & Component Construction

[x] PRD & TRD Completed
[x] Database Schema & RLS Defined
[x] System Architecture & Flow Documented
[x] Visual Design Tokens & Component Styles Standardized
[x] Epics & Task Tickets Estimated (171 Total Hours)
[ ] Code Implementation (Pending Initial Trigger)
```