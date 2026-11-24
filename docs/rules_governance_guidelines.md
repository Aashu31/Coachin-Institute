# System Rules, Business Logic & Engineering Guidelines

## Smart Coaching Website & Real-Time Attendance Escalation System

## 1. Document Overview & Scope

This document establishes the mandatory business logic, code standards, data privacy guidelines, and operational policies for developers, system administrators, teachers, and front-desk staff interacting with the **P.D.O Classes Platform & Attendance Escalation Engine**.

---

## 2. Core Business Logic & Attendance Rules

### 2.1 Attendance Marking Window ($T_0$ to $T+10\text{ min}$)
* **Rule 1.1 (Default State):** In the Teacher Mobile PWA, all enrolled students in an active batch are set to `PRESENT` by default. Teachers must explicitly toggle absent students to `ABSENT_UNCONFIRMED`.
* **Rule 1.2 (Submission Deadline):** Teachers must submit batch attendance within **10 minutes** of the scheduled class start time ($T_{\text{start}}$).
* **Rule 1.3 (Auto-Reminders):** If attendance is not submitted by $T_{\text{start}} + 5\text{ minutes}$, an automated SMS/Push notification is sent to the assigned teacher's device: *"Reminder: Please mark attendance for [Batch Name]."**
* **Rule 1.4 (Locking Rule):** Once submitted, attendance logs are locked for modification by the teacher. Any retro-active edits must be performed by an `INSTITUTE_ADMIN` or `RECEPTIONIST` with an audit note.

### 2.2 Timed Escalation Engine Rules ($T+10\text{ min}$ & $T+13\text{ min}$)
* **Rule 2.1 (Verification Dispatch):** At $T_{\text{start}} + 10\text{ minutes}$, the automated scheduler processes all `ABSENT_UNCONFIRMED` entries and dispatches an interactive WhatsApp message to the primary registered parent number.
* **Rule 2.2 (Parent Quick-Reply Window):** The system grants a **180-second (3-minute)** window from WhatsApp dispatch ($T+10\text{ min}$ to $T+13\text{ min}$) for the parent to select a quick-reply button (`On Leave`, `Running Late`, `Sent to Class`).
* **Rule 2.3 (State Transition on Response):**
  * `[ On Leave ]` $\rightarrow$ Status set to `PARENT_VERIFIED_LEAVE`. Pending escalation timer canceled.
  * `[ Running Late ]` $\rightarrow$ Status set to `PARENT_VERIFIED_LATE`. Pending escalation timer canceled.
  * `[ Sent to Class ]` $\rightarrow$ Status set to `PARENT_FLAGGED_BUNK`. High-priority notification raised immediately to reception staff.
* **Rule 2.4 (Red Alert Trigger):** If no reply is registered by $T_{\text{start}} + 13\text{ minutes}$, the status automatically updates to `ESCALATED_CALL_REQUIRED`, emitting a mandatory **Red Alert** event to the Receptionist Dashboard.
* **Rule 2.5 (Call Resolution Policy):** A Red Alert task cannot be dismissed without selecting a valid call outcome (`VERIFIED_SICK`, `BUNK_CONFIRMED`, `LINE_UNREACHABLE`) and entering a brief staff note.

---

## 3. Engineering & Code Quality Standards

### 3.1 Codebase & File Architecture
* **Rule 3.1 (Single-File Mandate for React Components):** Production components, UI views, and styling for individual routes must adhere to single-file self-contained principles (`.jsx` / `.tsx`) using Tailwind CSS utility classes.
* **Rule 3.2 (TypeScript Usage):** Strict TypeScript mode (`strict: true`) must be enabled across backend and frontend repositories. No usage of explicit `any` types without documented justification.
* **Rule 3.3 (Formatting Standards):** Use Prettier (2 spaces, single quotes, trailing commas) and ESLint enforcing clean functional design patterns.

### 3.2 Backend & API Design Rules
* **Rule 3.4 (RESTful Naming):** API endpoints must use standard noun-based URIs with plural resource names (e.g., `/api/v1/batches`, `/api/v1/attendance/mark`).
* **Rule 3.5 (Stateless Authentication):** All protected backend APIs require a valid Bearer JWT header. Session state must not be stored in Node.js application memory.
* **Rule 3.6 (Error Handling Schema):** API responses must conform to a unified JSON error format:
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

## 4. Multi-Tenancy & Data Security Rules

### 4.1 Strict Multi-Tenancy Isolation
* **Rule 4.1 (Tenant Context Enforcement):** Every SQL query executed against PostgreSQL **MUST** evaluate the `institute_id` context.
* **Rule 4.2 (Row Level Security):** All database tables storing tenant data (`students`, `batches`, `attendance_logs`, `leads`) must enforce PostgreSQL Row Level Security (RLS). Cross-tenant queries are strictly prohibited at the database engine level.

### 4.2 Data Privacy & Compliance (DPDP Act India Alignment)
* **Rule 4.3 (Parent Contact Confidentiality):** Parent WhatsApp numbers and student contact records must never be exposed publicly via client APIs or client-side JavaScript bundles.
* **Rule 4.4 (Opt-Out & Messaging Policy):** WhatsApp messages must strictly comply with Meta Cloud API transactional guidelines. Marketing content is strictly forbidden inside attendance alert templates.
* **Rule 4.5 (Audit Logging):** All manual state overrides (e.g., receptionist changing an absent mark to present manually) must log the operator ID, timestamp, old state, new state, and justification note in `audit_logs`.

---

## 5. Operational & Reliability Rules

### 5.1 System Performance Targets (SLAs)
* **Rule 5.1 (API Latency):** 95% of attendance marking requests (`POST /attendance/mark`) must complete in **< 300ms**.
* **Rule 5.2 (WhatsApp Dispatch Latency):** 99% of $T+10\text{ min}$ verification alerts must be dispatched to Meta Cloud API within **5 seconds** of the timer trigger.
* **Rule 5.3 (Red Alert Delivery):** WebSocket `EVENT_RED_ALERT` emissions must reflect on active staff dashboards within **1 second** of the $T+13\text{ min}$ timeout.

### 5.2 Failover & Offline Operational Rules
* **Rule 5.4 (Classroom Connectivity Loss):** The Teacher Mobile PWA must allow marking offline when classroom cellular signal fails. Records must store in IndexedDB and automatically sync upon network reconnection.
* **Rule 5.5 (Webhook Idempotency):** Inbound WhatsApp webhook handlers must use Redis locks (`lock:wa_webhook:{message_id}`) with a 60-second expiry to prevent duplicate event execution caused by network retries.