import type { LogMap } from "./types";

/** Count of showers per hour (0-23) per user */
export function computePeakHours(log: LogMap): Record<string, Record<number, number>> {
  const result: Record<string, Record<number, number>> = {};
  for (const entry of Object.values(log)) {
    const hour = new Date(entry.startedAt).getHours();
    if (!result[entry.user]) result[entry.user] = {};
    result[entry.user][hour] = (result[entry.user][hour] || 0) + 1;
  }
  return result;
}

/** Average shower duration in minutes per user */
export function computeAvgDuration(log: LogMap): Record<string, number> {
  const totals: Record<string, { sum: number; count: number }> = {};
  for (const entry of Object.values(log)) {
    if (!totals[entry.user]) totals[entry.user] = { sum: 0, count: 0 };
    totals[entry.user].sum += entry.durationSeconds;
    totals[entry.user].count += 1;
  }
  const result: Record<string, number> = {};
  for (const [user, { sum, count }] of Object.entries(totals)) {
    result[user] = Math.round(sum / count / 60);
  }
  return result;
}

/** Shower count per day of week (0=Sun...6=Sat) per user */
export function computeDayOfWeekFrequency(log: LogMap): Record<string, Record<number, number>> {
  const result: Record<string, Record<number, number>> = {};
  for (const entry of Object.values(log)) {
    const day = new Date(entry.startedAt).getDay();
    if (!result[entry.user]) result[entry.user] = {};
    result[entry.user][day] = (result[entry.user][day] || 0) + 1;
  }
  return result;
}

/** Current consecutive-day shower streak per user */
export function computeStreaks(log: LogMap): Record<string, number> {
  const showerDays: Record<string, Set<string>> = {};
  for (const entry of Object.values(log)) {
    if (!showerDays[entry.user]) showerDays[entry.user] = new Set();
    const d = new Date(entry.startedAt);
    showerDays[entry.user].add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }

  const result: Record<string, number> = {};
  for (const [user, days] of Object.entries(showerDays)) {
    let streak = 0;
    const d = new Date();
    // Start from today, walk backwards
    while (true) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (days.has(key)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    result[user] = streak;
  }
  return result;
}

/** Total shower count per user */
export function computeShowerCounts(log: LogMap): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of Object.values(log)) {
    counts[entry.user] = (counts[entry.user] || 0) + 1;
  }
  return counts;
}

/** Longest single shower across all users */
export function computeLongestShower(log: LogMap): { user: string; durationMinutes: number } | null {
  if (Object.keys(log).length === 0) return null;
  let best: { user: string; durationSeconds: number } | null = null;
  for (const entry of Object.values(log)) {
    if (!best || entry.durationSeconds > best.durationSeconds) {
      best = { user: entry.user, durationSeconds: entry.durationSeconds };
    }
  }
  return best ? { user: best.user, durationMinutes: Math.round(best.durationSeconds / 60) } : null;
}

/** User with lowest standard deviation in shower duration (min 3 showers) */
export function computeConsistency(log: LogMap): { user: string; deviationMinutes: number } | null {
  const durations: Record<string, number[]> = {};
  for (const entry of Object.values(log)) {
    if (!durations[entry.user]) durations[entry.user] = [];
    durations[entry.user].push(entry.durationSeconds);
  }

  let best: { user: string; stdDev: number } | null = null;
  for (const [user, times] of Object.entries(durations)) {
    if (times.length < 3) continue;
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / times.length;
    const stdDev = Math.sqrt(variance);
    if (!best || stdDev < best.stdDev) {
      best = { user, stdDev };
    }
  }
  return best ? { user: best.user, deviationMinutes: Math.round(best.stdDev / 60) } : null;
}

/** Estimated total water usage in gallons (2 gal/min) */
export function computeWaterUsage(log: LogMap): number {
  let totalSeconds = 0;
  for (const entry of Object.values(log)) {
    totalSeconds += entry.durationSeconds;
  }
  return Math.round(totalSeconds / 60 * 2);
}
