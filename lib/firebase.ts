import { initializeApp } from "firebase/app";
import { getDatabase, ref as firebaseRef, DatabaseReference } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDNCvshO1GDxK9ZR6cG1t6mBtHeOE6azOo",
  authDomain: "shower-tracker-276d6.firebaseapp.com",
  databaseURL: "https://shower-tracker-276d6-default-rtdb.firebaseio.com",
  projectId: "shower-tracker-276d6",
  storageBucket: "shower-tracker-276d6.firebasestorage.app",
  messagingSenderId: "999850460751",
  appId: "1:999850460751:web:f33941135fdd7ac3254c3a",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/** Prefix for Firebase paths — "preview/" on non-production Vercel deployments, "" otherwise. */
export const DB_PREFIX =
  process.env.NEXT_PUBLIC_VERCEL_ENV && process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"
    ? "preview/"
    : "";

/** Shorthand for ref(db, prefixedPath). Use for all app data (status, slots, log). */
export function dbRef(path: string): DatabaseReference {
  return firebaseRef(db, `${DB_PREFIX}${path}`);
}
