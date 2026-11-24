# End-to-End Website & Application Flow Blueprint

## P.D.O Classes Platform & Real-Time Attendance Escalation Engine

---

## 1. System Ecosystem & Platform Map

The platform consists of four interconnected digital touchpoints:

```
                          ┌────────────────────────┐
                          │   1. Public Website    │
                          │   (Leads & Marketing)  │
                          └───────────┬────────────┘
                                      │
                                      ▼
┌────────────────────────┐   ┌────────────────────────┐   ┌────────────────────────┐
│  2. Teacher App (PWA)  │──►│ 3. Escalation Engine   │──►│ 4. Admin & Staff Dashboard│
│  (15-sec Attendance)   │   │  (WhatsApp + Timers)   │   │ (Red Alerts & Analytics) │
└────────────────────────┘   └───────────┬────────────┘   └────────────────────────┘
                                         │
                                         ▼
                             ┌────────────────────────┐
                             │  5. Parent Interface   │
                             │   (WhatsApp Buttons)   │
                             └────────────────────────┘
```

---

## 2. User Roles & Access Entry Points

| Persona | Primary Interface | Primary Actions |
| :--- | :--- | :--- |
| **Prospective Student / Parent** | Public Website (`pdo-classes.com`) | View CAT / 12th PCM details, check 4.9★ reviews, book a demo class. |
| **Teacher / Faculty** | Mobile PWA (`pdo-classes.com/app/teacher`) | Select batch, mark attendance in under 15 seconds, view daily schedule. |
| **Parent** | WhatsApp Chat Interface | Receive real-time absent alert at T+10 min, tap status button (*Leave / Late / Bunk*). |
| **Front-Desk / Staff** | Desktop Web App (`pdo-classes.com/app/reception`) | Monitor live classes, receive Red Alerts at T+13 min, make escalation calls. |
| **Coaching Owner / Admin** | Desktop Web App (`pdo-classes.com/app/admin`) | View attendance statistics, manage students/teachers/batches, website leads. |

---

## 3. Public Website Flow & Navigation Tree

### 3.1 Sitemap & Page Hierarchy

```
pdo-classes.com
├── / (Home Page / Landing Page)
│   ├── Hero Section (4.9★ Badge, CTA: Book Free Demo)
│   ├── Courses Offered (CAT/MBA & Class 11-12 PCM)
│   ├── Safety & Parent Attendance Engine Feature Highlight
│   ├── Verified Student Reviews (152 Google Reviews)
│   ├── Faculty Profiles (99%iler Mentors & VARC Specialists)
│   └── Location & Contact (Lalpur, Ranchi Map + Call/WhatsApp)
├── /courses/cat-mba (Detailed CAT Course Syllabus & Batches)
├── /courses/class-12-pcm (Board & Competitive Prep Overview)
├── /book-demo (Lead Capture Form)
└── /login (Role-based login for Staff and Teachers)
```

### 3.2 Lead Booking Flow (Public User)

```
[ Visitor lands on Home Page ]
             │
             ▼
[ Clicks "Book Free Demo Class" ]
             │
             ▼
[ Interactive Modal / Page ]
  ├── Input: Student Name
  ├── Input: Phone Number (WhatsApp)
  ├── Select: Target Course (CAT Prep / 12th PCM)
  └── Select: Preferred Time Slot (Morning / Evening)
             │
             ▼
[ Submit Form ] ────► 1. Save to Database (`leads` table)
             │        2. Send Instant WhatsApp Confirmation to Student
             │        3. Emit Lead Alert on Admin Dashboard
             ▼
[ "Thank You" Screen with Instant Direct WhatsApp Chat Button to Owner ]
```

---

## 4. Teacher Mobile Web App Flow

Designed for high-speed touch input inside the classroom.

```
[ Open Teacher App (PWA) ]
             │
             ▼
[ Mobile Pin / Biometric Login ]
             │
             ▼
[ Screen 1: Dashboard / Today's Schedule ]
  ├── Active Batch Card (e.g. "CAT VARC - 4:00 PM")
  └── Upcoming Batches List
             │
             ▼ [ Tap "Take Attendance" ]
             │
[ Screen 2: Batch Roster UI ]
  ├── Top Bar: Batch Name | Timer (e.g. "Class Started 4 min ago")
  ├── Default State: ALL STUDENTS SET TO "PRESENT" (Green)
  ├── Action: Teacher taps missing students -> Toggles to "ABSENT" (Red)
  └── Search / Quick Filter Bar
             │
             ▼ [ Tap "Submit Attendance (2 Absent)" ]
             │
[ Screen 3: Confirmation & Status ]
  ├── Toast: "Attendance Locked & Synced"
  └── Banner: "Automated WhatsApp Parent Verification scheduled for 4:10 PM"
```

---

## 5. Parent WhatsApp Interactive Flow

Runs automatically via API integration without requiring parents to install any app.

```
                  [ Class Starts at 4:00 PM ]
                              │
                              ▼
        [ Teacher Marks Attendance by 4:05 PM ]
                              │
  [ T+10 Mins (4:10 PM): System Verification Trigger ]
                              │
                              ▼
  [ WhatsApp Message Dispatched to Parent's Phone ]
  ┌────────────────────────────────────────────────────────┐
  │ "Dear Parent, [Student Name] has NOT been marked       │
  │  present in today's 4:00 PM PCM Class at P.D.O Classes.│
  │                                                        │
  │  Please confirm their status immediately:"             │
  │                                                        │
  │  [ On Leave ]    [ Running Late ]    [ Sent to Class ] │
  └───────────────────────────┬────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │ (Tap: On Leave)    │ (Tap: Late)        │ (Tap: Sent to Class)
         ▼                    ▼                    ▼
   [ DB Updated:        [ DB Updated:        [ DB Updated:
    Verified Leave ]     Expected Late ]      RED ALERT BUNK ]
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
          [ Instant Response Auto-Reply Sent ]
          "Thank you for confirming. Record updated."
```

---

## 6. Admin & Front-Desk Escalation Dashboard Flow

Real-time monitoring hub for front-desk staff to handle unconfirmed absentees.

### 6.1 Real-Time Escalation Monitor Matrix

```
[ Dashboard Live Feed Screen ]
  ├── Active Batches Count
  ├── Total Students Present vs. Absent Today
  └── RED ALERT ESCALATION PANEL (Live WebSocket Updates)
```

### 6.2 Escalation Escalation Lifecycle (T+13 Mins No Reply)

```
[ 4:10 PM: WhatsApp Sent to Parent ]
             │
             ├──► Parent Replies within 3 mins (Before 4:13 PM)
             │    └── Task Cleared automatically from Dashboard.
             │
             └──► Timer Expires (4:13 PM - No Reply Received)
                  │
                  ▼
   [ RED ALERT FLASHES ON STAFF SCREEN ]
   ┌────────────────────────────────────────────────────────┐
   │ 🚨 URGENT CALL REQUIRED                                │
   │ Student: Rahul Kumar (Roll #402)                       │
   │ Batch: CAT Quants (4:00 PM Class)                      │
   │ Parent: Sanjeev Kumar (+91 98351 XXXXX)                │
   │ Time Unconfirmed: 13 minutes                           │
   │                                                        │
   │ [ 📞 1-CLICK CALL PARENT ]    [ 📝 LOG CALL RESULT ]   │
   └──────────────────────────┬─────────────────────────────┘
                              │
                              ▼ [ Staff Clicks "Call Parent" ]
                              │
[ Outcome Modal ]
  ├── Choice A: "Parent Confirmed Student is Sick" -> Update to Leave
  ├── Choice B: "Parent Checked: Student Bunked Class" -> Mark Flagged Bunk
  └── Choice C: "Line Busy / Unreachable" -> Retry Queue in 5 mins
```

---

## 7. Step-by-Step Scenario Example

### Scenario: The 4:00 PM Class Safety Loop

```
4:00 PM ── Student leaves home for P.D.O Classes but goes elsewhere.
4:05 PM ── Teacher opens Mobile App, marks 28 students Present, Rahul as ABSENT.
4:10 PM ── (T+10 min) System auto-dispatches WhatsApp button message to Rahul's father.
4:13 PM ── (T+13 min) Father has not seen/replied to WhatsApp message.
4:13:01 ── Escalation engine emits RED ALERT to P.D.O Receptionist Dashboard.
4:14 PM ── Receptionist clicks 1-Click Call -> Calls father on mobile.
4:15 PM ── Father learns Rahul isn't in class (At 4:15 PM instead of 6:05 PM when class ends).
4:16 PM ── Receptionist logs call outcome as "Parent Alerted / Bunk Flagged".
```

---

## 8. UI Screen Navigation Matrix

```
                  ┌───────────────────────────────┐
                  │    PUBLIC MARKETING SITE      │
                  │   - Hero, Courses, Reviews    │
                  │   - Demo Booking Modal        │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │      AUTHENTICATION PAGE      │
                  │   - Login (Email/Phone + OTP) │
                  └───────────────┬───────────────┘
                                  │
               ┌──────────────────┴──────────────────┐
               ▼                                     ▼
┌──────────────────────────────┐      ┌──────────────────────────────┐
│     TEACHER MOBILE APP       │      │   ADMIN / STAFF DASHBOARD    │
├──────────────────────────────┤      ├──────────────────────────────┤
│ 1. Today's Classes List      │      │ 1. Live Attendance Counter   │
│ 2. Batch Attendance Toggle   │      │ 2. Red Alert Call Queue      │
│ 3. Submit Confirmation       │      │ 3. Student & Parent Directory│
│ 4. Past Attendance History   │      │ 4. Lead Management (Website) │
└──────────────────────────────┘      │ 5. Analytics & Export (PDF)  │
                                      └──────────────────────────────┘
```