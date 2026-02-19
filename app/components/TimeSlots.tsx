"use client";

import { motion, AnimatePresence } from "framer-motion";
import { remove } from "firebase/database";
import { dbRef } from "@/lib/firebase";
import { getToday, formatTimeRange, userColor } from "@/lib/utils";
import type { Slot, SlotsMap } from "@/lib/types";

export function TimeSlots({
  slots,
  currentUser,
  onClaimClick,
}: {
  slots: SlotsMap | null;
  currentUser: string;
  onClaimClick: () => void;
}) {
  const today = getToday();
  const now = new Date();

  // Group all upcoming slots by date (today + future), including recurring
  const allUpcoming = slots
    ? Object.entries(slots)
        .filter(([, s]) => s.date >= today || s.recurring)
        .sort(([, a], [, b]) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    : [];

  const totalCount = allUpcoming.length;

  // Group by date
  const slotsByDate = new Map<string, [string, Slot][]>();
  for (const entry of allUpcoming) {
    const date = entry[1].recurring ? today : entry[1].date;
    const existing = slotsByDate.get(date) || [];
    existing.push(entry);
    slotsByDate.set(date, existing);
  }

  const sortedDates = [...slotsByDate.keys()].sort();

  const isSlotPast = (slot: Slot) => {
    if (slot.completed) return true;
    if (slot.recurring) return false; // recurring slots are never permanently past
    if (slot.date > today) return false;
    const [h, m] = slot.startTime.split(":").map(Number);
    const end = new Date();
    end.setHours(h, m + slot.durationMinutes, 0, 0);
    return end <= now;
  };

  const formatDateLabel = (dateStr: string) => {
    if (dateStr === today) return "Today";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    if (dateStr === tomorrowStr) return "Tomorrow";
    const [y, mo, d] = dateStr.split("-").map(Number);
    const date = new Date(y, mo - 1, d);
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  };

  const handleDelete = (id: string) => {
    remove(dbRef(`slots/${id}`));
  };

  let colorIndex = 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl uppercase">Upcoming Slots</h2>
        <div className="brutal-card-sm bg-surface px-3 py-1 rounded-lg">
          <span className="font-mono text-sm font-bold">
            {totalCount} booked
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <AnimatePresence mode="popLayout">
          {totalCount === 0 ? (
            <motion.div
              key="empty"
              className="brutal-card-sm bg-surface rounded-xl p-6 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <p className="font-mono text-sm text-muted uppercase tracking-wider">
                No slots claimed yet
              </p>
              <p className="text-3xl mt-2">{"\u{1FAE7}"}</p>
            </motion.div>
          ) : (
            sortedDates.map((dateStr) => {
              const dateSlots = slotsByDate.get(dateStr)!;
              return (
                <div key={dateStr}>
                  {(
                    <div className="flex items-center gap-3 my-2">
                      <div className="h-px flex-1 border-t border-dashed border-muted" />
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
                        {formatDateLabel(dateStr)}
                      </span>
                      <div className="h-px flex-1 border-t border-dashed border-muted" />
                    </div>
                  )}
                  {dateSlots.map(([id, slot]) => {
                    const past = isSlotPast(slot);
                    const ci = colorIndex++;
                    return (
                      <motion.div
                        key={id}
                        className={`brutal-card-sm ${userColor(slot.user)} rounded-xl p-4 flex items-center justify-between mb-3${past ? " opacity-50" : ""}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: past ? 0.5 : 1, x: 0 }}
                        exit={{ opacity: 0, x: 20, scale: 0.9 }}
                        transition={{ delay: ci * 0.05 }}
                        layout
                      >
                        <div>
                          <span className="font-display text-base block">
                            {slot.user}
                            {slot.recurring && (
                              <span className="font-mono text-xs ml-2 px-2 py-0.5 rounded-md" style={{ backgroundColor: "color-mix(in srgb, var(--paper) 50%, transparent)" }}>
                                daily
                              </span>
                            )}
                            {past && (
                              <span className="font-mono text-xs ml-2 px-2 py-0.5 rounded-md" style={{ backgroundColor: "color-mix(in srgb, var(--frame) 30%, transparent)" }}>
                                done
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-sm font-bold">
                            {formatTimeRange(slot.startTime, slot.durationMinutes)}
                          </span>
                        </div>
                        {slot.user === currentUser && (
                          <motion.button
                            className="brutal-btn bg-surface w-9 h-9 flex items-center justify-center rounded-lg font-bold text-lg"
                            onClick={() => handleDelete(id)}
                            whileTap={{ scale: 0.9 }}
                          >
                            {"\u2715"}
                          </motion.button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <motion.button
        className="brutal-btn bg-surface w-full py-4 rounded-xl font-display text-lg uppercase tracking-wide"
        onClick={onClaimClick}
        whileTap={{ scale: 0.97 }}
      >
        + Claim a Slot
      </motion.button>
    </div>
  );
}
