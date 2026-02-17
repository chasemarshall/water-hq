import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

if (!getApps().length) {
  // Support both a JSON file (local dev) and env var (Vercel deployment)
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : require("../serviceAccountKey.json");

  initializeApp({
    credential: cert(serviceAccount),
    databaseURL: "https://shower-tracker-276d6-default-rtdb.firebaseio.com",
  });
}

export const adminDb = getDatabase();
