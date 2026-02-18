import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { adminDb } from "@/lib/firebaseAdmin";

// Force this route to be dynamic (never pre-rendered at build time)
export const dynamic = "force-dynamic";

interface PushRecord {
  subscription: webpush.PushSubscription;
  user: string;
  updatedAt: number;
}

export async function POST(req: NextRequest) {
  try {
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
    }

    webpush.setVapidDetails("mailto:shower-tracker@example.com", vapidPublic, vapidPrivate);

    const { title, body, excludeUser, targetUsers } = await req.json();

    if (!title || !body) {
      return NextResponse.json({ error: "Missing title or body" }, { status: 400 });
    }

    // Read all push subscriptions from Firebase via Admin SDK
    const snapshot = await adminDb.ref("pushSubscriptions").once("value");
    const data: Record<string, PushRecord> | null = snapshot.val();

    if (!data) {
      return NextResponse.json({ sent: 0 });
    }

    const payload = JSON.stringify({ title, body });
    const staleKeys: string[] = [];
    let sent = 0;

    const targets = Array.isArray(targetUsers)
      ? new Set(targetUsers.filter((value: unknown): value is string => typeof value === "string"))
      : null;

    await Promise.allSettled(
      Object.entries(data).map(async ([key, record]) => {
        if (targets && !targets.has(record.user)) return;

        // Skip the user who triggered the notification
        if (excludeUser && record.user === excludeUser) return;

        try {
          await webpush.sendNotification(record.subscription, payload);
          sent++;
        } catch (err: unknown) {
          // If subscription is expired/invalid (410 Gone or 404), mark for cleanup
          if (err && typeof err === "object" && "statusCode" in err) {
            const statusCode = (err as { statusCode: number }).statusCode;
            if (statusCode === 404 || statusCode === 410) {
              staleKeys.push(key);
            }
          }
        }
      }),
    );

    // Clean up stale subscriptions
    await Promise.allSettled(
      staleKeys.map((key) => adminDb.ref(`pushSubscriptions/${key}`).remove()),
    );

    return NextResponse.json({ sent, cleaned: staleKeys.length });
  } catch (err) {
    console.error("push-notify error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
