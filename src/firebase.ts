// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

// Read securely from environment variables, or use default client-side config as fallback in production deploys (Vercel)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDymI1qb9b2NOpZElTWsV-SzXB_54fLtjw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "nosso-mercado-4b877.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "nosso-mercado-4b877",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "nosso-mercado-4b877.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "297048767484",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:297048767484:web:4338a4f08c607b2335d079",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-VX2TZLWN1X"
};

// Initialize Firebase safely
const app = initializeApp(firebaseConfig);

// Analytics helper to guarantee safe execution in any server/non-browser environment
export const analytics = typeof window !== "undefined"
  ? isSupported().then((supported) => (supported ? getAnalytics(app) : null))
  : null;

export { app };
