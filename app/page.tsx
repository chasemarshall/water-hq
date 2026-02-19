"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { dbRef } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import { onValue, push, remove, query, orderByChild, endAt, get } from "firebase/database";

import { TEN_MINUTES_MS, SLOT_ALERT_WINDOW_MS } from "@/lib/constants";
import { getToday, formatTimeRange, getEffectiveSlotStartTimestamp, getSlotAlertKey } from "@/lib/utils";
import { getPersistedUser, persistUser, clearPersistedUser } from "@/lib/storage";
import { subscribeToPush, sendPushNotification } from "@/lib/notifications";
import type { ShowerStatus, SlotsMap, LogMap } from "@/lib/types";

import { UserSelectScreen } from "./components/UserSelectScreen";
import { StatusBanner } from "./components/StatusBanner";
import { ShowerButton } from "./components/ShowerButton";
import { ShowerLog } from "./components/ShowerLog";
import { TimeSlots } from "./components/TimeSlots";
import { ClaimModal } from "./components/ClaimModal";
import { TickerBar } from "./components/TickerBar";
import { LoginScreen } from "./components/LoginScreen";
import { ShowerAnalytics } from "./components/ShowerAnalytics";

export default function Home() {
  const {
    user: authUser,
    loading: authLoading,
    error: authError,
    signIn,
    emailSignIn,
    signOut,
  } = useAuth();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [status, setStatus] = useState<ShowerStatus | null>(null);
  const [slots, setSlots] = useState<SlotsMap | null>(null);
  const [log, setLog] = useState<LogMap | null>(null);
  const [logHistory, setLogHistory] = useState<LogMap | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const sentSlotNotificationsRef = useRef<Set<string>>(new Set());
  const autoLoggedSlotsRef = useRef<Set<string>>(new Set());

  // Request notification permission (called from button tap on iOS, or auto on other browsers)
  const requestNotifPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      if (result === "granted" && authUser && currentUser) {
        await subscribeToPush(currentUser);
      }
    } catch {
      // Ignore permission failures.
    }
  }, [authUser, currentUser]);

  // Load user from localStorage + register SW + request notification permission
  useEffect(() => {
    const savedUser = getPersistedUser();
    if (savedUser) {
      setCurrentUser(savedUser);
    }
    setLoaded(true);

    // Register service worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore SW registration failures.
      });
    }

    // Check notification permission state
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);

      // Auto-request on non-iOS browsers (iOS requires user gesture)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (!isIOS && Notification.permission === "default") {
        (async () => {
          try {
            const result = await Notification.requestPermission();
            setNotifPermission(result);
          } catch {
            // Ignore permission/subscription failures.
          }
        })();
      }
    }
  }, []);

  // Re-subscribe to push when user or auth state changes.
  useEffect(() => {
    if (
      authUser &&
      currentUser &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      subscribeToPush(currentUser);
    }
  }, [authUser, currentUser]);

  useEffect(() => {
    if (!currentUser || !slots) return;

    const notifyUpcomingSlots = () => {
      const now = Date.now();

      for (const [slotId, slot] of Object.entries(slots)) {
        const slotStartTs = getEffectiveSlotStartTimestamp(slot);
        const ownerTenDiff = slotStartTs - TEN_MINUTES_MS - now;
        const ownerStartDiff = slotStartTs - now;

        // Notify the slot owner 10 minutes before their shower
        const ownerTenKey = getSlotAlertKey(slotId, "owner-ten");
        if (
          ownerTenDiff >= 0 &&
          ownerTenDiff <= SLOT_ALERT_WINDOW_MS &&
          !sentSlotNotificationsRef.current.has(ownerTenKey)
        ) {
          sendPushNotification({
            title: "\u{1F6BF} YOUR SHOWER IN 10 MIN",
            body: `Your slot starts at ${formatTimeRange(slot.startTime, slot.durationMinutes)}.`,
            targetUsers: [slot.user],
          });
          sentSlotNotificationsRef.current.add(ownerTenKey);
        }

        // Notify the slot owner when their shower starts
        const ownerStartKey = getSlotAlertKey(slotId, "owner-start");
        if (
          ownerStartDiff >= 0 &&
          ownerStartDiff <= SLOT_ALERT_WINDOW_MS &&
          !sentSlotNotificationsRef.current.has(ownerStartKey)
        ) {
          sendPushNotification({
            title: "\u{1F6BF} SHOWER TIME",
            body: `It's time for your shower slot (${formatTimeRange(slot.startTime, slot.durationMinutes)}).`,
            targetUsers: [slot.user],
          });
          sentSlotNotificationsRef.current.add(ownerStartKey);
        }

        // Notify other users 10 minutes before
        const othersTenKey = getSlotAlertKey(slotId, "others-ten");
        if (
          ownerTenDiff >= 0 &&
          ownerTenDiff <= SLOT_ALERT_WINDOW_MS &&
          !sentSlotNotificationsRef.current.has(othersTenKey)
        ) {
          sendPushNotification({
            title: "\u{1F6BF} Shower Slot Soon",
            body: `${slot.user}'s shower starts in 10 minutes (${formatTimeRange(slot.startTime, slot.durationMinutes)}).`,
            excludeUser: slot.user,
          });
          sentSlotNotificationsRef.current.add(othersTenKey);
        }

        // Notify other users when shower starts
        const othersStartKey = getSlotAlertKey(slotId, "others-start");
        if (
          ownerStartDiff >= 0 &&
          ownerStartDiff <= SLOT_ALERT_WINDOW_MS &&
          !sentSlotNotificationsRef.current.has(othersStartKey)
        ) {
          sendPushNotification({
            title: "\u{1F6BF} Shower Slot Starting",
            body: `${slot.user}'s shower slot is starting now (${formatTimeRange(slot.startTime, slot.durationMinutes)}).`,
            excludeUser: slot.user,
          });
          sentSlotNotificationsRef.current.add(othersStartKey);
        }

        // Auto-log shower when slot ends (skip if already completed early)
        const autoLogKey = `${slotId}:auto-log`;
        const slotEndTs = slotStartTs + slot.durationMinutes * 60 * 1000;
        if (
          !slot.completed &&
          now >= slotEndTs &&
          now <= slotEndTs + 5 * 60 * 1000 &&
          !autoLoggedSlotsRef.current.has(autoLogKey)
        ) {
          const entry = {
            user: slot.user,
            startedAt: slotStartTs,
            endedAt: slotEndTs,
            durationSeconds: slot.durationMinutes * 60,
          };
          push(dbRef("log"), entry);
          push(dbRef("logHistory"), entry);
          autoLoggedSlotsRef.current.add(autoLogKey);
        }
      }

      const validKeys = new Set<string>();
      const validAutoLogKeys = new Set<string>();
      for (const [slotId, slot] of Object.entries(slots)) {
        const slotStartTs = getEffectiveSlotStartTimestamp(slot);
        if (slotStartTs >= now - 5 * 60 * 1000) {
          validKeys.add(getSlotAlertKey(slotId, "owner-ten"));
          validKeys.add(getSlotAlertKey(slotId, "owner-start"));
          validKeys.add(getSlotAlertKey(slotId, "others-ten"));
          validKeys.add(getSlotAlertKey(slotId, "others-start"));
        }
        const slotEndTs = slotStartTs + slot.durationMinutes * 60 * 1000;
        if (slotEndTs >= now - 5 * 60 * 1000) {
          validAutoLogKeys.add(`${slotId}:auto-log`);
        }
      }
      sentSlotNotificationsRef.current = new Set(
        [...sentSlotNotificationsRef.current].filter((key) => validKeys.has(key)),
      );
      autoLoggedSlotsRef.current = new Set(
        [...autoLoggedSlotsRef.current].filter((key) => validAutoLogKeys.has(key)),
      );
    };

    notifyUpcomingSlots();
    const timer = window.setInterval(notifyUpcomingSlots, 30_000);
    return () => window.clearInterval(timer);
  }, [currentUser, slots]);

  // Firebase listeners
  useEffect(() => {
    if (!currentUser) return;

    const statusRef = dbRef("status");
    const slotsRef = dbRef("slots");

    const unsubStatus = onValue(statusRef, (snap) => {
      setStatus(snap.val());
    }, () => {
      // Ignore listener errors (e.g. Safari private mode).
    });

    const unsubSlots = onValue(slotsRef, (snap) => {
      setSlots(snap.val());
    }, () => {
      // Ignore listener errors (e.g. Safari private mode).
    });

    const logRef = dbRef("log");
    const unsubLog = onValue(logRef, (snap) => {
      setLog(snap.val());
    }, () => {
      // Ignore listener errors (e.g. Safari private mode).
    });

    const logHistoryRef = dbRef("logHistory");
    const unsubLogHistory = onValue(logHistoryRef, (snap) => {
      setLogHistory(snap.val());
    }, () => {});

    // One-time backfill: copy existing log entries to logHistory if logHistory is empty
    get(dbRef("logHistory")).then((historySnap) => {
      if (!historySnap.exists()) {
        get(dbRef("log")).then((logSnap) => {
          if (logSnap.exists()) {
            logSnap.forEach((child) => {
              push(dbRef("logHistory"), child.val());
            });
          }
        }).catch(() => {});
      }
    }).catch(() => {});

    // Cleanup old log entries (older than 24h)
    const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
    const oldLogQuery = query(
      dbRef("log"),
      orderByChild("endedAt"),
      endAt(cutoff24h)
    );
    get(oldLogQuery).then((snap) => {
      snap.forEach((child) => {
        remove(child.ref);
      });
    }).catch(() => {
      // Ignore cleanup failures.
    });

    // Cleanup old logHistory entries (older than 30 days)
    const cutoff30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const oldHistoryQuery = query(
      dbRef("logHistory"),
      orderByChild("endedAt"),
      endAt(cutoff30d)
    );
    get(oldHistoryQuery).then((snap) => {
      snap.forEach((child) => {
        remove(child.ref);
      });
    }).catch(() => {});

    // Cleanup old slots
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    const oldSlotsQuery = query(
      dbRef("slots"),
      orderByChild("date"),
      endAt(yesterdayStr)
    );
    get(oldSlotsQuery).then((snap) => {
      snap.forEach((child) => {
        // Never delete recurring slots — they apply every day regardless of original date
        if (!child.val()?.recurring) remove(child.ref);
      });
    }).catch(() => {
      // Ignore cleanup failures (e.g. Safari private mode).
    });

    return () => {
      unsubStatus();
      unsubSlots();
      unsubLog();
      unsubLogHistory();
    };
  }, [currentUser]);

  const getAuthToken = useCallback(async () => {
    if (!authUser) return null;
    return authUser.getIdToken();
  }, [authUser]);

  const logShower = useCallback((startedAt: number) => {
    const now = Date.now();
    const durationSeconds = Math.floor((now - startedAt) / 1000);
    if (durationSeconds < 1 || !currentUser) return;
    const entry = {
      user: currentUser,
      startedAt,
      endedAt: now,
      durationSeconds,
    };
    push(dbRef("log"), entry);
    push(dbRef("logHistory"), entry);
  }, [currentUser]);

  const handleSelectUser = useCallback((name: string) => {
    persistUser(name);
    setCurrentUser(name);
  }, []);

  const handleSwitchUser = useCallback(() => {
    clearPersistedUser();
    setCurrentUser(null);
    setStatus(null);
    setSlots(null);
    setLog(null);
  }, []);

  if (!loaded || authLoading) return null;

  // Not authenticated -> show login screen
  if (!authUser) {
    return (
      <main className="max-w-lg mx-auto relative">
        <LoginScreen
          onGoogleSignIn={signIn}
          onEmailSignIn={emailSignIn}
          error={authError}
        />
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto relative">
      <AnimatePresence mode="wait">
        {!currentUser ? (
          <UserSelectScreen key="select" onSelect={handleSelectUser} authEmail={authUser?.email ?? null} />
        ) : (
          <motion.div
            key="main"
            className="min-h-dvh p-5 flex flex-col gap-6"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          >
            {/* Header */}
            <motion.header
              className="flex items-center justify-between pt-2"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <button
                className="brutal-btn bg-surface px-4 py-2 rounded-xl"
                onClick={handleSwitchUser}
              >
                <span className="font-display text-sm">
                  {currentUser}
                </span>
              </button>
              <button
                className="brutal-btn bg-coral text-white px-4 py-2 rounded-xl font-mono text-sm font-bold uppercase"
                onClick={signOut}
              >
                Sign Out
              </button>
            </motion.header>

            {/* Notification permission banner (iOS needs user gesture) */}
            {notifPermission === "default" && (
              <motion.button
                className="brutal-btn w-full bg-yolk text-ink py-3 rounded-xl font-display text-sm tracking-wide"
                onClick={requestNotifPermission}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                Tap to enable notifications
              </motion.button>
            )}

            {/* Decorative ticker */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0.8 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.2 }}
            >
              <TickerBar />
            </motion.div>

            {/* Status */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <StatusBanner status={status} currentUser={currentUser} log={log} slots={slots} onAutoRelease={logShower} />
            </motion.div>

            {/* Shower button */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <ShowerButton
                status={status}
                currentUser={currentUser}
                slots={slots}
                log={log}
                onEnd={logShower}
              />
            </motion.div>

            {/* Shower Log */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              <ShowerLog log={log} />
            </motion.div>

            {/* Divider */}
            <div className="border-t-3 border-frame border-dashed" />

            {/* Time slots */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <TimeSlots
                slots={slots}
                currentUser={currentUser}
                onClaimClick={() => setShowModal(true)}
              />
            </motion.div>

            {/* Analytics (Chase only) */}
            {currentUser === "Chase" && (
              <>
                <div className="border-t-3 border-frame border-dashed" />
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.55 }}
                >
                  <ShowerAnalytics logHistory={logHistory} getAuthToken={getAuthToken} />
                </motion.div>
              </>
            )}

            {/* Footer */}
            <motion.footer
              className="text-center pb-6 mt-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <p className="font-mono text-xs text-muted uppercase tracking-widest">
                One shower at a time
              </p>
            </motion.footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Claim Modal */}
      {currentUser && (
        <ClaimModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          currentUser={currentUser}
          slots={slots}
        />
      )}
    </main>
  );
}
