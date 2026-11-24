# Product Requirement Document (PRD)
## Smart Coaching Website & Real-Time Attendance Escalation System

---

## 1. Document Overview
* **Project Name:** P.D.O Classes Platform & Attendance Escalation Engine
* **Target Audience:** P.D.O Classes (Lalpur, Ranchi) as Pilot Client -> Scalable Multi-Tenant SaaS for Coaching Institutes
* **Version:** 1.0.0
* **Status:** Approved for Development

---

## 2. Problem Statement & Value Proposition

### 2.1 The Problem
When a student leaves home for coaching but fails to reach the classroom (bunking/skipping), traditional manual registers only log them as "Absent." 
* **Teacher Assumption:** Student is on leave / absent.
* **Parent Assumption:** Student is currently sitting in class.
* **The Communication Gap:** Parents only realize the student skipped class hours later when the student returns home (e.g., at 6:05 PM instead of knowing by 4:12 PM).

### 2.2 The Solution
An automated, real-time digital attendance & parent notification engine that bridges this time gap:
1. Attendance marked digitally via mobile within 10 minutes of class start time.
2. Immediate WhatsApp alert sent to parents of absent students with quick-reply options.
3. Automated escalation: If a parent doesn't reply within 3 minutes, an urgent call task is generated for the institute staff.

---

## 3. User Personas

| Persona | Role | Key Needs |
| :--- | :--- | :--- |
| **Coaching Owner / Admin** | Manages batches, students, teachers, and business trust | High parent retention, real-time security assurance, lead capture via website. |
| **Teacher / Faculty** | Conducts classes, takes attendance | Fast (15-second) mobile attendance interface without disrupting teaching time. |
| **Parent** | Pays fees, cares about student safety | Immediate notification if student is missing; easy 1-tap WhatsApp response. |
| **Front-Desk Staff** | Handles calls and daily operational alerts | Clear dashboard listing unconfirmed absent students requiring immediate call. |

---

## 4. Phase-Wise Functional Requirements

### PHASE 1: Public Website & Core Management Dashboard

#### 4.1 Public Landing Page (P.D.O Classes)
* **Hero Banner:** Headline emphasizing trust & results ("Ranchi's Premier CAT/MBA & Class 12 PCM Institute"). Prominent 4.9★ rating badge (152 Google Reviews).
* **Course Catalog:**
  * Track 1: CAT / MBA Prep (Highlighting 99%iler faculty & VARC/English specialists).
  * Track 2: Class 11th - 12th PCM Boards & Foundation (Highlighting small batches & basic concepts focus).
* **Trust & Social Proof:** Embedded Google reviews, student success quotes, and faculty profiles.
* **Lead Capture & Demo Booking:** Form capturing Name, Phone, Target Exam (CAT vs 12th PCM), and Preferred Batch Timing.
* **Contact & Location:** Interactive Google Map pinned to P&T Colony, Lalpur, Ranchi, with direct WhatsApp & Click-to-Call buttons (`083404 06593`).

#### 4.2 Admin & Teacher Dashboard
* **Authentication & RBAC:**
  * Super Admin / Coaching Owner
  * Branch Manager / Front-Desk Staff
  * Teacher / Faculty
* **Student & Parent Database Management:**
  * Student Name, Roll Number, Assigned Batch, Parent Name, Parent WhatsApp Number, Emergency Contact.
* **Batch Scheduler:**
  * Course Name, Teacher assigned, Class start time, Class end time, Room number.

---

### PHASE 2: Real-Time Attendance Escalation Engine

#### 4.3 Step-by-Step Escalation Workflow

```
[ Class Starts: e.g., 4:00 PM ]
       │
       ▼
[ Step 1: Teacher Marks Attendance on Mobile (4:00 PM - 4:10 PM) ]
       │
       ▼
[ Step 2: System Locks & Verifies Absent Entries (T + 10 mins: 4:10 PM) ]
       │
       ▼
[ Step 3: Instant WhatsApp Alert Sent to Parent (4:10 PM) ]
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[ Parent Replies via WhatsApp ]    [ No Reply in 3 Minutes (4:13 PM) ]
       │                                 │
       ▼                                 ▼
[ Step 5: Record Auto-Updated ]    [ Step 6: Urgent Staff Call Task Generated ]
 (On Leave / Running Late / Bunk)    (Front Desk Calls Parent Immediately)
```

#### Detailed Step Specifications:
* **Step 1 (Digital Marking):** Mobile-first UI. By default, all batch students are toggled "Present." Teacher only taps on absent students and clicks "Submit." (Time required: < 15 seconds).
* **Step 2 (Verification Trigger):** System automatically locks the attendance at $T_{\text{start}} + 10 \text{ minutes}$.
* **Step 3 (Parent WhatsApp Alert):** Automated WhatsApp template message sent to parent:
  > *"Dear Parent, [Student Name] has not been marked present in today's [Subject] class (Started at [Time]). Please confirm their status immediately."*
  > **Buttons:** `[On Leave]` `[Running Late]` `[Sent to Class]`
* **Step 4 (Parent Response Handling):**
  * `[On Leave]`: Attendance status changes to `On Leave (Verified)`.
  * `[Running Late]`: Attendance status changes to `Late Arrival Expected`.
  * `[Sent to Class]`: Alert flag raised — student left home but hasn't reached.
* **Step 5 (Database Auto-Update):** Webhook captures WhatsApp response and updates dashboard status in real-time.
* **Step 6 (3-Minute Escalation Engine):**
  * If no response is logged by $T_{\text{start}} + 13 \text{ minutes}$, the system raises a **RED ALERT Task** on the Front-Desk Staff Dashboard.
  * Screen highlights student name, parent phone number, and a 1-click "Call Parent" dialer button.

---

## 5. Technical Architecture & Database Schema

### 5.1 Tech Stack Recommendation
* **Frontend:** React.js / Next.js with Tailwind CSS (Responsive UI for Mobile & Desktop).
* **Backend:** Node.js (Express / Fastify) or Python (FastAPI).
* **Database:** PostgreSQL (Relational integrity for multi-tenant schemas).
* **Automation & Messaging:** Node-RED / n8n / Celery queues + Official WhatsApp Business Cloud API (or Waapi / Meta Graph API).

### 5.2 Key Data Entities (Schema Summary)

```sql
-- Multi-Tenant Institute Entity
Institutes (
  institute_id UUID PRIMARY KEY,
  name VARCHAR(255),
  address TEXT,
  phone VARCHAR(20),
  created_at TIMESTAMP
);

-- Students & Parent Contact Entity
Students (
  student_id UUID PRIMARY KEY,
  institute_id UUID REFERENCES Institutes(institute_id),
  full_name VARCHAR(255),
  batch_id UUID,
  parent_name VARCHAR(255),
  parent_whatsapp VARCHAR(20),
  created_at TIMESTAMP
);

-- Attendance Session Entity
Attendance_Logs (
  log_id UUID PRIMARY KEY,
  student_id UUID REFERENCES Students(student_id),
  batch_id UUID,
  date DATE,
  status ENUM('PRESENT', 'ABSENT', 'LEAVE', 'LATE', 'UNCONFIRMED_BUNK'),
  marked_by_teacher_at TIMESTAMP,
  whatsapp_sent_at TIMESTAMP,
  parent_replied_at TIMESTAMP,
  parent_response VARCHAR(50),
  call_escalated BOOLEAN DEFAULT FALSE,
  call_resolved BOOLEAN DEFAULT FALSE
);
```

---

## 6. Non-Functional Requirements (NFRs)

1. **Latency:** WhatsApp alert must be dispatched within 5 seconds of the 10-minute verification trigger.
2. **Mobile Optimization:** Teacher attendance screen must load under 1.5 seconds on 3G/4G networks in Ranchi.
3. **Multi-Tenancy:** Database design must isolate data by `institute_id` so the system can be resold to other coaching institutes seamlessly.
4. **Reliability:** Background timers (Cron / Message Queue) must guarantee zero dropped escalation calls.

---

## 7. Success Metrics & KPIs
* **Parent Notification Time Reduction:** From ~120+ minutes post-class down to < 12 minutes from class start time.
* **Parent Reply Rate:** Target > 80% automated responses via WhatsApp buttons.
* **Staff Escalation Efficiency:** 100% of unconfirmed absentees called within 5 minutes of red alert trigger.
* **Coaching Sales Pitch Impact:** Positioning P.D.O Classes (and future client institutes) as the safest, most transparent coaching center in the region.