# Water HQ

A family shower coordination PWA built with Next.js, Firebase Realtime Database, and Framer Motion. Deployed on Vercel.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Database**: Firebase Realtime Database (client-side listeners, no REST)
- **Auth**: Firebase Auth (Google + email/password) with email whitelist
- **Styling**: Tailwind CSS 3.4 with custom design tokens
- **Animations**: Framer Motion (springs, AnimatePresence, layout animations)
- **Push Notifications**: Web Push (VAPID) via service worker (`public/sw.js`)
- **Bot Protection**: Cloudflare Turnstile on login
- **Analytics**: Vercel Analytics
- **Hosting**: Vercel

## Project Structure

```
app/
├── page.tsx                    # Main Home component (state management, Firebase listeners, composition)
├── layout.tsx                  # Root layout (fonts, metadata, Vercel Analytics)
├── globals.css                 # Global styles, CSS animations, neobrutalist base classes
├── manifest.ts                 # PWA manifest
├── icon.tsx / apple-icon.tsx   # Generated favicons
├── components/
│   ├── LoginScreen.tsx         # Turnstile verification + Google/email sign-in
│   ├── UserSelectScreen.tsx    # Family member picker (post-auth)
│   ├── StatusBanner.tsx        # Shows current shower status, timer, recent/reserved info
│   ├── ShowerButton.tsx        # Start/stop shower, +5m extend for active slots
│   ├── ShowerLog.tsx           # Last 24h shower history
│   ├── TimeSlots.tsx           # Upcoming booked slots grouped by date
│   ├── ClaimModal.tsx          # Bottom-sheet modal to book a new slot
│   └── TickerBar.tsx           # Decorative scrolling marquee
├── api/
│   ├── push-notify/route.ts    # POST: send push notifications to users
│   ├── push-subscribe/route.ts # POST: store push subscription in Firebase
│   └── verify-turnstile/route.ts # POST: verify Turnstile token
lib/
├── types.ts                    # Shared TypeScript interfaces (ShowerStatus, Slot, LogEntry, etc.)
├── constants.ts                # App constants (USERS, USER_COLORS, DURATIONS, timing values)
├── utils.ts                    # Pure formatting/helper functions (formatTime, getToday, userColor, etc.)
├── storage.ts                  # localStorage persistence for selected user
├── notifications.ts            # Push subscription and notification sending
├── firebase.ts                 # Client-side Firebase app/db/auth initialization
├── firebaseAdmin.ts            # Server-side Firebase Admin SDK initialization
├── useAuth.ts                  # Auth hook (Google/email sign-in, whitelist check, grace period)
public/
└── sw.js                       # Service worker for push notifications
```

## Design System — Neobrutalist Style

The app uses a **neobrutalist** design aesthetic. All new UI must follow these conventions:

### Color Palette (defined in `tailwind.config.ts` and `globals.css`)

| Token        | Hex       | Usage                                      |
|--------------|-----------|---------------------------------------------|
| `paper`      | `#F5F0E8` | Page background                             |
| `ink`        | `#1a1a1a` | Text, borders, shadows                      |
| `lime`       | `#BAFF39` | Primary action (start shower, confirm, active selection) |
| `coral`      | `#FF5C5C` | Danger/occupied state (stop, sign out, errors) |
| `sky`        | `#67E8F9` | Chase's color, recent-shower state          |
| `yolk`       | `#FFD166` | A.J.'s color, reserved slots, notifications |
| `mint`       | `#06D6A0` | Mom's color                                 |
| `bubblegum`  | `#EF476F` | Dad's color                                 |

Each family member has a mapped color in `lib/constants.ts` → `USER_COLORS`.

### Typography

- **Display font**: `font-display` — Archivo Black. Used for headings, button labels, user names. Always `uppercase`.
- **Mono font**: `font-mono` — Space Mono. Used for timestamps, counters, labels, small tags. Often with `font-bold uppercase tracking-widest`.

### Core CSS Classes (defined in `globals.css`)

| Class            | Description                                                |
|------------------|------------------------------------------------------------|
| `brutal-btn`     | Button with 3px ink border, 5px ink box-shadow, hover lift, active press, disabled state |
| `brutal-card`    | Card with 3px ink border, 5px ink box-shadow              |
| `brutal-card-sm` | Smaller card with 2px border, 3px shadow                  |
| `brutal-input`   | Input with 3px ink border, focus shadow                   |
| `pulse-occupied` | Pulsing glow animation for the occupied status banner     |
| `timer-tick`     | Subtle scale pulse for the shower timer digits            |
| `marquee`        | Infinite horizontal scroll animation for the ticker       |
| `modal-backdrop` | Transparent backdrop for modals                           |

### Component Patterns

- **Buttons**: Always use `brutal-btn` + a background color class + `rounded-xl` + `font-display uppercase`
- **Cards/containers**: Use `brutal-card` or `brutal-card-sm` + background color + `rounded-xl` or `rounded-2xl`
- **Inputs**: Use `brutal-input` + `rounded-xl`
- **Labels/tags**: `font-mono text-xs font-bold uppercase tracking-wider`
- **Section headers**: `font-display text-xl uppercase` with a `brutal-card-sm bg-white` counter badge
- **Empty states**: Centered text with `font-mono text-sm text-gray-500 uppercase tracking-wider` + large emoji below
- **Error toasts**: `brutal-card-sm bg-coral text-white rounded-xl` with dismiss button

### Animation Patterns (Framer Motion)

- **Page transitions**: `AnimatePresence mode="wait"` with spring-based x/opacity
- **Staggered entrances**: Sequential `delay` values (0.1, 0.2, 0.3...) on `motion.div` wrappers
- **Buttons**: `whileTap={{ scale: 0.97 }}` for press feedback
- **List items**: `initial={{ opacity: 0, x: -20 }}` with staggered delays, `layout` prop for reflows
- **Modals**: Slide up from bottom with `type: "spring", stiffness: 300, damping: 30`
- **Cards**: `initial={{ y: 20, opacity: 0 }}` → `animate={{ y: 0, opacity: 1 }}`

### Noise Texture

The body has a `::before` pseudo-element with an SVG fractalNoise filter at 3% opacity for a paper-like texture. This is global and should not be overridden.

## Architecture Notes

### State Management

All app state lives in the `Home` component (`app/page.tsx`). Firebase Realtime Database provides live data via `onValue` listeners. There is no global state library — props are passed down to components.

### Firebase Data Model

- `status` — Single object: `{ currentUser: string | null, startedAt: number | null }`
- `slots` — Map of slot objects keyed by push ID
- `log` — Map of shower log entries keyed by push ID
- `allowedEmails` — Array of whitelisted email addresses
- `graceUntil` — Timestamp for open registration grace period
- `pushSubscriptions` — Map of push notification subscriptions keyed by user

### Push Notifications

- Client subscribes via `lib/notifications.ts` → calls `/api/push-subscribe`
- Notifications sent via `/api/push-notify` using `web-push` library
- Slot notifications are managed in `page.tsx` with deduplication via `sentSlotNotificationsRef`

### Auth Flow

1. Turnstile verification (bot check)
2. Google or email sign-in via Firebase Auth
3. Email checked against `allowedEmails` in Firebase DB (with grace period bypass)
4. Post-auth: user selects their family member name (persisted in localStorage)

## Build & Dev

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run start      # Start production server
npm run test       # Run all tests once
npm run test:watch # Run tests in watch mode
```

Environment variables are in `.env.local` (Firebase config, VAPID keys, Turnstile secret).

## Testing

Tests use **Vitest** with `jsdom` environment and React Testing Library. Config is in `vitest.config.ts`.

```
tests/
├── setup.ts               # Global setup: mocks Firebase, firebase/database
├── utils.test.ts           # Tests for all formatting/helper functions
├── storage.test.ts         # Tests for localStorage persistence + error handling
├── constants.test.ts       # Tests for app constants integrity
└── notifications.test.ts   # Tests for push notification API calls + error handling
```

Firebase is globally mocked in `tests/setup.ts` so tests run without any backend. When adding new tests, follow the existing pattern — mock external dependencies, test pure logic directly.

## Development Workflow (Feature Branch → Preview → Production)

The user works exclusively through Claude Code and does not write code directly.

### Linear Integration

Issues are tracked in Linear under the **Water HQ** project (team: Chase frazier).

- **Issue IDs** follow the format `CHA-N` (e.g., `CHA-5`)
- **Reference issues in commits** — include the identifier in the commit message body (e.g., `Fixes CHA-5`). Linear automatically links the commit to the issue.
- **Issue lifecycle**:
  1. If no issue exists for the work, create one in Linear before starting
  2. Set the issue to **In Progress** when work begins
  3. Mark it **Done** after the changes are pushed to `main`
- **When the user says "complete the issue"** — commit with the issue reference, push, then mark Done in Linear
- Firebase project IDs (`shower-tracker-276d6`) are backend infrastructure — do not rename them even when renaming the app

### Flow

1. **Start**: Create a Linear issue if one doesn't exist, then create a feature branch off `main` (e.g., `feature/dark-mode`)
2. **Iterate**: Make changes, commit (referencing the Linear issue ID), and push to the branch. Each push triggers a **Vercel preview deployment**.
3. **Ship**: When the user says "ship it" / "merge it" / "send to prod":
   - Merge the feature branch into `main`
   - Push `main` (triggers **Vercel production deployment**)
   - Mark the Linear issue as **Done**
   - Delete the feature branch (local + remote)
4. **Abort**: If the user says "scrap it" / "nah" — delete the branch, checkout `main`, cancel the Linear issue.

### Preview Safety

- Push notifications are **disabled on preview deployments** — the `/api/push-notify` route checks `VERCEL_ENV` and skips sending when not `production`.
- **Firebase data is isolated by environment** — all app data paths (`status`, `slots`, `log`, `pushSubscriptions`) are prefixed with `preview/` on non-production deployments. Auth paths (`allowedEmails`, `graceUntil`) remain shared.
  - Client-side: `dbRef(path)` from `lib/firebase.ts` (uses `NEXT_PUBLIC_VERCEL_ENV`)
  - Server-side: `adminPath(path)` from `lib/firebaseAdmin.ts` (uses `VERCEL_ENV`)
  - **Always use `dbRef()` for new client-side Firebase refs** (not `ref(db, ...)`), except for auth-related paths in `useAuth.ts`.
