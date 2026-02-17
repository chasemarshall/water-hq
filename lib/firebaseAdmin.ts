import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

if (!getApps().length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY env var is not set");
  }

  initializeApp({
    credential: cert(JSON.parse(raw)),
    databaseURL: "https://shower-tracker-276d6-default-rtdb.firebaseio.com",
  });
}

export const adminDb = getDatabase();
