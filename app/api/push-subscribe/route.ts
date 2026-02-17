import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { subscription, user } = await req.json();

    if (!subscription || !user) {
      return NextResponse.json({ error: "Missing subscription or user" }, { status: 400 });
    }

    // Use a hash of the endpoint as the key (base64url-encode it for Firebase key compatibility)
    const key = Buffer.from(subscription.endpoint).toString("base64url");

    // Store subscription in Firebase RTDB via Admin SDK
    await adminDb.ref(`pushSubscriptions/${key}`).set({
      subscription,
      user,
      updatedAt: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("push-subscribe error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
