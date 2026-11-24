# Technical Requirement Document (TRD)

## Smart Coaching Website & Real-Time Attendance Escalation System

## 1. System Overview & Engineering Goals

* **Project Title:** Attendance Escalation System & Multi-Tenant Coaching SaaS
* **Document Version:** 1.0.0
* **Architecture Style:** Client-Server Monolith (Phase 1) transitioning to Distributed Micro-SaaS (Phase 2)
* **Core Technical Objective:** Provide sub-second UI response time for mobile attendance marking, guarantee high-throughput WhatsApp notification dispatch, and run precision timed escalation timers (T+10 min verification, T+3 min escalation trigger).

---

## 2. System Architecture & Component Diagram

### 2.1 Tech Stack Specification

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend UI** | React.js (Vite) + Tailwind CSS | Fast loading, lightweight, mobile-first responsive design for touch UI. |
| **Backend API** | Node.js (TypeScript) + Express / Fastify | Asynchronous I/O handling high-concurrency WhatsApp webhooks and real-time events. |
| **Primary Database** | PostgreSQL | Relational integrity, ACID compliance, structured indexing for multi-tenant isolation. |
| **In-Memory Cache & Queue** | Redis + BullMQ | Handles background queue jobs, state locking, and scheduled delayed timers (T+10, T+3). |
| **Real-time WebSockets** | Socket.io | Pushes immediate "RED ALERT" notifications to Front-Desk Admin Dashboard without page refresh. |
| **Messaging Gateway** | Meta WhatsApp Business API / Waapi | Interactive template messaging (`Quick Reply` buttons) with inbound webhook listeners. |
| **Infrastructure / Host** | Docker + Railway / Render / VPS (Ubuntu) | Containerized deployment with automated CI/CD pipelines. |

---

## 3. Database Schema & Data Models

### 3.1 Relational ER Diagram Concept

```
[ Institutes ] 1 ─── N [ Users (Admin/Teachers) ]
      │
      ├─── 1 ─── N [ Batches ] 1 ─── N [ Students ]
      │                                    │
      └───────────────────────── 1 ─── N [ Attendance_Logs ] 1 ─── 1 [ Escalation_Tasks ]
```

### 3.2 SQL DDL Schema Definition

```sql
-- Core Institute Multi-Tenancy Table
CREATE TABLE institutes (
    institute_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    whatsapp_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users (Admins, Teachers, Staff)
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'INSTITUTE_ADMIN', 'TEACHER', 'STAFF');

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID REFERENCES institutes(institute_id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'TEACHER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Batches
CREATE TABLE batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID REFERENCES institutes(institute_id) ON DELETE CASCADE,
    batch_name VARCHAR(255) NOT NULL, -- e.g. "CAT 2026 Morning Batch"
    subject VARCHAR(100),
    teacher_id UUID REFERENCES users(user_id),
    scheduled_start_time TIME NOT NULL,
    scheduled_end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Students & Parent Contact Info
CREATE TABLE students (
    student_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID REFERENCES institutes(institute_id) ON DELETE CASCADE,
    batch_id UUID REFERENCES batches(batch_id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    roll_number VARCHAR(50),
    parent_name VARCHAR(255) NOT NULL,
    parent_whatsapp VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Attendance & Escalation Lifecycle Logs
CREATE TYPE attendance_status AS ENUM (
    'PRESENT', 
    'ABSENT_UNCONFIRMED', 
    'PARENT_VERIFIED_LEAVE', 
    'PARENT_VERIFIED_LATE', 
    'PARENT_FLAGGED_BUNK', 
    'ESCALATED_CALL_REQUIRED', 
    'CALL_RESOLVED'
);

CREATE TABLE attendance_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID REFERENCES institutes(institute_id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(student_id) ON DELETE CASCADE,
    batch_id UUID REFERENCES batches(batch_id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status attendance_status NOT NULL DEFAULT 'ABSENT_UNCONFIRMED',
    marked_by UUID REFERENCES users(user_id),
    marked_at TIMESTAMP WITH TIME ZONE,
    whatsapp_sent_at TIMESTAMP WITH TIME ZONE,
    parent_response VARCHAR(100),
    parent_responded_at TIMESTAMP WITH TIME ZONE,
    escalation_triggered BOOLEAN DEFAULT FALSE,
    call_resolved_by UUID REFERENCES users(user_id),
    call_resolution_notes TEXT,
    CONSTRAINT unique_student_batch_date UNIQUE (student_id, batch_id, date)
);
```

---

## 4. State Machine & Timed Escalation Workflow

### 4.1 Attendance Log State Diagram

```
 [ UNMARKED ]
      │ (Teacher Marks Absent)
      ▼
 [ ABSENT_UNCONFIRMED ] ──(System Sends WhatsApp)──> [ WAITING_PARENT_REPLY ]
                                                            │
         ┌──────────────────────────────────────────────────┴──────────────────────────────────┐
         │ (Parent clicks button within 3 min)                                                 │ (Timer T+3 mins expires without response)
         ▼                                                                                     ▼
 [ PARENT_VERIFIED_LEAVE / LATE / BUNK ]                                            [ ESCALATED_CALL_REQUIRED ]
                                                                                               │
                                                                                               │ (Staff calls parent & logs note)
                                                                                               ▼
                                                                                        [ CALL_RESOLVED ]
```

### 4.2 BullMQ Timed Scheduler Architecture

1. **Teacher Submits Attendance ($T_0$):**
   * Endpoint `POST /api/v1/attendance/submit` processes the batch.
   * Inserts records into `attendance_logs`.
   * For every `ABSENT_UNCONFIRMED` student, enqueues a delayed job in BullMQ: `whatsapp_dispatch_queue` (Delay: 10 minutes from class start time $T_{\text{start}}$).

2. **WhatsApp Dispatch Job Trigger ($T + 10\text{ min}$):**
   * Sends Meta Interactive Template Message with 3 Quick Reply payload buttons:
     * `BTN_LEAVE` -> `action: PARENT_VERIFIED_LEAVE`
     * `BTN_LATE` -> `action: PARENT_VERIFIED_LATE`
     * `BTN_BUNK` -> `action: PARENT_FLAGGED_BUNK`
   * Updates `whatsapp_sent_at` timestamp.
   * Immediately enqueues an **Escalation Monitor Job** in `escalation_queue` with a 3-minute TTL (180,000 ms).

3. **Escalation Monitor Trigger ($T + 13\text{ min}$):**
   * Checks `attendance_logs` table for `log_id`.
   * If `status` is still `ABSENT_UNCONFIRMED` or `WAITING_PARENT_REPLY`:
     * Updates status to `ESCALATED_CALL_REQUIRED`.
     * Emits a real-time WebSocket event (`EVENT_RED_ALERT`) to the institute's active Admin Dashboard socket room.

---

## 5. API Interface Specifications

### 5.1 Teacher Mobile Attendance Submission
* **Endpoint:** `POST /api/v1/attendance/mark`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`
* **Request Body:**
```json
{
  "batch_id": "c8f2b3e4-5678-4a90-b123-9876543210fe",
  "date": "2026-11-23",
  "records": [
    { "student_id": "a1b2c3d4-0001", "status": "PRESENT" },
    { "student_id": "a1b2c3d4-0002", "status": "ABSENT_UNCONFIRMED" }
  ]
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Attendance marked successfully. 1 absent record scheduled for verification.",
  "scheduled_whatsapp_time": "2026-11-23T16:10:00Z"
}
```

### 5.2 WhatsApp Webhook Receiver (Inbound Parent Response)
* **Endpoint:** `POST /api/v1/webhooks/whatsapp`
* **Request Body (Meta Cloud API Format Excerpt):**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "919876543210",
          "type": "button",
          "button": {
            "text": "On Leave",
            "payload": "BTN_LEAVE_logId_12345"
          }
        }]
      }
    }]
  }]
}
```
* **Processing:**
  1. Extract `payload` -> parse action & `log_id`.
  2. Update `attendance_logs` set `status = 'PARENT_VERIFIED_LEAVE'` and `parent_responded_at = NOW()`.
  3. Emit WebSocket event to Admin Dashboard to clear any pending timer indicator.

---

## 6. Security, Multi-Tenancy & Reliability NFRs

### 6.1 Data Isolation Policy
* Every query MUST include `WHERE institute_id = req.user.institute_id` using automated ORM middleware (Prisma / TypeORM / Knex Row-Level Security).
* Cross-tenant data leakage is mitigated at the database middleware level.

### 6.2 Idempotency & Message Deduplication
* WhatsApp Webhooks implement idempotency via a Redis key `lock:webhook:<message_id>` to ensure double-taps by parents or duplicate webhook retries do not process twice.

### 6.3 Disaster Recovery & Offline Support
* Mobile Attendance UI caches student lists in LocalStorage/IndexedDB. If a teacher loses cellular network inside the classroom, attendance marks locally and auto-syncs as soon as connection is restored.