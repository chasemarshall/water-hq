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

/** Fun leaderboard stats */
export function computeLeaderboard(log: LogMap): {
  mostShowers: { user: string; count: number };
  longestAvg: { user: string; minutes: number };
  earlyBird: { user: string; avgHour: number };
  nightOwl: { user: string; avgHour: number };
} {
  const counts: Record<string, number> = {};
  const durations: Record<string, { sum: number; count: number }> = {};
  const hours: Record<string, { sum: number; count: number }> = {};

  for (const entry of Object.values(log)) {
    const u = entry.user;
    counts[u] = (counts[u] || 0) + 1;
    if (!durations[u]) durations[u] = { sum: 0, count: 0 };
    durations[u].sum += entry.durationSeconds;
    durations[u].count += 1;
    if (!hours[u]) hours[u] = { sum: 0, count: 0 };
    const d = new Date(entry.startedAt);
    hours[u].sum += d.getHours() + d.getMinutes() / 60;
    hours[u].count += 1;
  }

  const users = Object.keys(counts);
  const mostShowers = users.reduce((best, u) => counts[u] > counts[best] ? u : best, users[0]);
  const longestAvg = users.reduce((best, u) => {
    const avg = durations[u].sum / durations[u].count;
    const bestAvg = durations[best].sum / durations[best].count;
    return avg > bestAvg ? u : best;
  }, users[0]);
  const earlyBird = users.reduce((best, u) => {
    const avg = hours[u].sum / hours[u].count;
    const bestAvg = hours[best].sum / hours[best].count;
    return avg < bestAvg ? u : best;
  }, users[0]);
  const nightOwl = users.reduce((best, u) => {
    const avg = hours[u].sum / hours[u].count;
    const bestAvg = hours[best].sum / hours[best].count;
    return avg > bestAvg ? u : best;
  }, users[0]);

  return {
    mostShowers: { user: mostShowers, count: counts[mostShowers] },
    longestAvg: { user: longestAvg, minutes: Math.round(durations[longestAvg].sum / durations[longestAvg].count / 60) },
    earlyBird: { user: earlyBird, avgHour: Math.round((hours[earlyBird].sum / hours[earlyBird].count) * 10) / 10 },
    nightOwl: { user: nightOwl, avgHour: Math.round((hours[nightOwl].sum / hours[nightOwl].count) * 10) / 10 },
  };
}
