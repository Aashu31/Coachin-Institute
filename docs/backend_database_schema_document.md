# Database Schema & Data Architecture Document

## Smart Coaching Website & Real-Time Attendance Escalation System

## 1. Overview & Architecture Selection

* **Primary Relational Database:** PostgreSQL (v15+)
* **In-Memory Store & Message Broker:** Redis (v7+)
* **Multi-Tenancy Strategy:** Shared Database, Separate Schema / Tenant ID (`institute_id`) with Row Level Security (RLS).
* **ORM Recommendation:** Prisma / Drizzle ORM / TypeORM (TypeScript native).

---

## 2. Entity Relationship Diagram (ERD)

```
                       ┌────────────────┐
                       │   institutes   │
                       └───────┬────────┘
                               │ 1
        ┌──────────────────────┼──────────────────────┐
        │ N                    │ N                    │ N
┌───────┴────────┐     ┌───────┴────────┐     ┌───────┴────────┐
│     users      │     │    batches     │     │     leads      │
└───────┬────────┘     └───────┬────────┘     └────────────────┘
        │                      │ 1
        │                      ├──────────────────────┐
        │                      │ N                    │ N
        │              ┌───────┴────────┐     ┌───────┴────────────────┐
        │              │    students    │     │  attendance_sessions   │
        │              └───────┬────────┘     └───────┬────────────────┘
        │                      │                      │
        │ 1                    │ 1                    │ 1
        └──────────┐           │                      │
                 N ▼           ▼ N                    ▼ N
              ┌──────────────────────────────────────────┐
              │             attendance_logs              │
              └────────────────────┬─────────────────────┘
                                   │ 1
                                   │
                                   ▼ 1
              ┌──────────────────────────────────────────┐
              │             escalation_tasks             │
              └──────────────────────────────────────────┘
```

---

## 3. PostgreSQL SQL DDL & Data Dictionary

### 3.1 Custom Enum Types

```sql
-- Role Definitions
CREATE TYPE user_role AS ENUM (
    'SUPER_ADMIN',
    'INSTITUTE_ADMIN',
    'TEACHER',
    'RECEPTIONIST'
);

-- Attendance Status Lifecycle
CREATE TYPE attendance_status AS ENUM (
    'PRESENT',
    'ABSENT_UNCONFIRMED',
    'PARENT_VERIFIED_LEAVE',
    'PARENT_VERIFIED_LATE',
    'PARENT_FLAGGED_BUNK',
    'ESCALATION_CALL_REQUIRED',
    'CALL_RESOLVED'
);

-- Escalation Task Priority
CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- Lead Status Types
CREATE TYPE lead_status AS ENUM ('NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'ENROLLED', 'LOST');
```

---

### 3.2 Core Table Definitions

#### Table: `institutes`
Stores tenant information for multi-institute scaling.

```sql
CREATE TABLE institutes (
    institute_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Ranchi',
    whatsapp_api_config JSONB DEFAULT '{
        "provider": "META_CLOUD",
        "phone_number_id": "",
        "access_token": "",
        "business_account_id": ""
    }'::jsonb,
    verification_delay_minutes INT DEFAULT 10,
    escalation_timeout_minutes INT DEFAULT 3,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### Table: `users`
System accounts including Admins, Teachers, and Front-desk Receptionists.

```sql
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'TEACHER',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### Table: `batches`
Academic groups/courses (e.g., CAT Quants Morning, Class 12 PCM Evening).

```sql
CREATE TABLE batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL, -- e.g. "CAT 2026 Batch A"
    target_exam VARCHAR(100) NOT NULL, -- e.g. "CAT", "CLASS_12_PCM"
    scheduled_start_time TIME NOT NULL,
    scheduled_end_time TIME NOT NULL,
    days_of_week INT[] DEFAULT '{1,2,3,4,5,6}', -- 1=Monday, 7=Sunday
    room_number VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### Table: `students`
Student profiles linked to parents' emergency WhatsApp contacts.

```sql
CREATE TABLE students (
    student_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE CASCADE,
    batch_id UUID REFERENCES batches(batch_id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    roll_number VARCHAR(50) NOT NULL,
    parent_name VARCHAR(255) NOT NULL,
    parent_whatsapp VARCHAR(20) NOT NULL, -- Format: +91XXXXXXXXXX
    parent_secondary_phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_roll_per_institute UNIQUE (institute_id, roll_number)
);
```

#### Table: `attendance_sessions`
Represents an individual class session instance marked by a teacher.

```sql
CREATE TABLE attendance_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(user_id),
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    class_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verification_triggered BOOLEAN DEFAULT FALSE,
    total_students INT NOT NULL DEFAULT 0,
    present_count INT NOT NULL DEFAULT 0,
    absent_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### Table: `attendance_logs`
Individual attendance state record for every student in a session.

```sql
CREATE TABLE attendance_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES attendance_sessions(session_id) ON DELETE CASCADE,
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    status attendance_status NOT NULL DEFAULT 'PRESENT',
    whatsapp_message_id VARCHAR(255),
    whatsapp_sent_at TIMESTAMP WITH TIME ZONE,
    parent_response_raw VARCHAR(100),
    parent_responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_student_session UNIQUE (session_id, student_id)
);
```

#### Table: `escalation_tasks`
Urgent call tasks raised when a parent does not reply within 3 minutes of alert.

```sql
CREATE TABLE escalation_tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE CASCADE,
    log_id UUID NOT NULL UNIQUE REFERENCES attendance_logs(log_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    priority task_priority NOT NULL DEFAULT 'HIGH',
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(user_id),
    call_outcome VARCHAR(100), -- 'VERIFIED_SICK', 'BUNK_CONFIRMED', 'UNREACHABLE'
    staff_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### Table: `leads`
Public website demo bookings and course inquiries.

```sql
CREATE TABLE leads (
    lead_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES institutes(institute_id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    whatsapp_number VARCHAR(20) NOT NULL,
    target_course VARCHAR(100) NOT NULL,
    preferred_slot VARCHAR(50),
    status lead_status NOT NULL DEFAULT 'NEW',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Database Indexing Strategy

High-frequency queries are optimized using B-tree and composite indexes.

```sql
-- Fast lookup for mobile app batch rosters
CREATE INDEX idx_students_batch_institute ON students(batch_id, institute_id) WHERE is_active = TRUE;

-- Fast index for today's attendance logs
CREATE INDEX idx_attendance_logs_session ON attendance_logs(session_id, status);

-- Index for real-time unresolved escalation tasks on Reception Dashboard
CREATE INDEX idx_active_escalations ON escalation_tasks(institute_id, triggered_at) WHERE resolved_at IS NULL;

-- Fast WhatsApp message payload webhook matching
CREATE INDEX idx_attendance_logs_wa_msg ON attendance_logs(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;

-- Index for lead tracking
CREATE INDEX idx_leads_institute_status ON leads(institute_id, status, created_at DESC);
```

---

## 5. Redis Schema & Queue Keys

Redis handles BullMQ scheduled timers, idempotency locks, and active WebSocket user rooms.

| Key Pattern | Data Type | TTL | Purpose |
| :--- | :--- | :--- | :--- |
| `lock:wa_webhook:{msg_id}` | String | 60 seconds | Prevents duplicate processing of WhatsApp button double-taps. |
| `timer:verify:{log_id}` | String | 10 minutes | Delayed verification queue key for absent notifications. |
| `timer:escalate:{log_id}` | String | 3 minutes | Timer key tracking 3-minute parent response window. |
| `sess:user:{user_id}` | Hash | 24 hours | Active JWT user session & role claims cache. |
| `ws:room:{institute_id}` | Set | Persistent | Active staff dashboard WebSocket connections list. |

---

## 6. Multi-Tenant Security Policy (PostgreSQL RLS)

To guarantee that Institute A cannot read or write Institute B's data:

```sql
-- Enable Row Level Security on tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_tasks ENABLE ROW LEVEL SECURITY;

-- Create Tenant Isolation Policy example for students
CREATE POLICY tenant_isolation_policy ON students
    USING (institute_id = NULLIF(current_setting('app.current_institute_id', true), '')::uuid);
```

---

## 7. Automated Triggers & Functions

### Auto-Update `updated_at` Timestamp Function

```sql
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to dynamic tables
CREATE TRIGGER trig_update_students BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trig_update_attendance_logs BEFORE UPDATE ON attendance_logs FOR EACH ROW EXECUTE FUNCTION update_timestamp();
```