# Shower Timer Website — Design Document

## Problem

Two showers share a single hot water heater that can only handle one shower at a time. 3-4 household members need to coordinate shower usage to avoid cold water surprises.

## Solution

A mobile-first web app with real-time status updates and time slot claiming.

## Tech Stack

- **Frontend:** Single-page HTML/CSS/JS (no framework)
- **Backend:** Firebase Realtime Database (free tier)
- **Hosting:** Vercel
- **Auth:** Name selection from preset list, stored in localStorage (trusted household, no passwords)

## Database Structure

```
/status
  currentUser: "Chase" | null
  startedAt: timestamp | null

/slots/{slotId}
  user: "Chase"
  date: "2026-02-16"
  startTime: "07:00"
  durationMinutes: 15

/users
  - "Chase"
  - "Mom"
  - "Dad"
  - "Sibling"
```

Users list is configurable.

## UI (Mobile-First)

### Main Screen

1. **Status Banner** (top) — large, unmissable indicator
   - Green: "SHOWER FREE"
   - Red: "OCCUPIED — [Name] is showering" with running timer

2. **Start/Done Button** — toggles shower status for the current user

3. **Today's Time Slots** — timeline view showing:
   - Claimed slots with name and time range
   - "Claim a Slot" button (pick start time + duration: 5/10/15/20/30 min)

4. **User Identity** — corner indicator showing current user name with switch option

## Rules

- **No overlapping slots** — can't claim a time that conflicts with an existing slot
- **Auto-release** — shower auto-releases after 30 minutes if user forgets to tap "Done"
- **Slot expiration** — past slots disappear; slots reset daily
- **No shower limit** — unlimited showers, just not simultaneous
- **Conflict warning** — "Start Shower" warns if someone has a slot starting soon

## Real-Time Sync

Firebase Realtime Database listeners push updates instantly to all connected phones. No polling, no manual refresh needed.

## Non-Goals

- Push notifications (check your phone instead)
- Login/password authentication
- Shower history or analytics
- Multiple hot water heater support
