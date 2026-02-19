"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { USER_COLORS } from "@/lib/constants";
import {
  computePeakHours,
  computeAvgDuration,
  computeDayOfWeekFrequency,
  computeLeaderboard,
} from "@/lib/analytics";
import type { LogMap } from "@/lib/types";

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

interface ShowerAnalyticsProps {
  logHistory: LogMap | null;
  getAuthToken: () => Promise<string | null>;
}

export function ShowerAnalytics({ logHistory, getAuthToken }: ShowerAnalyticsProps) {
  const [expanded, setExpanded] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAskAI = async (spicy = false) => {
    if (!logHistory) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated");
      const entries = Object.values(logHistory);
      const res = await fetch("/api/analytics-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ entries, spicy }),
      });
      if (!res.ok) throw new Error("Failed to get insights");
      const data = await res.json();
      setAiInsights(data.insights);
    } catch {
      setAiError("Couldn't get AI insights. Try again.");
    } finally {
      setAiLoading(false);
    }
  };
  const stats = useMemo(() => {
    if (!logHistory || Object.keys(logHistory).length === 0) return null;
    return {
      peakHours: computePeakHours(logHistory),
      avgDuration: computeAvgDuration(logHistory),
      dayFreq: computeDayOfWeekFrequency(logHistory),
      leaderboard: computeLeaderboard(logHistory),
    };
  }, [logHistory]);

  return (
    <div>
      {/* Section Header — tap to expand/collapse */}
      <motion.button
        className="brutal-btn bg-surface w-full px-4 py-3 rounded-xl flex items-center justify-between"
        onClick={() => setExpanded((v) => !v)}
        whileTap={{ scale: 0.97 }}
      >
        <h2 className="font-display text-xl uppercase">Analytics</h2>
        <div className="flex items-center gap-2">
          <div className="brutal-card-sm bg-paper px-3 py-1 rounded-lg">
            <span className="font-mono text-sm font-bold">30d</span>
          </div>
          <motion.span
            className="font-display text-lg"
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            ▼
          </motion.span>
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
      {expanded && (
      <motion.div
        key="analytics-content"
        initial={{ height: 0, opacity: 0, overflow: "hidden" }}
        animate={{ height: "auto", opacity: 1, overflow: "visible" }}
        exit={{ height: 0, opacity: 0, overflow: "hidden" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >

      {/* Empty State */}
      {!stats ? (
        <div className="brutal-card-sm bg-surface rounded-xl p-6 text-center mt-4">
          <p className="font-mono text-sm text-muted uppercase tracking-wider">
            No shower data yet
          </p>
          <p className="text-3xl mt-2">📊</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 mt-4">
          {/* Avg Duration Cards */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider mb-3">
              Avg Duration
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(stats.avgDuration).map(([user, minutes]) => (
                <div
                  key={user}
                  className={`brutal-card-sm ${USER_COLORS[user] ?? "bg-surface"} rounded-xl p-3`}
                >
                  <span className="font-display text-sm block">{user}</span>
                  <span className="font-mono text-2xl font-bold">
                    {minutes}m
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Peak Hours */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider mb-3">
              Peak Hours
            </h3>
            <div className="flex flex-col gap-3">
              {Object.entries(stats.peakHours).map(([user, hourCounts]) => {
                const sorted = Object.entries(hourCounts)
                  .map(([h, c]) => ({ hour: Number(h), count: c }))
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 3);
                const maxCount = sorted[0]?.count ?? 1;
                return (
                  <div
                    key={user}
                    className="brutal-card-sm bg-surface rounded-xl p-3"
                  >
                    <span className="font-display text-sm mb-2 block">
                      {user}
                    </span>
                    <div className="flex flex-col gap-1">
                      {sorted.map(({ hour, count }) => (
                        <div
                          key={hour}
                          className="flex items-center gap-2"
                        >
                          <span className="font-mono text-xs w-12 text-muted">
                            {formatHour(hour)}
                          </span>
                          <div
                            className={`${USER_COLORS[user] ?? "bg-surface"} h-4 rounded border-2 border-frame`}
                            style={{
                              width: `${(count / maxCount) * 100}%`,
                              minWidth: "8px",
                            }}
                          />
                          <span className="font-mono text-xs font-bold">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Day of Week Heatmap */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider mb-3">
              Day of Week
            </h3>
            <div className="brutal-card-sm bg-surface rounded-xl p-3">
              {/* Day headers */}
              <div className="grid grid-cols-8 gap-1 mb-2">
                <div /> {/* empty for user name col */}
                {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d, i) => (
                  <span
                    key={i}
                    className="font-mono text-xs text-center font-bold text-muted"
                  >
                    {d}
                  </span>
                ))}
              </div>
              {/* User rows */}
              {(() => {
                const usersWithData = Object.keys(stats.dayFreq);
                const allCounts = usersWithData.flatMap((u) =>
                  Object.values(stats.dayFreq[u])
                );
                const maxDayCount = Math.max(...allCounts, 1);
                return usersWithData.map((user) => (
                  <div key={user} className="grid grid-cols-8 gap-1 mb-1">
                    <span className="font-mono text-xs truncate">{user}</span>
                    {/* Days: Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6), Sun(0) */}
                    {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
                      const count = stats.dayFreq[user]?.[dayIndex] || 0;
                      const opacity =
                        count === 0
                          ? 0.1
                          : Math.min(0.3 + (count / maxDayCount) * 0.7, 1);
                      return (
                        <div
                          key={dayIndex}
                          className={`${USER_COLORS[user] ?? "bg-surface"} h-6 rounded border border-frame`}
                          style={{ opacity }}
                          title={`${count} showers`}
                        />
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          </motion.div>

          {/* Leaderboard */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider mb-3">
              Leaderboard
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="brutal-card-sm bg-surface rounded-xl p-3 text-center">
                <span className="text-2xl">🏆</span>
                <span className="font-display text-sm block mt-1">
                  {stats.leaderboard.mostShowers.user}
                </span>
                <span className="font-mono text-xs text-muted">
                  Most showers ({stats.leaderboard.mostShowers.count})
                </span>
              </div>
              <div className="brutal-card-sm bg-surface rounded-xl p-3 text-center">
                <span className="text-2xl">⏱️</span>
                <span className="font-display text-sm block mt-1">
                  {stats.leaderboard.longestAvg.user}
                </span>
                <span className="font-mono text-xs text-muted">
                  Longest avg ({stats.leaderboard.longestAvg.minutes}m)
                </span>
              </div>
              <div className="brutal-card-sm bg-surface rounded-xl p-3 text-center">
                <span className="text-2xl">🌅</span>
                <span className="font-display text-sm block mt-1">
                  {stats.leaderboard.earlyBird.user}
                </span>
                <span className="font-mono text-xs text-muted">
                  Earliest (
                  {formatHour(Math.round(stats.leaderboard.earlyBird.avgHour))})
                </span>
              </div>
              <div className="brutal-card-sm bg-surface rounded-xl p-3 text-center">
                <span className="text-2xl">🌙</span>
                <span className="font-display text-sm block mt-1">
                  {stats.leaderboard.nightOwl.user}
                </span>
                <span className="font-mono text-xs text-muted">
                  Latest (
                  {formatHour(Math.round(stats.leaderboard.nightOwl.avgHour))})
                </span>
              </div>
            </div>
          </motion.div>

          {/* AI Insights */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider mb-3">AI Insights</h3>

            {aiError && (
              <div className="brutal-card-sm bg-coral text-white rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{aiError}</span>
                  <button
                    className="font-display text-sm ml-2"
                    onClick={() => setAiError(null)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {aiInsights ? (
              <div className="brutal-card-sm bg-surface rounded-xl p-4">
                <p className="font-mono text-sm whitespace-pre-wrap">{aiInsights}</p>
                <div className="flex gap-2 mt-3">
                  <motion.button
                    className="brutal-btn bg-surface px-4 py-2 rounded-xl font-mono text-xs font-bold uppercase tracking-wider"
                    onClick={() => handleAskAI(false)}
                    whileTap={{ scale: 0.97 }}
                    disabled={aiLoading}
                  >
                    {aiLoading ? "Thinking..." : "Refresh"}
                  </motion.button>
                  <motion.button
                    className="brutal-btn bg-coral px-3 py-2 rounded-xl text-lg"
                    onClick={() => handleAskAI(true)}
                    whileTap={{ scale: 0.95 }}
                    disabled={aiLoading}
                    title="Spicy mode"
                  >
                    💧
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <motion.button
                  className="brutal-btn bg-lime flex-1 py-4 rounded-xl font-display text-lg uppercase"
                  onClick={() => handleAskAI(false)}
                  whileTap={{ scale: 0.97 }}
                  disabled={aiLoading}
                >
                  {aiLoading ? "Thinking..." : "Ask AI"}
                </motion.button>
                <motion.button
                  className="brutal-btn bg-coral py-4 px-5 rounded-xl text-2xl"
                  onClick={() => handleAskAI(true)}
                  whileTap={{ scale: 0.95 }}
                  disabled={aiLoading}
                  title="Spicy mode"
                >
                  💧
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
