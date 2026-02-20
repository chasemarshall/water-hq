import { NextResponse } from "next/server";
import { adminDb, adminPath } from "@/lib/firebaseAdmin";

export async function POST() {
  try {
    const now = Date.now();

    // Cleanup old log entries (older than 24h)
    const cutoff24h = now - 24 * 60 * 60 * 1000;
    const logSnap = await adminDb
      .ref(adminPath("log"))
      .orderByChild("endedAt")
      .endAt(cutoff24h)
      .once("value");
    const logDeletes: Promise<void>[] = [];
    logSnap.forEach((child) => {
      logDeletes.push(child.ref.remove());
    });
    await Promise.all(logDeletes);

    // Cleanup old logHistory entries (older than 30 days)
    const cutoff30d = now - 30 * 24 * 60 * 60 * 1000;
    const historySnap = await adminDb
      .ref(adminPath("logHistory"))
      .orderByChild("endedAt")
      .endAt(cutoff30d)
      .once("value");
    const historyDeletes: Promise<void>[] = [];
    historySnap.forEach((child) => {
      historyDeletes.push(child.ref.remove());
    });
    await Promise.all(historyDeletes);

    // Cleanup old non-recurring slots (before yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    const slotsSnap = await adminDb
      .ref(adminPath("slots"))
      .orderByChild("date")
      .endAt(yesterdayStr)
      .once("value");
    const slotDeletes: Promise<void>[] = [];
    slotsSnap.forEach((child) => {
      if (!child.val()?.recurring) {
        slotDeletes.push(child.ref.remove());
      }
    });
    await Promise.all(slotDeletes);

    const removed = logDeletes.length + historyDeletes.length + slotDeletes.length;
    return NextResponse.json({ removed });
  } catch (err) {
    console.error("cleanup error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
