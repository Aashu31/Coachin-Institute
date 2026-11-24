# Visual Design System & Design Tokens Guide

## Smart Coaching Website & Real-Time Attendance Escalation System

## 1. Executive Summary & Visual Philosophy

This document defines the complete visual design system, design tokens, component specifications, and spatial layout rules for **P.D.O Classes**. 

### Visual Identity Principles

* **Academic Trust & Modern Security:** High-contrast slate blues, deep navy, and authoritative typography build instant confidence among parents and aspirants.

* **Operational Clarity:** High-visibility semantic colors (Safety Green, Amber Warning, Emergency Red) guide quick decision-making under time pressure.

* **Touch-Optimized Precision:** Mobile interfaces utilize large $48\text{px}+$ touch targets, high contrast ratios ($> 4.5:1$), and subtle haptic/visual feedback to allow teachers to log attendance in under 15 seconds.

---

## 2. Color System & Design Tokens

### 2.1 Primary & Secondary Brand Colors

| Token Name | Hex Code | Tailwind Class | Usage / Application | 
| ----- | ----- | ----- | ----- | 
| `color-brand-900` | `#0F172A` | `bg-slate-900` | Primary headers, hero section background, dark footers. | 
| `color-brand-800` | `#1E293B` | `bg-slate-800` | Card headers, primary navigation bar, modal titles. | 
| `color-primary-600` | `#2563EB` | `bg-blue-600` | Main CTA buttons, active tab indicators, focus rings. | 
| `color-primary-500` | `#3B82F6` | `bg-blue-500` | Interactive link hovers, active toggle states. | 
| `color-primary-50` | `#EFF6FF` | `bg-blue-50` | Active selection backgrounds, subtle feature highlights. | 

### 2.2 Semantic & Status Colors

| Status Token | Hex Code | Tailwind Class | Operational Meaning | 
| ----- | ----- | ----- | ----- | 
| `color-status-present` | `#16A34A` | `bg-green-600` | Student marked Present, Parent Verified Leave/Late. | 
| `color-status-present-light` | `#DCFCE7` | `bg-green-100` | Background highlight for present state chips. | 
| `color-status-absent` | `#DC2626` | `bg-red-600` | Absent student toggle, unconfirmed absentee alert. | 
| `color-status-absent-light` | `#FEE2E2` | `bg-red-100` | Background tint for active Red Alert cards. | 
| `color-status-amber` | `#D97706` | `bg-amber-600` | $T+10\text{ min}$ timer pending parent reply, late expected. | 
| `color-status-amber-light` | `#FEF3C7` | `bg-amber-100` | Caution notification background. | 

### 2.3 Neutral Palette & Surface Fills

| Token Name | Hex Code | Tailwind Class | Application | 
| ----- | ----- | ----- | ----- | 
| `color-surface-bg` | `#F8FAFC` | `bg-slate-50` | Default application background. | 
| `color-surface-card` | `#FFFFFF` | `bg-white` | Card container surface, dropdown panels, modals. | 
| `color-border-subtle` | `#E2E8F0` | `border-slate-200` | Divider lines, card outlines, table borders. | 

---

## 3. Typography System & Hierarchy

### 3.1 Font Families

* **Primary Sans-Serif:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif` (Clean, high legibility for data, dashboards, and mobile PWA screens).

* **Display / Headline Font:** `Plus Jakarta Sans`, `sans-serif` (Modern geometric sans-serif for marketing headlines and hero banners).

* **Monospace Font (Timers & Counters):** `JetBrains Mono`, `ui-monospace`, `monospace` (Used for live $T+10\text{ min}$ and $T+3\text{ min}$ countdown clocks).

### 3.2 Typography Scale & Style Matrix

| Type Role | Font Size (px / rem) | Font Weight | Line Height | Letter Spacing | Tailwind Class | 
| ----- | ----- | ----- | ----- | ----- | ----- | 
| **Hero Title (H1)** | 48px / 3.0rem | Bold (700) | 1.15 | -0.02em | `text-4xl lg:text-5xl font-bold tracking-tight` | 
| **Section Heading (H2)** | 30px / 1.875rem | SemiBold (600) | 1.25 | -0.01em | `text-2xl lg:text-3xl font-semibold` | 
| **Card Title (H3)** | 20px / 1.25rem | SemiBold (600) | 1.35 | Normal | `text-xl font-semibold` | 
| **Subheading / Label** | 16px / 1.0rem | Medium (500) | 1.4 | Normal | `text-base font-medium` | 
| **Body Text** | 14px / 0.875rem | Regular (400) | 1.5 | Normal | `text-sm font-normal text-slate-600` | 
| **Micro Copy / Badges** | 12px / 0.75rem | SemiBold (600) | 1.33 | +0.02em | `text-xs font-semibold uppercase` | 
| **Timer Counter** | 24px / 1.5rem | Bold (700) | 1.0 | Monospace | `font-mono text-2xl font-bold tracking-wider` | 

---

## 4. Spacing System & Grid Layout

The spatial layout is based on an **$8\text{px}$ Grid System** ($4\text{px}$ sub-grid for tight micro-spacing).

```
 4px  ── [xs]   Micro-gaps between icons & text labels
 8px  ── [sm]   Padding inside small badges & chips
16px  ── [md]   Standard card padding, component margins
24px  ── [lg]   Grid row gaps, modal container padding
32px  ── [xl]   Section padding on desktop screens
64px  ── [2xl]  Hero section vertical whitespace
```

### 4.1 Responsive Container Widths

* **Mobile Viewport (PWA):** $100\%$ width with $16\text{px}$ horizontal gutter (`px-4`).

* **Tablet Viewport:** Max-width $768\text{px}$ (`max-w-3xl`).

* **Desktop Dashboard Viewport:** Max-width $1440\text{px}$ (`max-w-7xl mx-auto px-6`).

### 4.2 Touch Target Rule

All interactive elements (buttons, attendance toggles, radio chips, call launchers) on mobile PWA screens **MUST** have a minimum touch footprint of **$48\text{px} \times 48\text{px}$** to eliminate accidental taps inside noisy classrooms.

---

## 5. Elevation, Shadows & Borders

### 5.1 Shadow Tokens

```
shadow-sm   ├── 0 1px 2px 0 rgba(0, 0, 0, 0.05)         (Default subtle card outline)
shadow-md   ├── 0 4px 6px -1px rgba(0, 0, 0, 0.1)       (Hover states, active dropdowns)
shadow-lg   ├── 0 10px 15px -3px rgba(0, 0, 0, 0.1)      (Modals, sticky action bars)
shadow-red  ├── 0 0 20px 2px rgba(220, 38, 38, 0.35)    (Pulsing Red Alert Call Cards)
```

### 5.2 Border Radii Tokens

* **Small (Inputs, Badges):** `rounded-md` ($6\text{px}$)

* **Medium (Cards, Modals):** `rounded-xl` ($12\text{px}$)

* **Full (Pills, Avatar Chips):** `rounded-full` ($9999\text{px}$)

---

## 6. Component Visual Specifications

### 6.1 Buttons & Interactive Controls

#### Primary Action Button (Website & Forms)
```html
<button class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition-all transform active:scale-95">
  Book Free Demo Class
</button>
```

#### Attendance Toggle Button (Teacher Mobile App)
```html
<!-- Present State (Default) -->
<button class="w-full h-12 bg-green-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm">
  <span>✓</span> PRESENT
</button>

<!-- Absent State (Toggled) -->
<button class="w-full h-12 bg-red-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-md animate-pulse">
  <span>✕</span> ABSENT
</button>
```

### 6.2 Red Alert Call Task Card (Staff Dashboard)

```html
<div class="border-l-8 border-red-600 bg-red-50 p-5 rounded-xl shadow-red border border-red-200 flex justify-between items-center">
  <div>
    <div class="flex items-center gap-2">
      <span class="inline-block w-3 h-3 rounded-full bg-red-600 animate-ping"></span>
      <span class="text-xs font-bold uppercase tracking-wider text-red-700">RED ALERT — 3 Mins Passed</span>
    </div>
    <h4 class="text-lg font-bold text-slate-900 mt-1">Rahul Kumar (CAT Quants)</h4>
    <p class="text-sm text-slate-600">Parent: Sanjeev Kumar (+91 98351 XXXXX)</p>
  </div>
  <button class="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-5 rounded-xl shadow-lg flex items-center gap-2">
    <span>📞</span> Call Parent Now
  </button>
</div>
```

### 6.3 Badges & Status Chips

| Badge Type | Visual Coating | Tailwind Output | 
| ----- | ----- | ----- | 
| **4.9★ Google Review** | Golden text on subtle dark navy pill | `bg-slate-900 text-amber-400 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1` | 
| **Verified Leave** | Soft green container, dark green text | `bg-green-100 text-green-800 font-semibold px-2.5 py-0.5 rounded-full text-xs` | 
| **Unconfirmed Absent** | Soft red container, red text | `bg-red-100 text-red-800 font-semibold px-2.5 py-0.5 rounded-full text-xs animate-pulse` | 

---

## 7. Tailwind CSS Configuration Code (`tailwind.config.js`)

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          900: "#0F172A",
          800: "#1E293B",
          700: "#334155",
        },
        primary: {
          600: "#2563EB",
          500: "#3B82F6",
          50: "#EFF6FF",
        },
        status: {
          present: "#16A34A",
          "present-light": "#DCFCE7",
          absent: "#DC2626",
          "absent-light": "#FEE2E2",
          warning: "#D97706",
          "warning-light": "#FEF3C7",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Plus Jakarta Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        red: "0 0 20px 2px rgba(220, 38, 38, 0.35)",
      },
    },
  },
  plugins: [],
};
```