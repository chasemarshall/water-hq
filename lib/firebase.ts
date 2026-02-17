import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

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
