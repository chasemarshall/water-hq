"use client";

import { motion, AnimatePresence } from "framer-motion";
import { userColor, formatLogTime, formatDuration, timeAgo } from "@/lib/utils";
import type { LogMap } from "@/lib/types";

export function ShowerLog({ log }: { log: LogMap | null }) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  const entries = log
    ? Object.entries(log)
        .filter(([, e]) => e.endedAt > cutoff)
        .sort(([, a], [, b]) => b.endedAt - a.endedAt)
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl uppercase">Shower Log</h2>
        <div className="brutal-card-sm bg-surface px-3 py-1 rounded-lg">
          <span className="font-mono text-sm font-bold">
            last 24h
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {entries.length === 0 ? (
            <motion.div
              key="empty-log"
              className="brutal-card-sm bg-surface rounded-xl p-6 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <p className="font-mono text-sm text-muted uppercase tracking-wider">
                No showers logged yet
              </p>
              <p className="text-3xl mt-2">{"\u{1F9FC}"}</p>
            </motion.div>
          ) : (
            entries.map(([id, entry], i) => (
              <motion.div
                key={id}
                className={`brutal-card-sm bg-surface rounded-xl p-4 flex items-center gap-3`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                transition={{ delay: i * 0.03 }}
                layout
              >
                <div
                  className={`${userColor(entry.user)} w-10 h-10 rounded-lg border-2 border-frame flex items-center justify-center font-display text-sm shrink-0`}
                >
                  {entry.user.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-display text-sm block">
                    {entry.user}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {formatLogTime(entry.startedAt)} &mdash; {formatDuration(entry.durationSeconds)}
                  </span>
                </div>
                <div className="font-mono text-xs text-muted shrink-0">
                  {timeAgo(entry.endedAt)}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
