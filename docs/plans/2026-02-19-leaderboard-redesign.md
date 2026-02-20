# Leaderboard Redesign

## Problem

The current leaderboard (Most Showers, Longest Avg, Earliest, Latest) feels inaccurate and uninteresting. Early bird / night owl stats are misleading when times are close together, and averages flatten out the data.

## Design

### Timeframe

Rolling 30 days — matches the existing analytics window.

### Position

Move leaderboard to the top of the analytics section (first thing when expanded), above Avg Duration / Peak Hours / Day of Week.

### Layout

2x2 grid of competitive award cards + 1 full-width family card below.

### Stats

| # | Name | Calculation | Display |
|---|------|-------------|---------|
| 1 | Streak King | Longest current consecutive-day streak per user (based on `startedAt` date) | "Chase: 12 days" |
| 2 | Most Showers | Total shower count per user in 30d window | "Mom: 28" |
| 3 | Marathon Shower | Single longest shower in 30d (max `durationSeconds`) | "A.J.: 42 min" |
| 4 | Most Consistent | Lowest standard deviation in shower duration per user (min 3 showers to qualify) | "Dad: ±2 min" |
| 5 | Water Used | Family total estimated gallons: sum of all `durationSeconds` × (2 gal / 60 sec) | "Family: 840 gal" |

### Implementation

**`lib/analytics.ts`** — Add new functions, remove `computeLeaderboard`:

- `computeStreaks(log: LogMap)` — returns `Record<string, number>` (current streak per user). Walk backwards from today checking for showers on each consecutive day using `startedAt`.
- `computeLongestShower(log: LogMap)` — returns `{ user: string; durationMinutes: number }`. Find max `durationSeconds` entry.
- `computeConsistency(log: LogMap)` — returns `{ user: string; deviationMinutes: number } | null`. Compute std deviation of `durationSeconds` per user, return user with lowest. Require minimum 3 showers to qualify.
- `computeWaterUsage(log: LogMap)` — returns `number` (total gallons). Sum all `durationSeconds`, multiply by 2/60.

**`app/components/ShowerAnalytics.tsx`**:

- Replace `computeLeaderboard` import with new functions
- Move leaderboard section to first position (delay: 0.1)
- Shift other sections' delays down accordingly
- 2x2 grid: Streak King, Most Showers, Marathon Shower, Most Consistent
- Full-width card below: Water Used with larger number treatment

**`tests/analytics.test.ts`** — Replace leaderboard tests with tests for the 4 new functions.

### No changes needed

- `lib/types.ts` — `LogEntry` already has `startedAt`, `durationSeconds`, `user`
- Firebase data model — no new paths
- Design system — same `brutal-card-sm bg-surface rounded-xl` cards
