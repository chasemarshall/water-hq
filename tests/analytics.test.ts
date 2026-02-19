import { describe, it, expect } from "vitest";
import {
  computePeakHours,
  computeAvgDuration,
  computeDayOfWeekFrequency,
  computeLeaderboard,
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

describe("computeLeaderboard", () => {
  it("returns leaderboard stats", () => {
    const result = computeLeaderboard(mockLog);
    expect(result.mostShowers.user).toBe("Chase");
    expect(result.mostShowers.count).toBe(2);
    expect(result.longestAvg.user).toBe("Mom");
    expect(result.earlyBird.user).toBe("Chase");
    expect(result.nightOwl.user).toBe("Mom");
  });

  it("treats late night and early morning as night owl", () => {
    const lateNightLog: LogMap = {
      a: { user: "A.J.", startedAt: new Date("2026-02-17T02:00:00").getTime(), endedAt: new Date("2026-02-17T02:15:00").getTime(), durationSeconds: 900 },
      b: { user: "Chase", startedAt: new Date("2026-02-17T06:30:00").getTime(), endedAt: new Date("2026-02-17T06:45:00").getTime(), durationSeconds: 900 },
    };
    const result = computeLeaderboard(lateNightLog);
    expect(result.earlyBird.user).toBe("Chase"); // 6:30am is early bird
    expect(result.nightOwl.user).toBe("A.J.");   // 2am is night owl, not early bird
  });

  it("treats 11pm as night owl, not early bird", () => {
    const eveningLog: LogMap = {
      a: { user: "Dad", startedAt: new Date("2026-02-17T23:00:00").getTime(), endedAt: new Date("2026-02-17T23:15:00").getTime(), durationSeconds: 900 },
      b: { user: "Chase", startedAt: new Date("2026-02-17T07:00:00").getTime(), endedAt: new Date("2026-02-17T07:15:00").getTime(), durationSeconds: 900 },
    };
    const result = computeLeaderboard(eveningLog);
    expect(result.earlyBird.user).toBe("Chase"); // 7am is early bird
    expect(result.nightOwl.user).toBe("Dad");    // 11pm is night owl
  });

  it("handles empty log without crashing", () => {
    const result = computeLeaderboard({});
    expect(result.mostShowers.user).toBe("-");
    expect(result.mostShowers.count).toBe(0);
    expect(result.longestAvg.minutes).toBe(0);
    expect(result.earlyBird.avgHour).toBe(0);
    expect(result.nightOwl.avgHour).toBe(0);
  });
});
