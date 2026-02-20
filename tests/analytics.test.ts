import { describe, it, expect } from "vitest";
import {
  computePeakHours,
  computeAvgDuration,
  computeDayOfWeekFrequency,
  computeStreaks,
  computeShowerCounts,
  computeLongestShower,
  computeConsistency,
  computeWaterUsage,
} from "@/lib/analytics";
import type { LogMap } from "@/lib/types";

const mockLog: LogMap = {
  a: { user: "Chase", startedAt: new Date("2026-02-16T07:30:00").getTime(), endedAt: new Date("2026-02-16T07:45:00").getTime(), durationSeconds: 900 },
  b: { user: "Chase", startedAt: new Date("2026-02-17T07:15:00").getTime(), endedAt: new Date("2026-02-17T07:30:00").getTime(), durationSeconds: 900 },
  c: { user: "Mom", startedAt: new Date("2026-02-16T20:00:00").getTime(), endedAt: new Date("2026-02-16T20:20:00").getTime(), durationSeconds: 1200 },
  d: { user: "A.J.", startedAt: new Date("2026-02-17T16:00:00").getTime(), endedAt: new Date("2026-02-17T16:10:00").getTime(), durationSeconds: 600 },
  e: { user: "Mom", startedAt: new Date("2026-02-17T19:45:00").getTime(), endedAt: new Date("2026-02-17T20:05:00").getTime(), durationSeconds: 1200 },
};

describe("computePeakHours", () => {
  it("returns hour counts per user", () => {
    const result = computePeakHours(mockLog);
    expect(result["Chase"][7]).toBe(2);
    expect(result["Mom"][20]).toBe(1);
    expect(result["Mom"][19]).toBe(1);
  });
});

describe("computeAvgDuration", () => {
  it("returns average duration in minutes per user", () => {
    const result = computeAvgDuration(mockLog);
    expect(result["Chase"]).toBe(15);
    expect(result["Mom"]).toBe(20);
    expect(result["A.J."]).toBe(10);
  });
});

describe("computeDayOfWeekFrequency", () => {
  it("returns count per user per day of week (0=Sun...6=Sat)", () => {
    const result = computeDayOfWeekFrequency(mockLog);
    // Feb 16, 2026 is Monday (1), Feb 17 is Tuesday (2)
    expect(result["Chase"][1]).toBe(1);
    expect(result["Chase"][2]).toBe(1);
    expect(result["Mom"][1]).toBe(1);
    expect(result["Mom"][2]).toBe(1);
  });
});

describe("computeShowerCounts", () => {
  it("returns total shower count per user", () => {
    const result = computeShowerCounts(mockLog);
    expect(result["Chase"]).toBe(2);
    expect(result["Mom"]).toBe(2);
    expect(result["A.J."]).toBe(1);
  });

  it("handles empty log", () => {
    expect(computeShowerCounts({})).toEqual({});
  });
});

describe("computeStreaks", () => {
  it("returns 0 for users with no showers today", () => {
    // mockLog has showers on Feb 16-17, not today
    const result = computeStreaks(mockLog);
    expect(result["Chase"]).toBe(0);
    expect(result["Mom"]).toBe(0);
  });

  it("counts consecutive days backwards from today", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const log: LogMap = {
      a: { user: "Chase", startedAt: today.getTime(), endedAt: today.getTime() + 600000, durationSeconds: 600 },
      b: { user: "Chase", startedAt: yesterday.getTime(), endedAt: yesterday.getTime() + 600000, durationSeconds: 600 },
    };
    const result = computeStreaks(log);
    expect(result["Chase"]).toBe(2);
  });

  it("handles empty log", () => {
    expect(computeStreaks({})).toEqual({});
  });
});

describe("computeLongestShower", () => {
  it("returns the longest single shower", () => {
    const result = computeLongestShower(mockLog);
    expect(result).not.toBeNull();
    expect(result!.user).toBe("Mom");
    expect(result!.durationMinutes).toBe(20);
  });

  it("returns null for empty log", () => {
    expect(computeLongestShower({})).toBeNull();
  });
});

describe("computeConsistency", () => {
  it("returns user with lowest duration variance (min 3 showers)", () => {
    const log: LogMap = {
      a: { user: "Chase", startedAt: 1000, endedAt: 2000, durationSeconds: 600 },
      b: { user: "Chase", startedAt: 2000, endedAt: 3000, durationSeconds: 610 },
      c: { user: "Chase", startedAt: 3000, endedAt: 4000, durationSeconds: 605 },
      d: { user: "Mom", startedAt: 1000, endedAt: 2000, durationSeconds: 300 },
      e: { user: "Mom", startedAt: 2000, endedAt: 3000, durationSeconds: 900 },
      f: { user: "Mom", startedAt: 3000, endedAt: 4000, durationSeconds: 1500 },
    };
    const result = computeConsistency(log);
    expect(result).not.toBeNull();
    expect(result!.user).toBe("Chase"); // Chase's times are very close together
  });

  it("returns null when no user has 3+ showers", () => {
    expect(computeConsistency(mockLog)).toBeNull(); // Chase has 2, Mom has 2, A.J. has 1
  });

  it("returns null for empty log", () => {
    expect(computeConsistency({})).toBeNull();
  });
});

describe("computeWaterUsage", () => {
  it("estimates total gallons at 2 gal/min", () => {
    // mockLog total: 900+900+1200+600+1200 = 4800 seconds = 80 minutes = 160 gallons
    const result = computeWaterUsage(mockLog);
    expect(result).toBe(160);
  });

  it("returns 0 for empty log", () => {
    expect(computeWaterUsage({})).toBe(0);
  });
});
