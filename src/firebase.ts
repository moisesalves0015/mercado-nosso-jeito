// Firebase client SDK — credentials sourced exclusively from environment variables.
// NEVER add hardcoded fallback credentials here; they would be included in the
// production bundle and exposed to anyone inspecting the source.
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const requiredEnvVars = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate required variables at startup — surfaces misconfiguration early.
const missing = Object.entries(requiredEnvVars)
  .filter(([, v]) => !v)
  .map(([k]) => `VITE_FIREBASE_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`);

if (missing.length > 0) {
  // In development, throw so the developer notices immediately.
  // In production, we still attempt initialisation (Vercel injects these at build time).
  if (import.meta.env.DEV) {
    throw new Error(
      `[Firebase] Missing environment variables: ${missing.join(', ')}.\n` +
      `Create a .env file at the project root with the required VITE_FIREBASE_* keys.`
    );
  }
}

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, // optional
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Firebase Storage (for profile photos)
export const storage = getStorage(app);

// Analytics — lazy, safe for non-browser environments
export const analytics = typeof window !== "undefined"
  ? isSupported().then((supported) => (supported ? getAnalytics(app) : null))
  : null;

export { app };
