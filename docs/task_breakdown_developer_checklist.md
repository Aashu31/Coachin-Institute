# Master Task Breakdown & Development Checklist

## Smart Coaching Website & Real-Time Attendance Escalation System

## 1. Project Overview & Epic Structure

This task document translates the PRD, TRD, System Architecture, and Design System into granular, sprint-ready engineering tasks.

```
Epic 1: Core Backend & Database Infrastructure (Sprint 1)
Epic 2: Public Landing Page & Lead Capture Engine (Sprint 2)
Epic 3: Teacher Mobile Attendance PWA (Sprint 3)
Epic 4: WhatsApp API & Timed Escalation Scheduler (Sprint 4)
Epic 5: Staff Escalation & Admin Real-Time Dashboard (Sprint 5)
Epic 6: Multi-Tenant SaaS Preparation & Production Deployment (Sprint 6)
```

---

## 2. Epic 1: Core Backend & Database Infrastructure

| Task ID | Task Title | Priority | Est. Hours | Assigned To | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TSK-101** | PostgreSQL Database Schema Setup & RLS Migration | High | 8 hrs | Backend Dev | `[ ] Pending` |
| **TSK-102** | User Auth Microservice (JWT, Passwords, RBAC) | High | 6 hrs | Backend Dev | `[ ] Pending` |
| **TSK-103** | Batch & Student Management CRUD Endpoints | Medium | 8 hrs | Backend Dev | `[ ] Pending` |
| **TSK-104** | Redis & BullMQ Initial Queue Setup | High | 4 hrs | Backend Dev | `[ ] Pending` |
| **TSK-105** | Database Seed Script for P.D.O Classes | Medium | 3 hrs | Backend Dev | `[ ] Pending` |

### Detailed Task Specifications

#### TSK-101: PostgreSQL Database Schema Setup & RLS Migration
* **Description:** Execute DDL scripts from `backend_schema_pdo_classes.md` to create tables (`institutes`, `users`, `batches`, `students`, `attendance_sessions`, `attendance_logs`, `escalation_tasks`, `leads`). Set up Row Level Security (RLS) policies.
* **Acceptance Criteria:**
  - All tables created with UUID primary keys and proper foreign key cascades.
  - Custom Enums (`user_role`, `attendance_status`, `task_priority`, `lead_status`) initialized.
  - Test query verifies that `app.current_institute_id` prevents cross-tenant data access.

#### TSK-102: User Auth Microservice
* **Description:** Implement authentication REST endpoints (`POST /api/v1/auth/login`, `GET /api/v1/auth/me`). Support JWT token issuing with user roles (`SUPER_ADMIN`, `INSTITUTE_ADMIN`, `TEACHER`, `RECEPTIONIST`).
* **Acceptance Criteria:**
  - Passwords hashed using bcrypt/argon2 ($cost \ge 10$).
  - JWT payload contains `user_id`, `institute_id`, and `role`.
  - Express middleware (`authMiddleware`, `roleGuard`) rejects unauthorized requests with 401/403 standard error responses.

---

## 3. Epic 2: Public Landing Page & Lead Capture Engine

| Task ID | Task Title | Priority | Est. Hours | Assigned To | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TSK-201** | Setup Tailwind CSS Config & Design Tokens | Medium | 3 hrs | Frontend Dev | `[ ] Pending` |
| **TSK-202** | Public Landing Page Hero & Rating Section | High | 6 hrs | Frontend Dev | `[ ] Pending` |
| **TSK-203** | CAT/MBA & 12th PCM Course Selector Tabs | Medium | 5 hrs | Frontend Dev | `[ ] Pending` |
| **TSK-204** | Embedded Google Reviews Grid (4.9★ Social Proof) | Medium | 4 hrs | Frontend Dev | `[ ] Pending` |
| **TSK-205** | Demo Booking Modal & Lead Submission API | High | 5 hrs | Fullstack Dev | `[ ] Pending` |
| **TSK-206** | Contact & Google Maps Integration (Lalpur, Ranchi) | Low | 2 hrs | Frontend Dev | `[ ] Pending` |

### Detailed Task Specifications

#### TSK-202: Public Landing Page Hero & Rating Section
* **Description:** Build responsive Hero component targeting Ranchi students/parents. Include headline, 4.9★ Google review badge (152 reviews), primary CTA button, and responsive spacing.
* **Acceptance Criteria:**
  - Matches styles specified in `design_system_pdo_classes.md`.
  - CTA button opens Demo Booking Modal (`TSK-205`).
  - Mobile responsive (tested on 375px viewport width).

#### TSK-205: Demo Booking Modal & Lead Submission API
* **Description:** Interactive modal capturing Student Name, WhatsApp Number, Target Course (CAT vs 12th PCM), and Preferred Time Slot. Connect to `POST /api/v1/leads` endpoint.
* **Acceptance Criteria:**
  - WhatsApp phone number validated using regex (`+91` format).
  - Form submission saves lead to `leads` table and returns 201 Created.
  - Triggers automated WhatsApp booking confirmation to the student's phone.

---

## 4. Epic 3: Teacher Mobile Attendance PWA

| Task ID | Task Title | Priority | Est. Hours | Assigned To | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TSK-301** | Mobile PWA Shell & Touch-Optimized Layout | High | 5 hrs | Frontend Dev | `[ ] Pending` |
| **TSK-302** | Today's Batch List & Schedule View | Medium | 4 hrs | Frontend Dev | `[ ] Pending` |
| **TSK-303** | 15-Second Mobile Attendance Roster Screen | High | 8 hrs | Frontend Dev | `[ ] Pending` |
| **TSK-304** | Batch Submission Endpoint `POST /attendance/mark` | High | 6 hrs | Backend Dev | `[ ] Pending` |
| **TSK-305** | Offline LocalStorage/IndexedDB Sync Engine | High | 8 hrs | Frontend Dev | `[ ] Pending` |

### Detailed Task Specifications

#### TSK-303: 15-Second Mobile Attendance Roster Screen
* **Description:** Build student list view where all rows are set to `PRESENT` (Green) by default. Tapping missing students toggles state to `ABSENT` (Red outline/fill) with minimum 48px touch height per row.
* **Acceptance Criteria:**
  - Touch targets adhere to $48\text{px} \times 48\text{px}$ rule.
  - Submit button shows dynamic absent count (e.g., "Submit Attendance (2 Absent)").
  - Form submit triggers haptic feedback (if supported) and displays toast confirmation.

#### TSK-305: Offline LocalStorage Sync Engine
* **Description:** Implement Service Worker & IndexedDB store. If teacher loses mobile network inside classroom, cache attendance record locally and automatically flush to backend when network connection recovers.
* **Acceptance Criteria:**
  - Attendance can be submitted with Chrome DevTools set to "Offline".
  - Auto-sync triggers on `window.addEventListener('online')` event.
  - Zero loss of marked attendance logs during network drops.

---

## 5. Epic 4: WhatsApp Integration & Timed Scheduler Queue

| Task ID | Task Title | Priority | Est. Hours | Assigned To | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TSK-401** | Meta WhatsApp Business API SDK Wrapper | High | 6 hrs | Backend Dev | `[ ] Pending` |
| **TSK-402** | BullMQ Queue Setup ($T+10\text{ min}$ Verification Delay) | High | 8 hrs | Backend Dev | `[ ] Pending` |
| **TSK-403** | WhatsApp Quick-Reply Template Message Sender | High | 5 hrs | Backend Dev | `[ ] Pending` |
| **TSK-404** | Inbound Webhook Listener (`POST /webhooks/whatsapp`) | High | 8 hrs | Backend Dev | `[ ] Pending` |
| **TSK-405** | $T+3\text{ min}$ Unconfirmed Escalation Scheduler | High | 6 hrs | Backend Dev | `[ ] Pending` |

### Detailed Task Specifications

#### TSK-402: BullMQ Queue Setup ($T+10\text{ min}$ Verification Delay)
* **Description:** When teacher submits attendance, for every `ABSENT_UNCONFIRMED` student, push a delayed job to Redis queue (`whatsapp-dispatch-queue`) with execution time = $T_{\text{start}} + 10\text{ minutes}$.
* **Acceptance Criteria:**
  - Delay accurately calculated based on class start timestamp.
  - Redis persistent queue holds state across server restarts.
  - Job worker verifies record status before sending WhatsApp alert (skips if manually corrected).

#### TSK-404: Inbound Webhook Listener
* **Description:** Endpoint `/api/v1/webhooks/whatsapp` to capture parent quick-reply button payload (`On Leave`, `Running Late`, `Sent to Class`). Update `attendance_logs` and cancel pending escalation timers.
* **Acceptance Criteria:**
  - Validates Meta HMAC SHA-256 signature header.
  - Uses Redis lock `lock:wa_webhook:{msg_id}` to prevent duplicate processing.
  - Correctly transitions status (`PARENT_VERIFIED_LEAVE`, `PARENT_VERIFIED_LATE`, `PARENT_FLAGGED_BUNK`).

---

## 6. Epic 5: Staff Escalation & Admin Real-Time Dashboard

| Task ID | Task Title | Priority | Est. Hours | Assigned To | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TSK-501** | Desktop Admin Dashboard Skeleton & KPI Metrics | Medium | 6 hrs | Frontend Dev | `[ ] Pending` |
| **TSK-502** | Socket.io Real-Time WebSocket Gateway | High | 6 hrs | Backend Dev | `[ ] Pending` |
| **TSK-503** | Flashing Red Alert Call Task Card Component | High | 5 hrs | Frontend Dev | `[ ] Pending` |
| **TSK-504** | 1-Click "Call Parent" Launcher & Outcome Modal | High | 6 hrs | Fullstack Dev | `[ ] Pending` |
| **TSK-505** | Student & Parent Attendance History Table | Low | 5 hrs | Frontend Dev | `[ ] Pending` |

### Detailed Task Specifications

#### TSK-503: Flashing Red Alert Call Task Card Component
* **Description:** Build Red Alert Card component using styles from `design_system_pdo_classes.md`. Card renders on front-desk dashboard when $T+13\text{ min}$ timer expires without parent reply.
* **Acceptance Criteria:**
  - Card features pulsing red indicator (`animate-ping`) and glowing shadow (`shadow-red`).
  - Displays student name, roll number, batch info, parent name, and phone number.
  - Plays soft audible chime on card appearance.

#### TSK-504: 1-Click "Call Parent" Launcher & Outcome Modal
* **Description:** Clicking "Call Parent" opens modal to log call results (`VERIFIED_SICK`, `BUNK_CONFIRMED`, `LINE_UNREACHABLE`). Submitting resolves `escalation_tasks` record and clears alert card.
* **Acceptance Criteria:**
  - Support `tel:+91...` deep link for direct dialing from mobile/softphone.
  - Task cannot be closed without selecting an outcome and entering a staff note.
  - Live status updates in DB and updates WebSocket room state.

---

## 7. Epic 6: Multi-Tenant SaaS Preparation & Production Deployment

| Task ID | Task Title | Priority | Est. Hours | Assigned To | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TSK-601** | Environment Config & Production Dockerfile | High | 4 hrs | DevOps | `[ ] Pending` |
| **TSK-602** | Multi-Tenant Dynamic Subdomain Routing | Medium | 6 hrs | Backend Dev | `[ ] Pending` |
| **TSK-603** | End-to-End Testing (Happy Path & Escalation Path) | High | 8 hrs | QA / Dev | `[ ] Pending` |
| **TSK-604** | Production Deployment (Vercel + Render + Postgres) | High | 5 hrs | DevOps | `[ ] Pending` |
| **TSK-605** | Staff & Teacher Onboarding Walkthrough at Lalpur | High | 4 hrs | Project Lead | `[ ] Pending` |

---

## 8. Development Progress Tracker Summary

```
Total Epics: 6
Total Tasks: 30
Total Estimated Effort: 171 Hours

[░░░░░░░░░░░░░░░░░░░░] 0% Completed (0 / 30 Tasks)
```