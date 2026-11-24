# Master Implementation & Rollout Plan

## Smart Coaching Website & Real-Time Attendance Escalation System

---

## 1. Executive Summary & Delivery Strategy

This document outlines the step-by-step technical execution roadmap for building and deploying the P.D.O Classes platform and its automated Attendance Escalation Engine. 

### Strategy
* **Phase 1 (Pilot Deployment):** Build a dedicated, highly optimized instance for P.D.O Classes (Lalpur, Ranchi) to establish operational validity and achieve 100% parent satisfaction.
* **Phase 2 (Multi-Tenant SaaS Transition):** Package the backend and dashboard into a turn-key white-label SaaS solution to sell to other coaching centers across Ranchi and Jharkhand.

---

## 2. Sprint Roadmap (6 Sprints / 12-Week Timeline)

```
[ Sprint 1 ] ──► [ Sprint 2 ] ──► [ Sprint 3 ] ──► [ Sprint 4 ] ──► [ Sprint 5 ] ──► [ Sprint 6 ]
  Core Infra       Public Site       Teacher App     WhatsApp &       Admin WebSockets   Testing & Pilot
  & DB Schema      & Demo Booking    (PWA)           Scheduler Queue  Escalations        Launch (Ranchi)
```

### Sprint 1: Foundation, Infrastructure & Auth (Weeks 1–2)
* **Goal:** Set up repository, database environment, authentication microservices, and core data models.
* **Deliverables:**
  * Project setup: Monorepo / split repos (`frontend`, `backend`).
  * PostgreSQL database setup with schema migrations (`backend_schema_pdo_classes.md`).
  * JWT Auth API with RBAC (`SUPER_ADMIN`, `INSTITUTE_ADMIN`, `TEACHER`, `RECEPTIONIST`).
  * Seed data for P.D.O Classes (CAT/MBA and 12th PCM batches, sample teachers, sample students).

### Sprint 2: Public Marketing Website & Demo Engine (Weeks 3–4)
* **Goal:** Launch high-converting public site for P.D.O Classes to capture student leads.
* **Deliverables:**
  * Landing page UI in React + Tailwind CSS featuring 4.9★ Google review badges and course tracks.
  * Interactive Demo Class booking modal with automated email/WhatsApp confirmation trigger.
  * Lead management API & Admin lead management table.
  * SEO optimization for target local keywords ("CAT coaching in Ranchi", "PCM 12th coaching Lalpur").

### Sprint 3: Teacher Mobile App / PWA (Weeks 5–6)
* **Goal:** Build the ultra-fast mobile attendance UI for teachers.
* **Deliverables:**
  * PWA setup (Offline storage, responsive touch-optimized layout).
  * Today’s Batch Roster screen with quick-filter by subject and room.
  * 15-second attendance marking workflow (Toggle Present/Absent + Submit button).
  * Batch summary toast and immediate sync endpoint `POST /api/v1/attendance/mark`.

### Sprint 4: WhatsApp Integration & Timed Scheduler Queue (Weeks 7–8)
* **Goal:** Implement Meta WhatsApp Business API and background timer engine.
* **Deliverables:**
  * Meta Cloud API setup & interactive message template verification (`Quick Reply` buttons: *On Leave*, *Running Late*, *Sent to Class*).
  * BullMQ + Redis queue setup for delayed jobs ($T+10\text{ minutes}$ verification trigger).
  * Webhook listener (`POST /api/v1/webhooks/whatsapp`) to process button clicks and update database logs.
  * Secondary timer ($T+3\text{ minutes}$) to flag non-responsive absentees.

### Sprint 5: Staff Escalation Dashboard & Real-Time Alerts (Weeks 9–10)
* **Goal:** Build the receptionist operational desk with real-time call task queue.
* **Deliverables:**
  * Desktop Admin Dashboard with Socket.io WebSocket server.
  * Real-Time **Red Alert Panel** that flashes when parent timer expires without response.
  * One-Click "Call Parent" launcher with inline outcome recording modal (*Verified Sick*, *Bunk Confirmed*, *Line Unreachable*).
  * Attendance history analytics and printable monthly PDF reports for parents.

### Sprint 6: Testing, Field Trial & Pilot Go-Live (Weeks 11–12)
* **Goal:** End-to-end load testing, teacher training at Lalpur center, and live rollout.
* **Deliverables:**
  * Classroom stress testing on low 3G/4G bandwidth.
  * Onboarding staff and training teachers at P.D.O Classes.
  * Live deployment of domain, SSL, database backup cron jobs, and pilot launch.

---

## 3. Milestones & Work Breakdown Structure (WBS)

| Milestone ID | Key Feature / Task | Target Week | Success Criteria |
| :--- | :--- | :--- | :--- |
| **M1** | Database & Auth API Ready | Week 2 | JWT login works for Admin & Teacher; database schema deployed. |
| **M2** | Public Site Live | Week 4 | Website up, demo leads saving to DB and sending instant WhatsApp alert. |
| **M3** | Mobile Attendance Ready | Week 6 | Attendance marked in < 15 seconds on mobile browser; offline sync working. |
| **M4** | WhatsApp Queue Functional | Week 8 | Test WhatsApp alert dispatched at $T+10\text{ min}$; button replies auto-update log. |
| **M5** | Red Alert Desk Operational | Week 10 | WebSocket pushes Red Alert badge at $T+13\text{ min}$; call result modal logs notes. |
| **M6** | Pilot Production Launch | Week 12 | 100% live execution during actual batch hours at P.D.O Classes. |

---

## 4. Environment Architecture & Deployment Pipeline

```
[ Developer Local ] ──git push──► [ GitHub Repository ]
                                        │
                                        ▼ (CI/CD Pipeline)
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                [ Vercel / Netlify ]           [ Render / Railway VPS ]
               Frontend React (Web/PWA)       Node.js API + Redis + Postgres
```

### 4.1 Production Hosting Stack
* **Frontend Hosting:** Vercel / Netlify (Global CDN, automated SSL, custom domain `pdo-classes.com`).
* **Backend API Hosting:** Docker container on Render / Railway / Hetzner VPS (Node.js runtime with PM2 process manager).
* **Managed Database:** Supabase PostgreSQL or Managed AWS RDS Postgres with daily automated backups.
* **Redis Instance:** Upstash Redis / Managed Redis for BullMQ persistent queues.
* **WhatsApp Provider:** Meta WhatsApp Cloud API (or Waapi for rapid prototyping).

---

## 5. Testing & Quality Assurance Plan

### 5.1 Test Suites

1. **Unit & Integration Tests (Jest / Supertest):**
   * Auth token generation & role validation.
   * Attendance log state transitions (`ABSENT_UNCONFIRMED` $\rightarrow$ `PARENT_VERIFIED_LEAVE` / `ESCALATED_CALL_REQUIRED`).

2. **Scenario & Timer Tests:**
   * **Test Case 1 (Happy Path):** Teacher marks absent at 4:00 PM. WhatsApp sent at 4:10 PM. Parent clicks *On Leave* at 4:11 PM. Record sets to `PARENT_VERIFIED_LEAVE`. Red alert is canceled.
   * **Test Case 2 (Escalation Path):** Teacher marks absent at 4:00 PM. WhatsApp sent at 4:10 PM. No reply by 4:13 PM. Red Alert appears on reception dashboard with audio/visual chime.

3. **Field Load Test:**
   * Simulate 10 simultaneous batches marking attendance within a 2-minute window. Validate queue processing throughput.

---

## 6. Risk Management & Mitigation Matrix

| Identified Risk | Impact | Likelihood | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Teacher forgets to mark attendance on time** | High | Medium | Auto-send push notification/SMS reminder to teacher's phone 5 minutes after class start time. |
| **Parent's WhatsApp number is incorrect / inactive** | High | Low | Front desk verifies WhatsApp numbers during student onboarding via OTP verification. |
| **Network disconnection inside classroom** | Medium | High | PWA saves attendance state in IndexedDB/LocalStorage and auto-syncs upon connection recovery. |
| **Meta WhatsApp API daily message limits** | Medium | Low | Register for Meta Business Verification early to unlock tier 1 limits (1,000+ business-initiated conversations/day). |

---

## 7. Pilot Launch & Scaling Playbook

### 7.1 Day 1 Pilot Strategy (P.D.O Classes)
1. **Pre-Launch (Day -3):** Upload student roster (Names, Parent WhatsApp numbers, Batches) into the database.
2. **Staff Training (Day -1):** Conduct a 15-minute hands-on walkthrough with teachers on marking attendance on mobile.
3. **Go-Live (Day 1):** Execute real-time tracking for afternoon CAT and evening 12th PCM batches. Monitor reception desk for escalation alerts.

### 7.2 Sales Pitch Metrics for Expansion
Once pilot results are established at P.D.O Classes, leverage the following data points to pitch neighboring institutes in Ranchi:
* **"Average time to notify parent of unconfirmed absence reduced from 120 minutes to 13 minutes."**
* **"90%+ of parents respond directly via WhatsApp button without needing a phone call."**
* **"Zero safety lapses recorded for enrolled students."**