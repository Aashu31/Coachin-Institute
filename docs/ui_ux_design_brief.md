# UI/UX Design Brief

## Smart Coaching Website & Real-Time Attendance Escalation System

---

## 1. Executive Summary & Design Vision

The visual design system for **P.D.O Classes** must bridge two distinct user experiences:
1. **The Public Marketing Website:** High-converting, trustworthy, and polished for students and parents searching for CAT/MBA and Class 12th PCM coaching in Ranchi.
2. **The Operational App Interfaces (Teacher & Staff):** Ultra-fast, low-friction, high-contrast, and actionable—enabling teachers to complete attendance in under 15 seconds and staff to resolve emergency escalation alerts instantly.

---

## 2. Design Principles

* **Speed Over Formality (Operational Interfaces):** The teacher mobile interface must require minimal taps, large touch targets, and clear status toggles to fit seamlessly into classroom routines.
* **Psychological Safety & Trust (Public & Parent Facing):** Use deep blues, clean whites, and vibrant green/gold accents to convey academic authority, modern security, and accountability.
* **Zero-Lapse Urgency (Escalation Dashboard):** Red alerts must be visually unambiguous, drawing immediate focus without inducing unnecessary cognitive overload on reception staff.

---

## 3. Brand Identity & Visual Language

### 3.1 Color Palette

| Token | Hex Code | Purpose / Usage |
| :--- | :--- | :--- |
| **Primary Navy** | `#1E293B` / `#0F172A` | Brand dominance, header backgrounds, authority headers. |
| **Academic Blue** | `#2563EB` | Primary CTA buttons, active state indicators, primary links. |
| **Alert Red (Emergency)** | `#DC2626` | Absent states, unconfirmed attendance, 3-min escalation red alert badges. |
| **Safety Green** | `#16A34A` | Present status, verified parent approvals, success confirmations. |
| **Warning Gold / Amber** | `#D97706` | Pending verification timers (T+10 min), expected late status. |
| **Neutral Surface Light** | `#F8FAFC` | Page backgrounds, card surface fill. |
| **Neutral Dark Text** | `#334155` | Primary body text for high readability. |

### 3.2 Typography System

* **Primary Font Family:** Inter / Plus Jakarta Sans (Clean, modern sans-serif optimized for mobile screens and quick data scanning).
* **Display Font (Headings):** Lexend / Montserrat (Used sparingly for high-impact landing page headlines).

#### Type Hierarchy Matrix

| Element | Size (Desktop / Mobile) | Weight | Line Height |
| :--- | :--- | :--- | :--- |
| **H1 Hero Headline** | 48px / 32px | Bold (700) | 1.2 |
| **H2 Section Title** | 30px / 24px | SemiBold (600) | 1.3 |
| **H3 Card / Modal Title** | 20px / 18px | SemiBold (600) | 1.4 |
| **Body Regular** | 16px / 14px | Regular (400) | 1.5 |
| **Caption / Micro-copy** | 13px / 12px | Medium (500) | 1.4 |
| **Counter / Timer Display** | 24px / 20px | Monospace (700) | 1.0 |

---

## 4. Key Interface Specifications

### 4.1 Public Landing Page (P.D.O Classes)

* **Hero Section:**
  * Left column: Bold Value Proposition ("Ranchi's Top CAT & 12th PCM Prep + Instant Attendance Safety").
  * 4.9★ Rating badge pill containing embedded Google Reviews logo.
  * Prominent CTA Button: `[ Book a Free Demo Class ]` (Gradient Accent Blue with pulse hover effect).
  * Direct Click-to-Call / WhatsApp floating button pinned to bottom right on mobile screens.

* **Social Proof & Reviews Grid:**
  * Horizontal scrolling cards showcasing authentic Google reviews ("English teacher is best in this coaching center", "99%iler CAT faculty").
  * Verified Student Badge icon next to each review avatar.

* **Interactive Course Selector Tab:**
  * Segmented control toggle: `[ CAT / MBA Prep ]` vs. `[ Class 11th-12th PCM ]`.
  * Dynamic card swap revealing curriculum highlights, batch timings, and faculty profiles.

---

### 4.2 Teacher Mobile Attendance App (PWA Viewport)

Designed for 1-handed thumb usage on smartphones inside classrooms.

* **Header Bar:**
  * Fixed top bar with current Batch Title (`CAT Quants - Batch A`), current time (`04:02 PM`), and progress indicator ring (`28/30 Present`).

* **Student List Cards (List View Pattern):**
  * Minimum touch target size: **48px height** per row.
  * Left side: Student Name + Roll Number.
  * Right side: High-contrast Segmented Switch Button:
    * `[ PRESENT (Green) ]` (Default Selected)
    * `[ ABSENT (Red Outline) ]`
  * Tapping `ABSENT` instantly turns the row red with a subtle vibration feedback (Haptic API).

* **Bottom Sticky Action Bar:**
  * Primary Button: `[ Submit Attendance (2 Absent) ]` taking up 100% container width.
  * Tap triggers an animated confirmation drawer: *"Locking attendance & scheduling parent verification."*

---

### 4.3 Staff & Admin Escalation Dashboard (Desktop Viewport)

Optimized for 1080p desktop monitors at the front desk.

* **Top KPI Stats Row:**
  * Card 1: Active Batches (e.g., `4 Running`).
  * Card 2: Total Attendance Rate Today (e.g., `94.2%`).
  * Card 3: Pending Parent Replies (e.g., `2 Waiting`).
  * Card 4: Escalation Call Tasks (e.g., `1 RED ALERT` with pulsing red border).

* **Split-Screen Workspace:**
  * **Left Side (Live Class Feed):** Timetable matrix showing current active classes, assigned teachers, and submission status badges (`Submitted at 4:04 PM` vs `Pending Marking`).
  * **Right Side (Escalation Queue - Priority Area):**
    * Cards sorted by urgency (Time elapsed since non-response).
    * **Red Alert Card Spec:** High-contrast red left-border (6px), student name, parent phone number, countdown timer since alert triggered, and a single prominent CTA: `[ 📞 Call Parent Now ]`.
    * Clicking call opens an inline Modal to quickly select call result: `[ Verified Sick ]`, `[ Bunk Confirmed ]`, or `[ Line Unreachable ]`.

---

### 4.4 Parent WhatsApp Conversation Design

Micro-copy guidelines for official Meta Business Template Messages:

```
┌────────────────────────────────────────────────────────┐
│ 🏫 P.D.O CLASSES - ATTENDANCE ALERT                   │
│                                                        │
│ Dear Parent,                                           │
│ [Student Name] has NOT been marked present in today's │
│ [Subject] class (Started at [Time]).                   │
│                                                        │
│ Please tap a button below to confirm their status:    │
│                                                        │
│ [ 🏥 On Leave ]  [ ⏰ Running Late ]  [ 🚨 Sent to Class ]│
└────────────────────────────────────────────────────────┘
```

---

## 5. Interaction & Micro-Animations

1. **State Transitions:** Attendance toggles on the teacher app must transition smoothly (150ms ease-in-out) to prevent mis-clicks.
2. **Red Alert Trigger Animation:** When a 3-minute unconfirmed timer expires on the staff dashboard, the new call card enters from the top with a subtle shake animation and soft alert chime.
3. **Demo Booking Modal:** Opens via backdrop blur effect (`backdrop-filter: blur(8px)`) keeping context of the underlying website visible.

---

## 6. Accessibility & Responsiveness Specifications

* **Contrast Ratios:** All body text must maintain a minimum contrast ratio of **4.5:1** (WCAG AA standard). Alert text on red backgrounds must adhere to **7:1** (AAA standard).
* **Touch Target Spacing:** Touch targets on mobile screens must have at least **8px of spacing** between clickable surfaces to avoid accidental status changes.
* **Device Support:** 
  * Responsivebreakpoints: Mobile (`375px`), Tablet (`768px`), Desktop (`1024px`, `1440px`).
  * Optimized for Android Chrome and iOS Safari PWAs.