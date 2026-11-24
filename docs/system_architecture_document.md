# System Architecture Document

## Smart Coaching Website & Real-Time Attendance Escalation System

## 1. Executive Summary & Architectural Vision

This document details the high-level system architecture, service breakdown, data pipeline, and network topology for the **P.D.O Classes Platform & Real-Time Attendance Escalation System**.

The platform is designed around two main operational domains:
1. **Public Marketing & Lead Generation:** A high-availability web interface for student discovery, course exploration (CAT/MBA & 12th PCM), and automated demo booking.
2. **Real-Time Operational & Escalation Engine:** A multi-layered, event-driven infrastructure providing sub-second mobile attendance marking for teachers, automated WhatsApp notifications at $T+10\text{ minutes}$, and automated WebSocket-driven Red Alert escalations at $T+13\text{ minutes}$ for front-desk staff.

---

## 2. High-Level Architecture Diagram

```
                             [ CLIENT TIER ]
  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
  │ Public Website   │    │ Teacher Mobile   │    │ Staff Dashboard  │
  │ (React + Tailwind│    │ PWA (Offline-ready│    │ (WebSocket Client│
  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
           │                       │                       │
           ▼                       ▼                       ▼
┌────────────────────────────────────────────────────────────────────┐
│                    CDN & Edge Proxy / NGINX                        │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │ HTTPS / WSS
                                   ▼
                            [ API GATEWAY ]
┌────────────────────────────────────────────────────────────────────┐
│               Node.js / Express REST & WebSocket API               │
│                  (JWT Authentication & RBAC Engine)                │
└──────────┬───────────────────────┬──────────────────────┬──────────┘
           │                       │                      │
           ▼                       ▼                      ▼
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│ Multi-Tenant Query │   │ Delayed Timer Queue│   │ Event Publisher    │
│ Layer (Prisma ORM) │   │ Engine (BullMQ)    │   │ (Socket.io Bus)    │
└──────────┬─────────┘   └─────────┬──────────┘   └────────┬───────────┘
           │                       │                       │
           ▼                       ▼                       ▼
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│ PostgreSQL 15 DB   │   │ Redis Key-Value &  │   │ Meta WhatsApp      │
│ (RLS Multi-Tenancy)│   │ Message Cache      │   │ Cloud API Gateway  │
└────────────────────┘   └────────────────────┘   └────────────────────┘
```

---

## 3. Subsystem & Component Topology

### 3.1 Client Layer (Frontend Ecosystem)

* **Public Web Application:** Server-side pre-rendered / Static Site Generated (SSG) React application served via Global CDN. Optimized for local SEO (Ranchi CAT & Class 12 PCM search intents) and sub-second First Contentful Paint (FCP).
* **Teacher Mobile Progressive Web App (PWA):** Mobile-first React app with Service Workers (Workbox) for caching UI assets and batch rosters. Supports offline marking via IndexedDB with background auto-sync when cellular network reconnects.
* **Staff & Admin Real-Time Desktop Dashboard:** Desktop-optimized Single Page Application (SPA) maintaining persistent bidirectional WebSocket channels (`WSS`) for zero-latency Red Alert rendering.

### 3.2 Core Service & API Layer

* **API Gateway & Auth Module:** Single entry point managing route dispatching, rate limiting, CORS policies, and JWT token validation containing `user_id`, `role`, and `institute_id`.
* **Attendance Engine Microservice:** Handles high-concurrency batch submission endpoints (`POST /api/v1/attendance/mark`), batch state locking, and logging database operations.
* **Lead Management Module:** Captures lead forms from the public website, writes to the `leads` repository, and triggers immediate owner/student notifications.

### 3.3 Asynchronous Queue & Timed Escalation Subsystem

* **BullMQ & Redis Message Queue:** A distributed delay queue engine managing state timers:
  * **Timer A ($T+10\text{ min}$):** Schedules WhatsApp parent alert dispatches relative to the batch start time.
  * **Timer B ($T+3\text{ min}$ post-dispatch):** Monitors unconfirmed absent records and triggers staff escalation tasks if no webhook response is received within 180 seconds.
* **Webhook Processing Worker:** Event handler consuming inbound HTTP POST callbacks from Meta's WhatsApp API, verifying cryptographic signatures, updating database log states, and clearing delayed escalation timers.

### 3.4 Data & Storage Layer

* **PostgreSQL (Primary Database):** Relational storage enforced with Row Level Security (RLS) to guarantee multi-tenant boundary separation (`institute_id`).
* **Redis Store:** In-memory store for session caching, BullMQ job locks, state deduplication, and WebSocket socket-to-room dynamic mapping.

---

## 4. End-to-End Data Flow Pipelines

### 4.1 Attendance Marking & Automated Parent Verification ($T_0$ to $T+10\text{ min}$)

```
[ Teacher Device ] ──(1. Submit Attendance)──► [ API Gateway ]
                                                     │
                                                     ▼
                                            [ Write Log: DB ]
                                                     │
                                                     ▼
                                            [ Enqueue Job: BullMQ ]
                                            (Delay = T_start + 10 mins)
                                                     │
                                                     ▼ [ 10 Minutes Elapsed ]
                                            [ Worker Triggered ]
                                                     │
                                                     ▼
                                            [ Call Meta WhatsApp API ] ──► [ Parent WhatsApp ]
```

1. **At $T_0$ (Class Start):** Teacher marks absent students on the mobile app and submits to `POST /api/v1/attendance/mark`.
2. **Database Persistence:** System inserts records into `attendance_logs` with status `ABSENT_UNCONFIRMED`.
3. **Delayed Job Scheduling:** System pushes a delayed job to Redis (`verify-attendance-queue`) set to execute at $T_{\text{start}} + 10\text{ minutes}$.
4. **Execution at $T+10\text{ min}$:** Worker picks up job, verifies record is still unconfirmed, and dispatches interactive WhatsApp template message with buttons (`On Leave`, `Running Late`, `Sent to Class`).
5. **Secondary Timer Initialization:** Worker pushes job to `escalation-monitor-queue` with a 3-minute TTL ($T+13\text{ minutes}$).

### 4.2 Webhook Inbound Flow vs. Escalation Push ($T+10\text{ min}$ to $T+13\text{ min}$)

#### Path A: Parent Responds Within 3 Minutes (Happy Path)
1. Parent taps **"On Leave"** button on WhatsApp.
2. Meta dispatches HTTP POST payload to `/api/v1/webhooks/whatsapp`.
3. Webhook listener verifies signature, locks key in Redis (`lock:wa:{msg_id}`), and updates `attendance_logs` status to `PARENT_VERIFIED_LEAVE`.
4. System cancels pending job in `escalation-monitor-queue`.

#### Path B: Parent Does Not Respond Within 3 Minutes (Red Alert Path)
1. Timer $T+13\text{ min}$ expires in `escalation-monitor-queue`.
2. Worker checks database log status; detects status is still `ABSENT_UNCONFIRMED`.
3. Worker updates database status to `ESCALATED_CALL_REQUIRED` and creates entry in `escalation_tasks`.
4. Worker emits Socket.io event (`EVENT_RED_ALERT`) to the institute's WebSocket room.
5. Front-Desk Receptionist UI flashes Red Alert card and plays audible alert chime.

---

## 5. Security & Multi-Tenancy Architecture

```
                                [ Incoming Request ]
                                         │
                                         ▼
                             [ JWT Auth Middleware ]
                        (Extracts institute_id & Role)
                                         │
                                         ▼
                     [ DB Context Middleware (Prisma / SQL) ]
              SET LOCAL app.current_institute_id = 'institute_uuid';
                                         │
                                         ▼
                       [ PostgreSQL Row Level Security ]
         SELECT * FROM students WHERE institute_id = current_setting(...);
```

* **Multi-Tenant Data Isolation:** Tenant isolation is enforced at the database driver layer using session-scoped RLS environment variables (`app.current_institute_id`). Cross-tenant query execution is rejected at the PostgreSQL kernel level.
* **API Rate Limiting & Protection:** Express rate limiters protect auth endpoints against brute force attempts (10 requests per minute per IP). Webhooks use SHA-256 HMAC signature validation.
* **Data Encryption:** All client-server traffic is encrypted via TLS 1.3. Parent phone numbers and student identity details are encrypted at rest using AES-256 in production databases.

---

## 6. Infrastructure & Deployment Blueprint

```
                                [ Cloud Hosting Infrastructure ]
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                                                                                        │
  │   [ Vercel CDN ] ──► Next.js / React Frontend Build (Edge Network)                      │
  │                                                                                        │
  │   [ Docker Container / VPS Instance ]                                                  │
  │     ├── Container 1: API Server (Node.js Express / Fastify runtime)                    │
  │     ├── Container 2: Worker Node (BullMQ + Meta Webhook Processor)                     │
  │     └── Container 3: Socket.io Gateway Server                                          │
  │                                                                                        │
  │   [ Managed Cloud Database & Cache ]                                                   │
  │     ├── PostgreSQL 15 Cluster (Primary DB + Automated Backups)                         │
  │     └── Redis Cluster (Upstash / Cloud Memory Store for Queues & WS State)            │
  │                                                                                        │
  └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Scalability & Reliability Matrix

| System Component | Scaling Strategy | Failover & Recovery Mechanism |
| :--- | :--- | :--- |
| **Public Landing Page** | Global Edge CDN caching (Vercel/Cloudflare). | 100% uptime backed by static edge distribution. |
| **API Server Engine** | Horizontal pod autoscaling based on CPU/Memory usage (>70%). | Load balancer routes traffic to healthy instances; stateless JWT session handling. |
| **Worker Queue (BullMQ)** | Multiple concurrent worker processes consuming Redis queue jobs. | Failed jobs retried up to 3 times with exponential backoff before landing in Dead-Letter Queue (DLQ). |
| **Database Tier** | Read replicas for analytics & heavy reporting queries; Master write node. | Automated daily backups, point-in-time recovery (PITR) enabled. |
| **Offline Teacher Mobile PWA** | LocalStorage/IndexedDB state caching on mobile device. | Automatic queue drain & HTTP POST retry loop when network connectivity is restored. |