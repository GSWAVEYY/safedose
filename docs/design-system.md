# SafeDose — Design System & UX Specification

**Version:** 1.0
**Author:** Spark — Creative Director, VRAXON Digital
**Date:** 2026-03-15
**Status:** Complete — Ready for Prism implementation

---

## Design Philosophy

SafeDose serves people in vulnerable moments. The design must earn trust the way a skilled pharmacist earns trust: through precision, warmth, and absolute clarity. Every decision flows from four principles.

**Calm.** Red is reserved exclusively for contraindicated drug interactions — not for warnings, not for overdue reminders, not for anything less than "do not take these together." When red appears, it must mean something. If it appears everywhere, it means nothing.

**Clear.** Every label must be readable at arm's length by someone whose glasses are in the other room. Every action must be unambiguous to someone who is tired, anxious, or dealing with a cognitive load already at its limit.

**Trustworthy.** Clinical precision with human warmth. No ads. No dark patterns. No selling health data. The UI communicates this through restraint — no cluttered dashboards, no notification spam, no urgency theater.

**Accessible.** Your 80-year-old grandmother should navigate this without asking for help. Not "accessible-enough." Actually accessible.

---

## Part 1 — Brand Identity

### 1.1 Core Brand Concept

SafeDose is positioned as "the pharmacist in your pocket" — knowledgeable, calm, precise, and on your side. The visual identity draws from two reference points:

- **Medical precision:** clean whites, structured layouts, legible type — the visual language of a pharmacy label that has been designed correctly
- **Human warmth:** slate-teal as the primary brand color (trustworthy, calming, associated with healthcare without screaming "emergency room"), gentle off-white backgrounds, never sterile-white

The brand is distinctly not: alarming, clinical-cold, overly techy, playful/childlike, or corporate-generic.

### 1.2 Color Palette

#### Brand Colors (Primitive Tokens)

| Token Name | Hex | RGB | Usage |
|---|---|---|---|
| `teal-50` | `#F0FDFA` | 240 253 250 | Teal tint backgrounds |
| `teal-100` | `#CCFBF1` | 204 251 241 | Teal surface subtle |
| `teal-200` | `#99F6E4` | 153 246 228 | Teal surface |
| `teal-400` | `#2DD4BF` | 45 212 191 | Teal accent light |
| `teal-500` | `#14B8A6` | 20 184 166 | Primary brand color |
| `teal-600` | `#0D9488` | 13 148 136 | Primary interactive |
| `teal-700` | `#0F766E` | 15 118 110 | Primary pressed |
| `teal-800` | `#115E59` | 17 94 89 | Dark mode primary |
| `teal-900` | `#134E4A` | 19 78 74 | Deep teal |
| `slate-50` | `#F8FAFC` | 248 250 252 | App background (light) |
| `slate-100` | `#F1F5F9` | 241 245 249 | Surface elevated (light) |
| `slate-200` | `#E2E8F0` | 226 232 240 | Border / divider |
| `slate-400` | `#94A3B8` | 148 163 184 | Text tertiary / placeholder |
| `slate-500` | `#64748B` | 100 116 139 | Text secondary |
| `slate-700` | `#334155` | 51 65 85 | Text primary (light mode) |
| `slate-800` | `#1E293B` | 30 41 59 | Surface dark |
| `slate-900` | `#0F172A` | 15 23 42 | App background (dark) |
| `slate-950` | `#020617` | 2 6 23 | Deep dark background |
| `white` | `#FFFFFF` | 255 255 255 | Cards, surfaces |

#### Semantic Colors — Drug Interaction Severity

The severity scale is non-negotiable. These colors are calibrated so each level is distinguishable from every other level at WCAG AAA contrast on both white and dark surfaces. Each severity uses a filled pill/badge (never outline-only, since color alone cannot convey meaning — pair with icon and label).

| Severity Level | Token | Background | Text on Background | Icon |
|---|---|---|---|---|
| Contraindicated | `severity-contraindicated` | `#DC2626` — red-600 | `#FFFFFF` | X-circle |
| Major | `severity-major` | `#EA580C` — orange-600 | `#FFFFFF` | Alert-triangle |
| Moderate | `severity-moderate` | `#D97706` — amber-600 | `#FFFFFF` | Alert-circle |
| Minor | `severity-minor` | `#2563EB` — blue-600 | `#FFFFFF` | Info |
| Safe (no interactions) | `severity-safe` | `#16A34A` — green-600 | `#FFFFFF` | Check-circle |

**Dark mode severity adjustments** — lighten slightly for legibility:

| Severity Level | Dark Background | Dark Text |
|---|---|---|
| Contraindicated | `#FCA5A5` — red-300 | `#7F1D1D` — red-900 |
| Major | `#FDBA74` — orange-300 | `#7C2D12` — orange-900 |
| Moderate | `#FCD34D` — amber-300 | `#78350F` — amber-900 |
| Minor | `#93C5FD` — blue-300 | `#1E3A8A` — blue-900 |
| Safe | `#86EFAC` — green-300 | `#14532D` — green-900 |

#### Semantic Colors — App State

| State | Token | Light Mode | Dark Mode |
|---|---|---|---|
| Success | `state-success` | `#16A34A` green-600 | `#4ADE80` green-400 |
| Warning | `state-warning` | `#D97706` amber-600 | `#FCD34D` amber-300 |
| Error | `state-error` | `#DC2626` red-600 | `#FCA5A5` red-300 |
| Info | `state-info` | `#2563EB` blue-600 | `#93C5FD` blue-300 |
| Neutral | `state-neutral` | `#64748B` slate-500 | `#94A3B8` slate-400 |

#### Dose Status Colors

| Status | Token | Color | Meaning |
|---|---|---|---|
| Taken — on time | `dose-taken` | `#16A34A` green-600 | Confirmed, within window |
| Taken — late | `dose-late` | `#D97706` amber-600 | Confirmed, after window |
| Missed | `dose-missed` | `#DC2626` red-600 | Window passed, not confirmed |
| Due now | `dose-due` | `#2563EB` blue-600 | Within reminder window |
| Upcoming | `dose-upcoming` | `#94A3B8` slate-400 | Future dose |
| Paused | `dose-paused` | `#94A3B8` slate-400 | Medication temporarily paused |

### 1.3 Typography

React Native has no universal web-safe font loading. The system font stack is the correct default for SafeDose — it is fast (zero font loading delay, critical for elderly users on older devices), familiar (users already know how to read their system font), and it respects system accessibility settings including Dynamic Type on iOS.

#### Font Families

| Platform | Font Family | Fallback |
|---|---|---|
| iOS | San Francisco (SF Pro) — automatic via `System` | Helvetica Neue |
| Android | Roboto — automatic via `System` | Arial |
| Override (display only) | None — do not load custom fonts for v1 | — |

**Why no custom font:** Loading a custom font (e.g. Inter) adds ~200-400ms on first paint on older devices. For elderly users on iPhone 8 / budget Android, this matters. SF Pro and Roboto are already optimized for legibility at small sizes and high DPI. Custom fonts add brand distinction at the cost of performance and accessibility. For SafeDose v1, system fonts win.

#### Type Scale (React Native `fontSize` in points — 1pt = 1px on non-Retina, 2px on Retina)

Base size: **17pt** (Apple's HIG recommended default — larger than web convention's 16px because mobile reading distance is shorter and elderly users benefit from the extra size).

Scale multiplier: 1.25 (Major Third — smaller ratio than Perfect Fourth to preserve space on mobile while still creating clear hierarchy).

| Token | Size (pt) | Line Height (pt) | Weight | Usage |
|---|---|---|---|---|
| `text-xs` | 12 | 18 | 400 | Legal text, metadata only |
| `text-sm` | 14 | 20 | 400 | Secondary labels, captions |
| `text-base` | 17 | 26 | 400 | Body text — PRIMARY default |
| `text-lg` | 20 | 28 | 400 / 600 | Subheadings, card titles |
| `text-xl` | 24 | 32 | 600 | Screen section headers |
| `text-2xl` | 28 | 36 | 700 | Screen titles |
| `text-3xl` | 34 | 42 | 700 | Hero numbers (adherence %, etc.) |
| `text-4xl` | 40 | 48 | 700 | Emergency card primary text |

**Elderly scaling rule:** The app MUST set `allowFontScaling={true}` on all text. Never disable system font scaling. Layout must accommodate up to 200% font scale without truncation. Test at iOS Settings > Accessibility > Larger Text = max slider position.

**Weight conventions:**
- 400 (Regular) — body copy, secondary info
- 500 (Medium) — emphasis within body (drug names, doses)
- 600 (Semibold) — card titles, section headers
- 700 (Bold) — screen titles, confirmation states, emergency card
- Never use 300 or lighter weights — too thin for elderly legibility

### 1.4 Icon Style Guidance

**Library:** Lucide React Native (consistent with other VRAXON projects, MIT licensed, comprehensive medical-adjacent icon set).

**Style:** Outlined icons as default. Filled icons ONLY for active/selected states and severity indicators. This distinction is load-bearing for communicating state.

**Size minimums:**

| Context | Minimum Size | Notes |
|---|---|---|
| Tab bar icons | 24pt | Selected state: filled, teal-600 |
| List item icons | 20pt | Status indicators |
| Button icons | 18pt | Paired with label always |
| Severity badge icons | 16pt | Inside badge — always paired with text |
| Emergency card icons | 32pt | Maximum visibility |
| Standalone action icons | 24pt | Always have accessible label |

**Critical rule:** Icons never convey meaning alone. Every icon that carries information (severity, status, action) must be accompanied by a visible text label OR an `accessibilityLabel` prop. Color alone and icon alone are both insufficient.

**Specific icon assignments:**

| Action / State | Lucide Icon | Notes |
|---|---|---|
| Medications | `Pill` | Primary nav |
| Schedule / Today | `Calendar` | Primary nav |
| Caregiver | `Users` | Primary nav |
| Emergency | `HeartPulse` | Always accessible |
| Add medication | `Plus` | FAB |
| Scan bottle | `Camera` | OCR trigger |
| Interaction warning | `AlertTriangle` | Severity alert |
| Dose taken | `CheckCircle` | Filled, green |
| Dose missed | `XCircle` | Filled, red |
| Dose upcoming | `Clock` | Outlined, slate |
| Settings | `Settings2` | — |
| Profile | `User` | — |
| Caregiver linked | `Link` | Connected state |
| QR code | `QrCode` | Emergency card |
| Notifications | `Bell` | — |
| Drug info | `Info` | — |
| Edit | `Pencil` | — |
| Delete | `Trash2` | Danger action |

### 1.5 Voice and Tone

SafeDose's voice is a skilled clinical pharmacist who also happens to be a calm, empathetic human — not a corporate app, not a chatbot, not a medical textbook.

**The voice is:**
- Precise without being cold ("Lisinopril 10mg — take 1 tablet daily" not "Medication item added")
- Direct without being alarmist ("These two medications may interact — review with your doctor" not "DANGER! SEVERE INTERACTION DETECTED!")
- Warm without being patronizing ("All caught up for today" not "Great job!")
- Honest about uncertainty ("Our data shows..." not "It is known that...")

**Tone by context:**

| Context | Tone | Example |
|---|---|---|
| Onboarding | Welcoming, low-stakes | "Add your first medication — we'll handle the rest." |
| Reminder | Gentle, clear | "Time for Metformin 500mg. Tap to confirm." |
| Missed dose | Calm, non-judgmental | "Metformin was due 2 hours ago. Mark as taken or skip." |
| Minor interaction | Informative | "These medications are sometimes taken together. Ask your pharmacist about timing." |
| Major interaction | Clear, serious | "This combination requires medical review before use." |
| Contraindicated | Urgent, direct | "Do not take these together. Contact your doctor now." |
| Caregiver alert | Factual, not alarming | "Mom missed her 8am Lisinopril. Last confirmed dose was yesterday at 8:02am." |
| Empty state | Helpful | "No medications added yet. Tap + to add your first, or scan a pill bottle." |
| Error | Human, actionable | "We couldn't scan that label. Try better lighting or type the name manually." |
| Success | Understated | "Medication added." (not "Excellent! You're doing great!") |

**Never use:**
- Medical jargon without plain-language explanation
- "Please" and "Thank you" (app is a tool, not a service clerk)
- Urgency language for non-urgent things ("ASAP", "immediately", "right now")
- Passive voice for critical information
- Red color for anything that is not a contraindicated interaction

### 1.6 Logo Concept Direction

**Concept:** The SafeDose mark is a pill capsule with a subtle shield embedded in its form — combining medication with protection/safety. The capsule is rendered in two-tone teal (teal-500 top half / teal-700 bottom half), and the shield is suggested by the capsule's split-line forming a subtle chevron.

**Alternative concept (simpler):** A plus symbol (+) constructed from rounded pill-capsule shapes — four pills arranged in a cross. Entirely in teal-600. This is simpler to render at small sizes and communicates both medical and safety.

**Wordmark:** "SafeDose" in SF Pro Display Semibold (matching system font). The "Safe" portion in slate-700, the "Dose" portion in teal-600. No period, no tagline in the mark itself.

**App icon:** The pill capsule mark (or pill-plus) centered on a white rounded-square background for iOS, teal-600 background for Android. Avoid gradients in the icon — they compress poorly and look dated.

**Implementation note for Prism:** Use SVG for the mark in all in-app appearances. Provide the app icon at all required resolutions (@1x, @2x, @3x for iOS; mdpi through xxxhdpi for Android).

---

## Part 2 — Design Tokens (NativeWind/Tailwind)

These token definitions go in `tailwind.config.js` at the monorepo root (shared across the React Native app using NativeWind).

### 2.1 Complete Token Definitions

```js
// tailwind.config.js
module.exports = {
  content: [
    './apps/mobile/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand — Teal
        'brand-50':  '#F0FDFA',
        'brand-100': '#CCFBF1',
        'brand-200': '#99F6E4',
        'brand-400': '#2DD4BF',
        'brand-500': '#14B8A6',  // primary
        'brand-600': '#0D9488',  // interactive default
        'brand-700': '#0F766E',  // interactive pressed
        'brand-800': '#115E59',  // dark mode primary
        'brand-900': '#134E4A',

        // Neutral — Slate
        'neutral-50':  '#F8FAFC',
        'neutral-100': '#F1F5F9',
        'neutral-200': '#E2E8F0',
        'neutral-300': '#CBD5E1',
        'neutral-400': '#94A3B8',
        'neutral-500': '#64748B',
        'neutral-600': '#475569',
        'neutral-700': '#334155',
        'neutral-800': '#1E293B',
        'neutral-900': '#0F172A',
        'neutral-950': '#020617',

        // Severity
        'severity-contraindicated': '#DC2626',
        'severity-major':    '#EA580C',
        'severity-moderate': '#D97706',
        'severity-minor':    '#2563EB',
        'severity-safe':     '#16A34A',

        // Severity — Dark Mode
        'severity-contraindicated-dark': '#FCA5A5',
        'severity-major-dark':    '#FDBA74',
        'severity-moderate-dark': '#FCD34D',
        'severity-minor-dark':    '#93C5FD',
        'severity-safe-dark':     '#86EFAC',

        // Dose Status
        'dose-taken':    '#16A34A',
        'dose-late':     '#D97706',
        'dose-missed':   '#DC2626',
        'dose-due':      '#2563EB',
        'dose-upcoming': '#94A3B8',
        'dose-paused':   '#94A3B8',

        // Semantic State
        'state-success': '#16A34A',
        'state-warning': '#D97706',
        'state-error':   '#DC2626',
        'state-info':    '#2563EB',
      },

      fontSize: {
        'xs':   ['12px', { lineHeight: '18px' }],
        'sm':   ['14px', { lineHeight: '20px' }],
        'base': ['17px', { lineHeight: '26px' }],
        'lg':   ['20px', { lineHeight: '28px' }],
        'xl':   ['24px', { lineHeight: '32px' }],
        '2xl':  ['28px', { lineHeight: '36px' }],
        '3xl':  ['34px', { lineHeight: '42px' }],
        '4xl':  ['40px', { lineHeight: '48px' }],
      },

      fontWeight: {
        normal:   '400',
        medium:   '500',
        semibold: '600',
        bold:     '700',
      },

      spacing: {
        // 4pt base grid — all spacing is a multiple of 4
        '0':   '0px',
        '1':   '4px',    // 4pt — minimum gap
        '2':   '8px',    // 8pt — tight spacing
        '3':   '12px',   // 12pt — compact
        '4':   '16px',   // 16pt — default content padding
        '5':   '20px',   // 20pt — comfortable spacing
        '6':   '24px',   // 24pt — section gap
        '7':   '28px',
        '8':   '32px',   // 32pt — large section gap
        '10':  '40px',
        '11':  '44px',   // 44pt — minimum touch target
        '12':  '48px',   // 48pt — comfortable touch target
        '14':  '56px',   // 56pt — large button height
        '16':  '64px',
        '20':  '80px',
        '24':  '96px',
      },

      borderRadius: {
        'none':  '0px',
        'sm':    '6px',    // inputs, small elements
        'md':    '10px',   // cards, buttons — PRIMARY
        'lg':    '14px',   // bottom sheets, modals
        'xl':    '20px',   // large cards, onboarding
        'full':  '9999px', // badges, pills, FAB
      },

      // Elevation — React Native shadow (iOS) + elevation (Android)
      // Defined as custom utilities via NativeWind plugin
      // Use as: shadow-card, shadow-modal, shadow-fab
    },
  },
}
```

### 2.2 Spacing Rationale

The 4pt base grid (matching Apple's HIG and Material Design) ensures every spacing decision is consistent and logical. Key values to internalize:

| Value | Pixels | Use Case |
|---|---|---|
| `space-1` (4pt) | 4px | Minimum gap — icon to label |
| `space-2` (8pt) | 8px | Between list items within a group |
| `space-3` (12pt) | 12px | Internal card padding (tight) |
| `space-4` (16pt) | 16px | Screen horizontal padding, card padding (default) |
| `space-5` (20pt) | 20px | Between grouped sections |
| `space-6` (24pt) | 24px | Major section separation |
| `space-8` (32pt) | 32px | Between primary screen sections |
| `space-11` (44pt) | 44px | Minimum touch target — FLOOR, never go below |
| `space-12` (48pt) | 48px | Comfortable button height |
| `space-14` (56pt) | 56px | FAB, prominent action buttons |

### 2.3 Elevation / Shadow System

React Native shadows are defined differently per platform. Use these named elevation levels:

| Level | Name | iOS Shadow | Android Elevation | Use Case |
|---|---|---|---|---|
| 0 | `flat` | none | 0 | Default — background-level |
| 1 | `surface` | offset 0,1 / blur 2 / opacity 0.06 | 1 | Cards on background |
| 2 | `card` | offset 0,2 / blur 4 / opacity 0.08 | 2 | MedCards, list items |
| 3 | `raised` | offset 0,4 / blur 8 / opacity 0.10 | 4 | Active cards, dropdowns |
| 4 | `modal` | offset 0,8 / blur 16 / opacity 0.12 | 8 | Bottom sheets, modals |
| 5 | `fab` | offset 0,6 / blur 12 / opacity 0.15 | 6 | FAB, toast |

Shadow color: `#000000` on light mode, `#000000` with reduced opacity on dark mode (shadows are invisible on dark — use `border border-neutral-800` as supplement on dark surfaces).

---

## Part 3 — Core Component Specifications

### 3.1 MedCard

**Purpose:** The primary list item representing a single medication. Appears in Today's Schedule (with dose-time context) and Medication List (without time context). The most-seen component in the app — must be skimmable at a glance.

**Layout:**

```
+--------------------------------------------------+
| [PillIcon]  Drug Name · Dosage          [Status] |
|             Next dose: 8:00 AM                   |
|             0.5 tablet · With food               |
+--------------------------------------------------+
```

- Container: `bg-white dark:bg-neutral-800` / `rounded-md` / `shadow-card` / horizontal padding `space-4` / vertical padding `space-3`
- Left icon: `Pill` Lucide, 20pt, `text-brand-500`, vertically centered
- Drug name: `text-lg font-semibold text-neutral-700 dark:text-neutral-100`
- Dosage: `text-base text-neutral-500 dark:text-neutral-400` — same line, separated by `·` character
- Next dose time: `text-sm text-neutral-500` on second line
- Instructions: `text-sm text-neutral-400` — third line, only shown if present
- Status badge: right-aligned, `StatusBadge` component (see 3.6), vertically centered

**States:**

| State | Visual Change |
|---|---|
| Default | White card, shadow-card |
| Due now | Left border: 3pt `border-l-4 border-dose-due` |
| Missed | Left border: 3pt `border-l-4 border-dose-missed`, status badge "Missed" red |
| Taken | Reduced opacity `opacity-60`, status badge "Taken" green |
| Paused | Status badge "Paused" gray, card `opacity-70` |
| Has interaction warning | Right-side `AlertTriangle` icon in severity color, tappable |
| Loading skeleton | Gray animated shimmer, same dimensions |

**Interactions:**
- Tap: navigate to Medication Detail screen
- Long press: show action sheet (Edit / Pause / Delete)
- Interaction badge tap: open InteractionAlert modal for that specific pair

**Accessibility:**
- `accessibilityRole="button"`
- `accessibilityLabel`: "[Drug name], [dose], [next dose time], [status]. Double tap to view details."
- Interaction warning badge: separate focusable element with its own `accessibilityLabel`: "[Severity] interaction detected. Double tap to review."
- Focus order: card → interaction badge (if present)
- Minimum height: 72pt (accommodates 3 lines + padding + touch target)

---

### 3.2 InteractionAlert

**Purpose:** Communicates a detected drug interaction in plain English. Appears as a modal when adding a new medication that conflicts, and as an inline expanded state on MedCard.

**Layout (modal version):**

```
+--------------------------------------------------+
| [Severity Icon]  [SEVERITY LABEL]            [X] |
|                                                  |
| Drug A + Drug B                                  |
|                                                  |
| Plain English explanation (2-3 sentences max)    |
|                                                  |
| [Learn More]              [I Understand, Continue]|
+--------------------------------------------------+
```

- Container: `bg-white dark:bg-neutral-900` / `rounded-lg` / `shadow-modal`
- Header strip: full-width, height 52pt, background = severity color (see palette), text `text-white font-semibold text-lg`
- Severity icon: Lucide icon for severity level, 22pt, white
- Severity label: ALL CAPS, `tracking-wider text-sm font-bold text-white`
- Drug name line: `text-xl font-bold text-neutral-800 dark:text-neutral-100` / padding `space-4`
- Explanation body: `text-base text-neutral-600 dark:text-neutral-300` / padding `space-4` / `leading-relaxed`
- "Learn More": ghost button, `text-brand-600`, launches drug reference bottom sheet
- Primary action: "I Understand, Continue" — only for minor/moderate. For major/contraindicated, button reads "Contact My Doctor" (links to phone dialer) and there is no "continue anyway" option in v1

**States:**
- Contraindicated: red-600 header, X-circle icon, no continue button
- Major: orange-600 header, alert-triangle icon, continue button present but secondary-styled
- Moderate: amber-600 header, alert-circle icon, continue button primary-styled
- Minor: blue-600 header, info icon, informational — no blocking behavior

**Accessibility:**
- Modal must trap focus while open
- `accessibilityViewIsModal={true}` on container
- `accessibilityRole="alert"` for auto-announcement on screen reader
- Severity label is announced first: "[Contraindicated interaction] — [Drug A] and [Drug B]..."
- Close button: `accessibilityLabel="Dismiss interaction alert"`
- Haptic: `UIImpactFeedbackGenerator.heavy` on present for major/contraindicated

---

### 3.3 DoseConfirmation

**Purpose:** The primary action on the Today's Schedule screen. Confirming a dose is the single most important interaction in the app — it must be satisfying, clear, and resistant to accidental confirmation (which could cause a user to believe they took a dose they didn't take, leading to double-dosing).

**Design decision:** Swipe-to-confirm (not tap-to-confirm) for primary dose confirmation. Rationale: a swipe requires deliberate intent, preventing accidental taps (critical for a health-safety app). One-tap confirmation available as accessibility fallback and for users who prefer it in Settings.

**Layout:**

```
+--------------------------------------------------+
|  Metformin 500mg — 8:00 AM                       |
|                                                  |
|  [Swipe to confirm ————————————>  [Check] ]      |
|                                                  |
|  Taken  |  Skip  |  Snooze 30min               |
+--------------------------------------------------+
```

- Container: `bg-white dark:bg-neutral-800` / `rounded-xl` / `shadow-card`
- Drug info header: `text-lg font-semibold` name, `text-base text-neutral-500` time
- Swipe track: `bg-neutral-100 dark:bg-neutral-700` / `rounded-full` / height 52pt / full width with `space-4` horizontal margin
- Swipe thumb: `bg-brand-600` / `rounded-full` / 44pt square / centered icon `Check` white 20pt
- Track label: "Swipe to confirm" — `text-sm text-neutral-400` centered in track, disappears as thumb moves right
- Secondary actions: three equal-width ghost buttons below the track, `text-sm text-neutral-500`

**Confirmation animation:**
1. User drags thumb to 80%+ of track width
2. Thumb snaps to end (spring animation, 200ms, ease-out)
3. Track background transitions to `bg-dose-taken` (green-600)
4. Track label transitions to "Confirmed" in white
5. Haptic: medium impact
6. Card collapses/fades from timeline (300ms ease-out)
7. Confetti NOT used — this is a health app, not a game

**Skip state:** "Skip" opens a reason sheet (Couldn't take / Already took earlier / Medication paused). Not tracked as "missed" if skipped with reason.

**Accessibility:**
- `accessibilityRole="adjustable"` on swipe component
- `accessibilityLabel="Confirm [drug name] dose. Swipe right or double tap to confirm."`
- Double-tap to confirm is the screen reader action (swipe metaphor doesn't translate to VoiceOver)
- Haptic fires on confirmation
- Settings toggle: "Tap to confirm instead of swipe" — overrides swipe behavior globally

---

### 3.4 CaregiverBadge

**Purpose:** Compact identity chip showing a caregiver's name, role, and connection status. Appears in the patient's Medication Detail screen (showing which caregiver is monitoring this med), in the Caregiver Dashboard, and in notification context.

**Layout:**

```
[Avatar initials]  Sarah R.     |  Caregiver  [Connected ●]
```

- Container: `bg-neutral-100 dark:bg-neutral-800` / `rounded-full` / horizontal padding `space-3` / height 36pt
- Avatar: circle 28pt, `bg-brand-500` background, initials in `text-sm font-semibold text-white`
- Name: `text-sm font-medium text-neutral-700 dark:text-neutral-200`
- Role label: `text-xs text-neutral-400` — "Caregiver" / "Primary Caregiver" / "Healthcare Provider"
- Status dot: 8pt circle — green `#16A34A` for connected, gray `#94A3B8` for pending/disconnected
- Status text: "Connected" / "Invite pending" / "Disconnected" — `text-xs text-neutral-400`

**States:**
- Connected: green dot, full opacity
- Invite pending: amber dot, label "Invite pending"
- Disconnected: gray dot, reduced opacity `opacity-60`
- Pending approval: pulsing amber dot (slow pulse animation, 1.5s, reduces to 0 for reduced-motion pref)

**Accessibility:**
- `accessibilityLabel`: "[Name], [role], [status]"
- Tap navigates to caregiver detail/management

---

### 3.5 EmergencyCard

**Purpose:** Full-screen, offline-accessible card containing the patient's critical medication list, emergency contacts, allergies, and conditions. Designed to be shown to first responders or ER staff. One-tap access from the app lock screen widget or from main nav.

**Design principles:**
- Maximum contrast (black on white or white on black — no color subtleties)
- Large text (minimum `text-xl` for labels, `text-2xl` for values)
- No navigation required — everything on one scrollable screen
- Works without internet, without unlocking device (via widget / lock screen shortcut)
- QR code encodes structured medication + allergy data for scanning by medical devices

**Layout:**

```
+--------------------------------------------------+
| SAFEDOSE EMERGENCY CARD           [QR Code 80pt] |
|                                                  |
| MARGARET CHEN  78  Female  B+                   |
| DOB: March 15, 1948                              |
|                                                  |
| EMERGENCY CONTACTS                               |
| Sarah Chen (Daughter) · 555-0147                 |
| Dr. Patel (Primary) · 555-0203                   |
|                                                  |
| ALLERGIES                                        |
| Penicillin (Anaphylaxis)  |  Sulfa drugs         |
|                                                  |
| CURRENT MEDICATIONS                              |
| Lisinopril 10mg · Once daily                     |
| Metformin 500mg · Twice daily                    |
| Atorvastatin 20mg · Once daily at bedtime        |
| ... [all medications]                            |
|                                                  |
| CONDITIONS                                       |
| Type 2 Diabetes  |  Hypertension  |  High Chol.  |
|                                                  |
| Last updated: March 15, 2026 at 8:02 AM         |
+--------------------------------------------------+
```

- Background: `bg-white` — no dark mode on emergency card (first responders need maximum legibility in varied lighting)
- Top bar: `bg-neutral-900 text-white` — high contrast header
- Patient name: `text-2xl font-bold text-neutral-900`
- Section headers: `text-sm font-bold text-neutral-400 tracking-widest` (ALL CAPS)
- Values: `text-lg text-neutral-800`
- Allergy pills: `bg-severity-contraindicated/10 border border-severity-contraindicated text-severity-contraindicated font-medium rounded-full px-3 py-1`
- QR code: 80pt x 80pt, top-right corner — generated on-device from medication data (no external QR service)
- Print button: allows sharing as PDF (offline printout for wallet/fridge)
- Update timestamp: `text-xs text-neutral-400` at bottom — shows last sync time

**Accessibility:**
- `accessibilityViewIsModal={true}`
- All text uses largest accessible font but layout is fixed (emergency cards must not reflow in ways that hide data)
- VoiceOver reads all fields in logical order: name → age → blood type → allergies → medications → conditions
- `accessibilityLabel` for QR code: "QR code containing full medication data. Can be scanned by medical devices."

---

### 3.6 StatusBadge

**Purpose:** Compact pill-shaped status indicator for medication state. Appears on MedCard, Medication List, and Caregiver Dashboard.

**Layout:**

```
● Active    ● Paused    ✕ Discontinued
```

- Container: `rounded-full px-3 py-1` / inline-block
- Icon: 10pt circle (filled) or 10pt X (discontinued)
- Label: `text-xs font-semibold`
- Height: 22pt

**Variants:**

| Status | Background | Text | Icon |
|---|---|---|---|
| Active | `bg-state-success/15` | `text-state-success` | Circle filled green |
| Paused | `bg-neutral-100` dark: `bg-neutral-700` | `text-neutral-500` | Circle outlined gray |
| Discontinued | `bg-neutral-100` dark: `bg-neutral-700` | `text-neutral-400` | X gray |
| PRN (as needed) | `bg-brand-50` dark: `bg-brand-900/30` | `text-brand-600` | Clock |

**Accessibility:**
- `accessibilityLabel`: "[Status]" — e.g., "Active", "Paused", "Discontinued"
- Never rely on color alone — text label always present

---

### 3.7 BottomSheet

**Purpose:** Modal layer for add/edit actions, detailed information, and secondary flows. Slides up from bottom, dims background. Replaces full-screen navigation for actions that don't warrant their own screen.

**Layout:**

```
+--------------------------------------------------+
|              [Drag handle 40pt wide]             |
| [Close X]     Sheet Title         [Action]       |
|--------------------------------------------------|
|                                                  |
|  Content area (scrollable)                       |
|                                                  |
+--------------------------------------------------+
```

- Drag handle: 4pt tall / 40pt wide / `bg-neutral-300 dark:bg-neutral-600` / `rounded-full` / centered top
- Background: `bg-white dark:bg-neutral-900` / `rounded-t-lg`
- Header: 52pt height / `border-b border-neutral-200 dark:border-neutral-700`
- Title: `text-lg font-semibold text-neutral-800 dark:text-neutral-100` / centered
- Close button: `X` icon 20pt, top-left, hit target 44pt
- Action button (optional): text button top-right (e.g., "Save", "Done")
- Content: `ScrollView` with `px-4 py-4`

**Snap points:** 50% (half-sheet for simple confirmations), 90% (near-full for forms)

**Dismiss:** drag down past 30% of height → dismiss. Tap background overlay → dismiss.

**Accessibility:**
- `accessibilityViewIsModal={true}`
- Focus moves to first focusable element inside sheet on open
- Drag handle: `accessibilityLabel="Dismiss panel"` / `accessibilityRole="button"`
- Keyboard avoidance: `KeyboardAvoidingView` wraps content, sheet rises with keyboard

---

### 3.8 Button

**Purpose:** Primary interaction element. Clear variant hierarchy prevents ambiguity about what action is primary.

**Variants and specs:**

| Variant | Background | Text | Border | Use Case |
|---|---|---|---|---|
| Primary | `bg-brand-600` | `text-white font-semibold` | None | Single CTA per screen |
| Secondary | `bg-neutral-100 dark:bg-neutral-800` | `text-neutral-700 dark:text-neutral-200 font-medium` | None | Secondary actions |
| Danger | `bg-state-error` | `text-white font-semibold` | None | Destructive actions (delete, discontinue) |
| Ghost | transparent | `text-brand-600 dark:text-brand-400 font-medium` | None | Tertiary, contextual actions |
| Outline | transparent | `text-neutral-700 dark:text-neutral-200 font-medium` | `border border-neutral-300 dark:border-neutral-600` | Equal-weight options |

**Sizes:**

| Size | Height | H Padding | Font Size | Use Case |
|---|---|---|---|---|
| SM | 36pt | 14pt | `text-sm` | Inline, secondary row actions |
| MD | 44pt | 16pt | `text-base` | Default — standard actions |
| LG | 52pt | 20pt | `text-lg` | Primary CTA, bottom action bars |
| Full | 52pt | — | `text-lg` | Full-width bottom-of-screen CTA |

**States:**
- Default: as above
- Pressed: lighten primary 10% (`bg-brand-500`), darken secondary 5% — use `activeOpacity={0.85}` on TouchableOpacity
- Disabled: `opacity-40`, `cursor not-allowed` (no pointer on mobile but prevents `onPress`)
- Loading: replace label with `ActivityIndicator` (white for primary/danger, brand for secondary/ghost), same dimensions

**Rules:**
- Maximum ONE primary button per screen
- Never use ghost as the only button — ghost is always accompanied by primary or secondary
- Danger variant requires confirmation (either BottomSheet confirmation or inline "tap twice to confirm" pattern)
- Icon-only buttons must have `accessibilityLabel`

**Accessibility:**
- `accessibilityRole="button"`
- Minimum 44pt touch target on all sizes (SM achieves this via expanded hit slop)
- All loading states announce via `accessibilityLiveRegion="polite"`

---

### 3.9 Input

**Purpose:** Form fields for manual medication entry, profile setup, and settings. Medical data input demands extra care — label clarity, validation, and error messaging are non-negotiable.

**Layout (default text input):**

```
+--------------------------------------------------+
| Medication Name                                  |
| +----------------------------------------------+ |
| | Lisinopril                                   | |
| +----------------------------------------------+ |
| Enter the medication name as it appears on the   |
| label (e.g., "Lisinopril" not "Blood Pressure    |
| Pill")                                           |
+--------------------------------------------------+
```

- Label: `text-sm font-medium text-neutral-700 dark:text-neutral-300` / above field / `mb-1.5`
- Required indicator: asterisk `*` in `text-state-error` appended to label
- Field container: `border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 rounded-md`
- Input text: `text-base text-neutral-800 dark:text-neutral-100`
- Placeholder: `text-neutral-400 dark:text-neutral-500` — must still pass 4.5:1 contrast ratio
- Helper text: `text-sm text-neutral-500 dark:text-neutral-400` / below field / `mt-1`
- Field height: 48pt (comfortable touch target, fits large system font scaling)

**States:**

| State | Border | Background | Notes |
|---|---|---|---|
| Default | `border-neutral-300` | `bg-white` | — |
| Focused | `border-brand-500` `ring-2 ring-brand-200` | `bg-white` | Ring provides focus visibility |
| Error | `border-state-error` `ring-2 ring-red-200` | `bg-white` | Error message appears below |
| Disabled | `border-neutral-200` | `bg-neutral-50` | Reduced opacity `opacity-60` |
| Filled | `border-neutral-300` | `bg-white` | Value visible — no special state |

**Error message:**
- `text-sm text-state-error` / `mt-1` / includes `accessibilityRole="alert"`
- Never technical — always human: "Please enter a medication name" not "Field required"
- Icon: `AlertCircle` 14pt, inline before text

**Input type variants:**

| Type | Keyboard | Notes |
|---|---|---|
| Text | Default | Drug names, instructions |
| Numeric | `keyboardType="decimal-pad"` | Dose amounts |
| Integer | `keyboardType="number-pad"` | Quantity, refills |
| Date | `DateTimePicker` | Start date, refill date — native date picker |
| Time | `DateTimePicker` | Reminder time — native time picker |
| Search | `keyboardType="default"` with `search` returnKey | Drug name autocomplete |

**Accessibility:**
- All fields have explicit `label` associated via `nativeID`
- Error states announce via `accessibilityLiveRegion="assertive"`
- Placeholder text is supplemental only — label is always present (never placeholder-only fields)

---

## Part 4 — Screen Wireframes

Screen dimensions referenced: 390pt x 844pt (iPhone 14 Pro equivalent). All layouts are mobile-first and tested for 320pt minimum width.

### 4.1 Onboarding Flow

**Flow overview:**

```
Welcome → [Add First Medication] → [Set Reminder] → [Invite Caregiver (skippable)]
```

---

#### Screen 1 of 4 — Welcome

```
+------------------------------------------+
|                                          |
|                                          |
|            [SafeDose Logo]               |
|               SafeDose                   |
|                                          |
|    Your medication safety companion      |
|                                          |
|                                          |
|  [Pill icon 48pt]                        |
|  Never miss a dose.                      |
|                                          |
|  [Shield icon 48pt]                      |
|  Catch dangerous interactions.           |
|                                          |
|  [Users icon 48pt]                       |
|  Keep your family informed.              |
|                                          |
|                                          |
|   Everything stays on your device.       |
|      No ads. No data selling.            |
|                                          |
|                                          |
| [Get Started — full-width LG primary]   |
|                                          |
| [I already have an account — ghost]      |
|       page indicator ● ○ ○ ○            |
+------------------------------------------+
```

- Centered layout, generous vertical spacing
- Logo + wordmark at top third
- Three value props with icons (not bullet points — icons are warmer)
- Privacy promise line: `text-sm text-neutral-500` — short and sincere, not a marketing slogan
- CTA at bottom in safe area / thumb zone
- No skip — this is 1 screen, not a carousel

---

#### Screen 2 of 4 — Add First Medication

```
+------------------------------------------+
| < Back               Step 2 of 4         |
|                                          |
| Add your first medication                |
| This takes about 30 seconds.             |
|                                          |
| +--------------------------------------+ |
| |  [Camera icon 32pt]                  | |
| |  Scan pill bottle                    | |
| |  Point camera at the label           | |
| +--------------------------------------+ |
|                                          |
|           or type manually               |
|                                          |
| Medication name                          |
| +--------------------------------------+ |
| | Start typing...                      | |
| +--------------------------------------+ |
| Suggestions: Lisinopril, Metformin...    |
|                                          |
|                                          |
| [Continue — full-width LG primary]      |
|                                          |
|    [Skip for now — ghost]               |
|       page indicator ● ● ○ ○            |
+------------------------------------------+
```

- Scan option is primary (large card) — drives OCR adoption
- Manual input is secondary — "or type manually" separator
- Autocomplete suggestions appear as you type (from on-device RxNorm database)
- Skip allowed — user can add medications later
- Back navigation always present

---

#### Screen 3 of 4 — Set Reminder

```
+------------------------------------------+
| < Back               Step 3 of 4         |
|                                          |
| When do you take it?                     |
| Lisinopril 10mg                          |
|                                          |
| [Clock icon] Morning dose                |
|                                          |
|          [  8:00 AM  ]                  |
|         native time picker               |
|                                          |
| Remind me                                |
| [● 5 minutes before]                    |
|   15 minutes before                      |
|   30 minutes before                      |
|   At dose time                           |
|                                          |
| Repeat                                   |
| [● Every day]                           |
|   Specific days...                       |
|   Every N days...                        |
|                                          |
|                                          |
| [Set Reminder — full-width LG primary]  |
| [No reminders for this one — ghost]     |
|       page indicator ● ● ● ○            |
+------------------------------------------+
```

- Pre-filled with common defaults (8:00 AM, 5 min before, every day)
- Native time picker — not custom (faster, accessible, familiar)
- Radio-style reminder timing selector — visual, not dropdown
- "No reminders" escape hatch for users managing their own schedule

---

#### Screen 4 of 4 — Invite Caregiver

```
+------------------------------------------+
| < Back               Step 4 of 4         |
|                                          |
| Keep someone in the loop                 |
| Optional — you can always do this later. |
|                                          |
|  Who helps you with your medications?    |
|                                          |
| [Name input]                             |
| Their name                               |
|                                          |
| [Phone/Email input]                      |
| Phone or email                           |
|                                          |
| They'll receive an invitation and can:   |
|  ✓ See your medication schedule          |
|  ✓ Get notified if you miss a dose       |
|  ✗ Cannot change your medications        |
|  ✗ Cannot see your full health profile   |
|                                          |
| [Send Invitation — full-width LG primary]|
| [Skip — ghost]                           |
|       page indicator ● ● ● ●            |
+------------------------------------------+
```

- Explicit permission boundaries — trust is earned by transparency
- "Skip" is prominent — no manipulation to force invites
- Permission checklist with clear ✓/✗ distinction (not just bullet points)
- After skip or send: navigate to Today's Schedule screen

---

### 4.2 Today's Schedule

**Primary daily-use screen.** Most users open the app once or twice daily to confirm doses. The design must let them complete the task in under 10 seconds.

```
+------------------------------------------+
| [Avatar 32pt]  Today              [Bell] |
|                Tuesday, March 15          |
|                                          |
| [Adherence ring] 2 of 5 doses taken      |
|                  40% today               |
|                                          |
|------------------------------------------------|
|  9:00 AM — MORNING                             |
|                                                |
|  [MedCard + DoseConfirmation — Lisinopril]     |
|  [MedCard + DoseConfirmation — Metformin]      |
|  [MedCard — Atorvastatin  ✓ Taken 8:53am]      |
|                                                |
|  1:00 PM — AFTERNOON                           |
|                                                |
|  [MedCard + DoseConfirmation — Metformin]      |
|  (Due in 2 hours — upcoming state)             |
|                                                |
|  9:00 PM — EVENING                             |
|  (future doses shown in upcoming state)        |
|  [MedCard — Lisinopril upcoming]               |
|                                                |
+------------------------------------------+
|  Meds  |  Schedule  |  Caregivers  |  More  |
+------------------------------------------+
```

- **Adherence ring:** large donut chart, `teal-500` filled arc, `neutral-100` track. Number at center `text-3xl font-bold`. Motivating without being gamified — no streak counters, no badges
- **Timeline groups:** time headings `text-sm font-bold text-neutral-400 tracking-widest` (Morning / Afternoon / Evening / Night)
- **Taken cards:** visually de-emphasized (`opacity-60`) but not removed — visible record that it happened
- **Due now cards:** subtly elevated, left blue border
- **Empty state:** "All caught up for today." with a check icon, no medications due
- **Missed dose (past window):** amber banner above timeline section: "Metformin was missed at 1:00 PM. Tap to update."
- **Bottom tab bar:** 4 items only (Hick's Law). Icons + labels. Active tab: filled icon + teal label

**FAB:** "+" button, `bg-brand-600 shadow-fab`, bottom-right, 56pt, above tab bar — opens BottomSheet for "Add Medication" or "Log dose manually"

---

### 4.3 Medication List

```
+------------------------------------------+
| Medications                  [+]  [Search]|
|                                          |
| [Current]  [Paused]  [Discontinued]      |
|  (tab bar — segment selector style)      |
|                                          |
| A                                        |
| [MedCard — Atorvastatin]                 |
|                                          |
| L                                        |
| [MedCard — Lisinopril]  [!interaction]   |
|                                          |
| M                                        |
| [MedCard — Metformin]                    |
|                                          |
|                                          |
| [Empty state if no meds:]               |
| Pill icon (large, neutral-200)           |
| No medications yet                       |
| Add your first medication to get started |
| [+ Add Medication]                       |
|                                          |
+------------------------------------------+
|  Meds  |  Schedule  |  Caregivers  |  More  |
+------------------------------------------+
```

- **Tab selector:** 3 tabs (Current / Paused / Discontinued). Segment-control style — `bg-neutral-100` track, `bg-white shadow-sm` active pill
- **Alphabetical section headers:** `text-sm font-bold text-neutral-400` — letter anchors for long lists
- **Search:** opens inline search bar at top, filters list live, searches by drug name or condition
- **Interaction indicator:** orange `AlertTriangle` 16pt icon on right side of MedCard if interaction present — tap to see detail
- **FAB:** same as Today screen — adds medication

---

### 4.4 Add Medication

Opened as full-screen modal (slides up) triggered from FAB.

```
+------------------------------------------+
| [X] Cancel    Add Medication    [Save]   |
|                                          |
|  [Camera scan card — large, prominent]  |
|  [Camera icon 28pt]                      |
|  Scan Pill Bottle                        |
|  Point camera at the label for           |
|  automatic fill-in                       |
|                                          |
|          — or enter manually —           |
|                                          |
| Medication Name *                        |
| [Input with autocomplete]                |
|                                          |
| Dose Amount *                            |
| [Numeric input]  [Unit dropdown]         |
| e.g., 10         mg / mcg / mL / units  |
|                                          |
| Form                                     |
| [Tablet] [Capsule] [Liquid] [Injection]  |
| (chip selector)                          |
|                                          |
| Instructions (optional)                  |
| [Text input — "Take with food" etc.]     |
|                                          |
| Start Date                               |
| [Date picker — defaults to today]        |
|                                          |
| Prescribing Doctor (optional)            |
| [Text input]                             |
|                                          |
| Pharmacy (optional)                      |
| [Text input]                             |
|                                          |
| [Continue to Set Reminders >]           |
+------------------------------------------+
```

- **Scan card:** primary visual in the screen — always shown, not buried
- **Autocomplete:** as user types drug name, suggest from RxNorm local DB. Suggestion row includes generic name + common brand name
- **Form chip selector:** visual — not a dropdown. Pills `rounded-full` style, selected = `bg-brand-600 text-white`, unselected = `bg-neutral-100 text-neutral-600`
- **Interaction check:** fires in background as user types drug name. If interaction detected before save, InteractionAlert modal presents before completing save
- **Save button:** disabled until required fields filled (name + dose amount)
- **Progress:** "1 of 2" indicator — this leads to a reminder-setting screen

---

### 4.5 Medication Detail

Full-screen view for a single medication. Opened from MedCard tap.

```
+------------------------------------------+
| < Back                        [Edit] [More|
|                                          |
| Lisinopril                               |
| 10mg · Tablet · Once daily               |
| [StatusBadge: Active]                    |
|                                          |
| Next dose: Today at 8:00 PM             |
|                                          |
|--------- REMINDERS ----------------------|
| [Clock icon] 8:00 AM · Every day        |
| [Edit reminder]                          |
|                                          |
|--------- DRUG INFORMATION ---------------|
| Generic name: Lisinopril                 |
| Brand names: Prinivil, Zestril          |
| Class: ACE Inhibitor                     |
| Used for: High blood pressure            |
|                                          |
| [View full drug reference →]            |
|                                          |
|-------- INTERACTIONS (1 detected) -------|
|                                          |
| [InteractionAlert inline — moderate]     |
| Lisinopril + Potassium supplements       |
| May elevate potassium levels...          |
| [View detail]                            |
|                                          |
|---------- DOSE HISTORY ------------------|
| Today       8:00 AM    Taken at 7:58 AM  |
| Yesterday   8:00 AM    Taken at 8:14 AM  |
| Mar 13      8:00 AM    Missed            |
|                                          |
| [View full history →]                   |
|                                          |
|---------- CAREGIVER VISIBILITY ----------|
| [CaregiverBadge — Sarah R. · Connected] |
|                                          |
|                                          |
| [Pause Medication — outline danger]     |
+------------------------------------------+
```

- **Header:** drug name `text-2xl font-bold`, dose info `text-base text-neutral-500`
- **Sections:** divided by section headers using `text-sm font-bold text-neutral-400 tracking-widest` (UPPERCASE) with horizontal rules
- **Interaction section:** inline condensed InteractionAlert — expandable, not a full modal unless user taps "View detail"
- **Dose history:** table-style with 3 columns (date, scheduled, actual/status). Rows alternate light background for readability
- **Pause button:** bottom of scroll, styled as outline danger — requires confirmation via BottomSheet

---

### 4.6 Interaction Alert Modal

Presented automatically when a new medication is added that conflicts with an existing one. Also accessible from Medication Detail.

```
+------------------------------------------+
|  ████████████████████████████████████   |
|  [AlertTriangle 22pt]  MAJOR INTERACTION |
|                                          |
|  Lisinopril + Ibuprofen                  |
|                                          |
|  Ibuprofen and similar NSAIDs can        |
|  reduce the blood pressure-lowering      |
|  effect of Lisinopril and may impair     |
|  kidney function when taken together.   |
|                                          |
|  Doctors may prescribe these together   |
|  in some cases. Talk to your pharmacist |
|  or doctor before combining.             |
|                                          |
|  [Learn More about this interaction]    |
|                                          |
|  ----------------------------------------|
|                                          |
|  [Contact My Doctor]  [Add Anyway]      |
|  (Secondary)          (Danger outline)  |
+------------------------------------------+
```

- **Header strip:** full width, `bg-severity-major` (orange-600), white icon + label
- **Drug name line:** `text-xl font-bold` — the specific drugs involved, not generic "interaction found"
- **Explanation:** plain English, 2-3 sentences. Medical jargon in parentheses only if needed. Reads at 8th-grade level
- **"Add Anyway":** present for major/moderate (not contraindicated). Styled as danger outline — visible but not inviting. Action is logged
- **Contraindicated variant:** no "Add Anyway" button. Only "Contact My Doctor" and "Do Not Add". The app does not enable adding a contraindicated medication in v1
- **Dismissal:** all dismissals are logged for caregiver visibility (caregiver sees "User reviewed interaction and proceeded")

---

### 4.7 Caregiver Dashboard

View available to linked caregivers when they open SafeDose under their own account. Shows the care recipient's data.

```
+------------------------------------------+
| [<] Margaret's Medications       [Alerts]|
|                                          |
| Today, Tuesday March 15                  |
|                                          |
| [Adherence ring — large]                 |
|  2 of 5 doses taken today               |
|  40% adherence this week                |
|                                          |
|---------- TODAY'S SCHEDULE -------------|
|                                          |
| [MedCard — Lisinopril — Taken 7:58 AM]  |
| [MedCard — Metformin — Taken 8:03 AM]   |
| [MedCard — Atorvastatin — Due 9:00 AM]  |
| [MedCard — Metformin — Due 1:00 PM]     |
| [MedCard — Lisinopril — Due 9:00 PM]   |
|                                          |
|--------- RECENT ALERTS -----------------|
|                                          |
| [AlertCircle amber] Mar 13 — Missed     |
| Lisinopril 10mg at 8:00 AM             |
|                                          |
| [Info blue] Mar 12 — Interaction note   |
| Lisinopril + Potassium reviewed         |
|                                          |
|----------- ALL MEDICATIONS -------------|
|                                          |
| [MedCard — Lisinopril — Active]         |
| [MedCard — Metformin — Active]          |
| [MedCard — Atorvastatin — Active]       |
| [MedCard — Potassium — Active / !]      |
|                                          |
|  [Request updated info from Margaret]   |
+------------------------------------------+
|  Overview  |  Schedule  |  History  |  More  |
+------------------------------------------+
```

- **Read-only:** caregivers see, they do not edit. No edit/add/delete controls
- **Adherence ring:** same component as patient view, but shows weekly % below daily count
- **Recent alerts:** missed doses and interaction reviews from past 7 days
- **"Request updated info":** sends a push notification to the patient asking them to confirm current medications are up to date — polite, not alarming

---

### 4.8 Emergency Card

Accessible from: (1) main navigation "More" tab → Emergency Card, (2) lock screen widget, (3) Apple Watch complication (post-MVP).

```
+------------------------------------------+
| SAFEDOSE EMERGENCY INFO    [Print] [Share]|
| ======================================== |
|                                          |
| MARGARET CHEN                [QR Code]  |
| Age 78 · Female · Blood Type: B+        |
|                                          |
| DOB: March 15, 1948                     |
|                                          |
| ---- EMERGENCY CONTACTS --------------- |
| Sarah Chen (Daughter)                   |
| 555-0147                                |
|                                          |
| Dr. Arun Patel (Primary Physician)      |
| 555-0203                                |
|                                          |
| ---- KNOWN ALLERGIES ------------------|
| [Red pill] PENICILLIN — Anaphylaxis     |
| [Red pill] SULFA DRUGS — Hives          |
|                                          |
| ---- CURRENT MEDICATIONS (6) ----------|
| Lisinopril 10mg     Once daily          |
| Metformin 500mg     Twice daily         |
| Atorvastatin 20mg   Once daily (PM)     |
| Potassium 10mEq     Once daily          |
| Aspirin 81mg        Once daily          |
| Omeprazole 20mg     Once daily          |
|                                          |
| ---- CONDITIONS ----------------------- |
| Type 2 Diabetes · Hypertension          |
| Hyperlipidemia                          |
|                                          |
| Last updated: Mar 15, 2026 at 8:02 AM  |
| ======================================= |
+------------------------------------------+
```

- **Always light mode** — never dark mode
- **Large high-contrast text throughout** — minimum `text-lg` for all values
- **QR code:** top-right, 80pt x 80pt — encodes JSON with: name, DOB, blood type, allergies, medications, emergency contacts
- **Allergy pills:** bright red outline badges — maximum salience for what matters most
- **Print / Share:** PDF export, formatted for wallet card or fridge magnet
- **No navigation chrome** — full screen, status bar hidden or black for maximum space
- **Offline:** entirely local — no API calls required. Data is pre-rendered on device

---

### 4.9 Settings

```
+------------------------------------------+
| Settings                                 |
|                                          |
| ACCOUNT                                  |
| [User icon] Profile                >    |
| [Lock icon] Privacy                >    |
|                                          |
| MEDICATIONS                              |
| [Bell icon] Notifications          >    |
| [Clock icon] Reminder defaults      >    |
| [Drug icon] Drug database           >    |
|             Last updated Mar 10         |
|                                          |
| CAREGIVERS                               |
| [Users icon] My caregivers         >    |
| [Link icon] Linked patients        >    |
|                                          |
| ACCESSIBILITY                            |
| [Eye icon] Display                  >    |
| [AA icon] Text size                 >    |
| [Vibrate] Haptic feedback    [Toggle]   |
| [Sound icon] Dose sound      [Toggle]   |
|                                          |
| LANGUAGE                                 |
| [Globe icon] App language          >    |
|              English (US)               |
|                                          |
| EMERGENCY CARD                           |
| [Heart icon] View emergency card    >   |
| [Edit icon] Edit emergency info     >   |
|                                          |
| DATA & PRIVACY                           |
| [Export icon] Export my data        >   |
| [Delete icon] Delete account        >   |
|                                          |
| ABOUT                                    |
| [Info icon] About SafeDose          >   |
| [Shield icon] Privacy policy        >   |
| [Star icon] Rate the app            >   |
| Version 1.0.0                           |
+------------------------------------------+
|  Meds  |  Schedule  |  Caregivers  |  More  |
+------------------------------------------+
```

- **Grouped list style:** system-standard iOS settings aesthetic — section headers `text-xs font-bold text-neutral-400 tracking-wider` / rows `bg-white dark:bg-neutral-800` with chevron
- **Toggles:** system-native Switch component — green when on (system default), but accessible without color (label + position convey state)
- **Danger actions:** "Delete account" lives at the bottom, has `text-state-error` label, requires BottomSheet confirmation with typing "DELETE" as confirmation pattern
- **Emergency card shortcut** in Settings gives a secondary path to emergency card

---

## Part 5 — Accessibility Requirements

### 5.1 Standards

| Standard | Requirement | Notes |
|---|---|---|
| WCAG 2.1 AA | Minimum for all app content | |
| WCAG 2.1 AAA | Required for: severity alerts, drug names, dose info, emergency card | Health-critical info demands maximum legibility |
| Apple HIG accessibility | Required for iOS | Includes Dynamic Type, VoiceOver, Switch Control |
| Material accessibility | Required for Android | Includes TalkBack, Font Scaling |

### 5.2 Color Contrast Requirements

| Context | Minimum Ratio | Target Ratio |
|---|---|---|
| Regular body text | 4.5:1 | 7:1 |
| Large text (>18pt or 14pt bold) | 3:1 | 4.5:1 |
| Drug names, dose amounts | 7:1 | 7:1 (AAA) |
| Severity alert text on severity background | 4.5:1 | Must verify per severity color |
| Placeholder text | 4.5:1 | Use `neutral-400` minimum |
| Inactive tab bar icons | 3:1 | — |
| Active tab bar icons | 4.5:1 | — |

**Verified ratios for severity colors (white text on background):**

| Severity | Background | White Text Ratio | Passes AA? |
|---|---|---|---|
| Contraindicated | `#DC2626` red-600 | 4.58:1 | AA pass |
| Major | `#EA580C` orange-600 | 3.12:1 | FAIL for small text — use `text-lg` minimum |
| Moderate | `#D97706` amber-600 | 2.89:1 | FAIL — use dark text or `text-lg font-bold` |
| Minor | `#2563EB` blue-600 | 4.82:1 | AA pass |
| Safe | `#16A34A` green-600 | 4.55:1 | AA pass |

**ACTION for Major and Moderate:** For inline badges (small text), use filled background at 20% opacity with dark text instead of full saturation with white text:
- Major badge: `bg-orange-100 text-orange-700` (ratio 6.1:1, passes AAA)
- Moderate badge: `bg-amber-100 text-amber-700` (ratio 5.8:1, passes AA)
- Full severity backgrounds (alert headers, InteractionAlert header strip) use `text-lg font-bold` minimum — large text threshold passes at these contrast ratios

### 5.3 Touch Targets

| Element | Minimum Size | Method |
|---|---|---|
| All interactive elements | 44pt x 44pt | HIG standard |
| Tab bar items | 44pt height | System default |
| List rows | 52pt height minimum | Content padding |
| Checkboxes / radio | 44pt tap area | Hit slop |
| Small action icons | 44pt hit target | `hitSlop` prop with 12pt padding |
| FAB | 56pt | As designed |
| Close buttons (X) | 44pt | Icon 20pt + padding |

### 5.4 Screen Reader Support

**VoiceOver (iOS) and TalkBack (Android) requirements:**

Every interactive element must have:
- `accessibilityRole` — `button`, `link`, `header`, `image`, `text`, `adjustable`
- `accessibilityLabel` — describes the element's purpose, not its visual appearance
- `accessibilityState` — for toggleable elements: `{ selected, checked, disabled, expanded }`
- `accessibilityHint` — optional description of what happens when activated (use for non-obvious actions)

**Focus order:**
- Follows visual reading order (top-to-bottom, left-to-right)
- Modal/BottomSheet: focus traps within modal, returns to trigger element on dismiss
- Tab bar: accessible without screen reader (standard navigation pattern)
- Lists: each list item is a single focusable unit (not individual sub-elements, unless sub-elements are interactive)

**Announcement requirements:**
- Dose confirmation: announce "Dose confirmed for [drug name]" after swipe
- Interaction detected: auto-announce severity and drug names when modal presents
- Form errors: announce error message via `accessibilityLiveRegion="assertive"` immediately
- Loading states: announce "Loading" on start and "Ready" on complete via `accessibilityLiveRegion="polite"`

### 5.5 Font Scaling

The app must not break at iOS Accessibility > Larger Text > maximum (equivalent to ~3x the default size). Requirements:

- All text: `allowFontScaling={true}` (never override to false)
- All layouts: test at 200% font scaling as minimum. Target 300% functional
- Never truncate drug names or dose amounts — these are safety-critical
- Use `flexShrink` and wrapping rather than `numberOfLines` limits on critical content
- Section headers may clip to 2 lines maximum
- List items: expand height with content — do not use fixed row heights that clip text

### 5.6 Haptic Feedback

Haptics communicate confirmation and alerts through touch — critical for users with vision impairments and for confirming actions without looking at the screen.

| Event | Haptic Type | Notes |
|---|---|---|
| Dose confirmed | `Notification.success` | Satisfying confirmation |
| Interaction alert presented | `Notification.warning` | Attention prompt |
| Contraindicated interaction | `Notification.error` | Urgent signal |
| Swipe thumb snap | `Impact.medium` | Mechanical feel |
| Destructive action confirmed | `Impact.heavy` | Weight to the action |
| Error (form validation) | `Notification.error` | Brief double-pulse |
| Settings toggle | `Impact.light` | Acknowledgment |

Haptics must respect `UIAccessibility.isReduceMotionEnabled` — if reduce motion is on, haptics should still fire (haptics are touch, not motion). Only animations respect reduce motion.

### 5.7 Reduced Motion

When `prefers-reduced-motion` / `UIAccessibility.isReduceMotionEnabled` is true:

- Swipe-to-confirm animation: instant snap, no spring physics
- Screen transitions: cross-fade only (no slides)
- Loading skeletons: static gray, no shimmer animation
- Adherence ring: static fill, no draw animation
- Dose confirmation collapse: instant remove, no fade
- Caregiver pending pulse animation: static amber dot, no pulse

### 5.8 High Contrast Mode

When iOS/Android high contrast is enabled:

- All border widths increase by 1pt
- Shadow-based elevation replaced with bordered elevation (`border border-neutral-300 dark:border-neutral-600`)
- Brand teal shifts to higher contrast variant: `teal-800` (#115E59) on light, `teal-200` (#99F6E4) on dark
- Severity colors shift to maximum contrast variants (already defined in dark mode tokens)
- Placeholder text darkens to `neutral-500`

---

## Part 6 — Interaction Patterns

### 6.1 Dose Confirmation

**Primary path — Swipe to Confirm:**
1. Card in "Due now" state presents `DoseConfirmation` component below drug info
2. User places thumb on swipe track thumb
3. Thumb drags right along track — track fills with `brand-50` as thumb moves
4. At 80%+ travel: spring snap to end (200ms ease-out), `Impact.medium` haptic
5. Track background transitions to `dose-taken` green (150ms ease-out)
6. Track label transitions from "Swipe to confirm" to "Confirmed" (white text)
7. `Notification.success` haptic fires
8. Card collapses from timeline (height: 0, opacity: 0, 300ms ease-out) — smooth removal
9. Adherence ring updates with animation

**Fallback path — Tap to Confirm:**
- Available in Settings: "Tap to confirm instead of swipe"
- Large "Confirm Taken" button replaces swipe track
- Single tap triggers same success sequence
- Default for accessibility (when VoiceOver active, swipe metaphor is disabled automatically)

**Undo:** After confirmation, a brief toast appears (3 seconds): "Metformin marked as taken. Undo?" — tap Undo reverses the confirmation. After 3 seconds, toast dismisses and action is committed.

**Skip path:**
1. Tap "Skip" secondary button
2. BottomSheet opens with reason selector:
   - "I couldn't take it today"
   - "I already took it earlier" → shows time input
   - "Temporarily pausing this medication"
   - "Something else"
3. Reason logged, card collapses with same animation as taken (but gray, not green)
4. Caregiver receives notification of skip (not miss) — different severity

### 6.2 Adding a Medication

**Scan path:**
1. Tap FAB → BottomSheet opens with two options: "Scan Bottle" / "Add Manually"
2. User selects "Scan Bottle" → camera opens (AVFoundation / Expo Camera)
3. Guide overlay: rounded-rect frame with corner marks indicating bottle label zone
4. OCR processes in real-time — when label detected, green highlight appears
5. Tap capture button → loading state (300ms) → form pre-filled with parsed data
6. User reviews / corrects parsed fields → continues to reminder setup
7. Interaction check fires when drug name is confirmed — if conflict: InteractionAlert presents

**Manual path:**
1. FAB → "Add Manually" → full-screen Add Medication screen
2. Drug name field with live autocomplete from RxNorm SQLite
3. Autocomplete suggestion selected → dose field pre-populated with common dose range
4. User completes form → Save

**Error path (OCR failure):**
- If OCR cannot parse label after 3 attempts: "We couldn't read that label."
- Offer: "Try again with better lighting" or "Type the name manually"
- Manual mode pre-fills nothing — blank form
- Never block the user — OCR is a feature, not a requirement

### 6.3 Interaction Alert

**Trigger:** Fired when a drug name is confirmed in the Add Medication flow that has a known interaction with any currently Active medication in the user's list.

**Presentation:**
1. Alert always presents as full BottomSheet modal (90% height)
2. `Notification.warning` haptic on present (major) / `Notification.error` (contraindicated)
3. User must actively dismiss — no auto-dismiss
4. All dismissals logged: "Reviewed [severity] interaction between [Drug A] and [Drug B] at [timestamp]"

**Contraindicated flow:** No "Add Anyway" button. User can only dismiss and not add, or call their doctor. The app does not add a contraindicated medication in v1. This is a product safety decision.

**Post-dismiss:** Returns to form. For contraindicated: medication name is cleared and field focused. For major/moderate: form proceeds with visual flag shown on the medication name field.

### 6.4 Caregiver Linking

**Patient-initiated (invite):**
1. Settings → Caregivers → "Invite a Caregiver"
2. Form: caregiver name + phone or email
3. Permission disclosure shown before sending (what caregiver can/cannot see)
4. Send → push notification to recipient + SMS/email fallback
5. Recipient taps link → downloads SafeDose OR opens app → accept screen
6. Accept screen: shows patient name, photo (if set), permission list, Accept / Decline
7. On Accept: caregiver linked — patient receives confirmation notification

**QR code path (in-person):**
1. Patient: Settings → Caregivers → "Show QR Code"
2. Full-screen QR code with invite token (expires 24h)
3. Caregiver: opens SafeDose → "Scan Caregiver QR" → camera → link

### 6.5 Emergency Card Access

**Goal:** Accessible with minimum friction, including without unlocking device.

**Access paths (priority order):**
1. iOS Lock Screen Widget → "SafeDose Emergency" widget → taps to full-screen card
2. In-app: "More" tab → "Emergency Card" (always top of list)
3. In-app: patient profile screen → "Emergency Card" button
4. iOS Shortcuts: user can create a "SafeDose Emergency Card" shortcut on home screen

**Lock screen access (post-MVP v2):** Requires `HealthKit` integration or Shortcut with no auth required — design should assume this path exists and the Emergency Card must work completely offline with zero auth challenge.

---

## Part 7 — Implementation Notes for Prism

### Technology Mapping

| Design Element | Implementation |
|---|---|
| Design tokens | NativeWind `tailwind.config.js` custom theme |
| Typography | System fonts via React Native default — no custom font loading |
| Icons | `lucide-react-native` package |
| Bottom sheet | `@gorhom/bottom-sheet` — battle-tested, smooth, accessible |
| Haptics | `expo-haptics` |
| Swipe to confirm | `react-native-gesture-handler` `PanGestureHandler` |
| Skeleton loading | `react-native-skeleton-placeholder` or custom `Animated.Value` shimmer |
| Date/time pickers | `@react-native-community/datetimepicker` (native, accessible) |
| Animations | `react-native-reanimated` v3 (Reanimated 3 — works with Expo) |
| QR code generation | `react-native-qrcode-svg` |
| Camera / OCR | `expo-camera` + on-device ML Kit (Vision via `react-native-vision-camera`) |
| Reduced motion check | `useReducedMotion()` hook from Reanimated 3 |

### Component Priority Order

Build in this order — each depends on the previous:

1. **Design tokens** (`tailwind.config.js`) — everything else depends on tokens
2. **Typography system** (`Text` wrapper component with scale) — base of all UI
3. **Button** — used everywhere
4. **Input** + **InputLabel** — needed for all forms
5. **StatusBadge** — needed on MedCard
6. **MedCard** — primary list item, high visibility
7. **BottomSheet** wrapper — needed for add/edit flows
8. **DoseConfirmation** — core daily-use interaction
9. **InteractionAlert** — safety-critical, high priority
10. **CaregiverBadge** — caregiver flow
11. **EmergencyCard** — standalone screen, self-contained

### NativeWind Notes

- NativeWind v4 is required (supports RN 0.72+, Expo SDK 50+)
- Dark mode: use NativeWind's `dark:` variant with `colorScheme` from `useColorScheme()`
- Platform-specific: use `Platform.OS` guard for iOS/Android shadow differences (NativeWind does not auto-resolve shadow differences cross-platform)
- Font size: NativeWind maps px to pt correctly on mobile — `text-base` = 17pt as specified
- Spacing: NativeWind spacing scale matches our 4pt grid exactly

### Safe Area

All screens must use `SafeAreaView` from `react-native-safe-area-context`. Tab bar sits inside safe area. FAB respects home indicator inset. Emergency Card uses `StatusBar` hidden for maximum screen real estate.

### Dark Mode

SafeDose ships with full dark mode support. All dark mode tokens are defined in the palette above. Implementation notes:

- Use `useColorScheme()` hook — follow system setting
- Settings option in v2: "Light / Dark / System" override
- Emergency Card: always light mode regardless of system setting
- Drug interaction severity colors: use dark-mode variants (lighter, higher contrast on dark backgrounds)
- Never invert colors — dark mode palette is designed separately

---

## Appendix A — Competitor Analysis Notes

| App | Strength | Weakness |
|---|---|---|
| Medisafe | Large user base, reminders | Ad-heavy, sells data, outdated UI |
| Drugs.com | Comprehensive drug database | No caregiver coordination, web-first UX |
| CareZone | Caregiver angle | Limited interaction checking, sunset-risk |
| MyTherapy | Good tracking UX | No caregiver visibility |
| Apple Health | Ecosystem integration | No interaction checking, no caregiver linking |

**SafeDose differentiator:** The only app combining on-device interaction checking + real-time caregiver visibility + emergency card + privacy-first architecture. The design should make these differentiators viscerally felt, not just listed in marketing copy. The absence of ads, the calm color palette, the "everything stays on your device" language in onboarding — these are design decisions, not just features.

---

## Appendix B — Design Decisions Log

| Decision | Rationale |
|---|---|
| Teal-500 as primary brand color | Trustworthy, health-associated, calming. Distinct from "medical red" and "pharma blue". Not overused in health apps. |
| Red reserved for contraindicated only | Prevents alarm fatigue. If red appears, users know it is the highest severity. |
| Swipe-to-confirm for doses | Prevents accidental confirmation. Deliberate gesture = deliberate action. Safety-critical app requires friction at the right moments. |
| System fonts, no custom font | Performance on older devices. Respects system accessibility settings. Zero font loading delay. |
| No gamification (streaks, badges) | Health management is a responsibility, not a game. Gamification creates anxiety when the streak breaks. |
| Always-light Emergency Card | First responders need maximum legibility in varied lighting. Dark mode aesthetics serve users, not medical professionals scanning a phone in an ER. |
| No "Add Anyway" for contraindicated | Product safety decision. The app cannot ethically facilitate adding a drug the patient should never combine. Log the review, surface the information, but do not enable the dangerous action. |
| Minimum text-base at 17pt | Apple HIG recommended. Elderly user cohort. Health information should never require squinting. |
| 4pt spacing grid | Consistency and cognitive simplicity. All spacing is predictable. No "why is this 13px?" questions. |
| Haiku stacking | Multiple parallel Haiku beats one Sonnet for mechanical batch work. (Per CLAUDE.md token rules.) |

---

*Design system version 1.0. Authored by Spark — Creative Director, VRAXON Digital. Ready for Prism implementation. Questions on implementation detail: review Section 7 first, then message Spark.*

*Output file: `/docs/design-system.md`*
