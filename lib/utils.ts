import { USER_COLORS } from "./constants";
import type { Slot, LogEntry, LogMap } from "./types";

export function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatTimeRange(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const start = new Date();
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return `${formatTime(start)} \u2013 ${formatTime(end)}`;
}

export function formatElapsed(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function userColor(name: string): string {
  return USER_COLORS[name] || "bg-white";
}

export function formatLogTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min === 0) return `${sec}s`;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

export function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function getSlotStartTimestamp(slot: Slot): number {
  const [year, month, day] = slot.date.split("-").map(Number);
  const [hours, minutes] = slot.startTime.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

/**
 * Returns true if a slot applies to today — either it's a non-recurring slot
 * scheduled for today, or it's a recurring slot (which applies every day).
 */
export function isSlotForToday(slot: Slot): boolean {
  return slot.recurring === true || slot.date === getToday();
}

/**
 * Like getSlotStartTimestamp but uses today's date for recurring slots,
 * so timing calculations (notifications, auto-log) work correctly each day.
 */
export function getEffectiveSlotStartTimestamp(slot: Slot): number {
  const date = slot.recurring ? getToday() : slot.date;
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = slot.startTime.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

export function getSlotAlertKey(slotId: string, alertType: "owner-ten" | "owner-start" | "others-ten" | "others-start"): string {
  return `${slotId}:${alertType}`;
}

/** Return the most recent shower within the last 30 minutes, by maximum endedAt. */
export function getRecentShower(log: LogMap | null): LogEntry | null {
  if (!log) return null;
  const cutoff = Date.now() - 30 * 60 * 1000;
  let latest: LogEntry | null = null;
  for (const entry of Object.values(log)) {
    if (entry.endedAt > cutoff && (!latest || entry.endedAt > latest.endedAt)) {
      latest = entry;
    }
  }
  return latest;
}
