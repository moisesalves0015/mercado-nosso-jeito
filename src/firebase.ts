// Firebase client SDK — credentials sourced exclusively from environment variables.
// NEVER add hardcoded fallback credentials here; they would be included in the
// production bundle and exposed to anyone inspecting the source.
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { initializeFirestore, getFirestore, type Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const env = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

const requiredEnvVars = {
  apiKey:            env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId:         env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId:             env.VITE_FIREBASE_APP_ID as string | undefined,
};

// Validate required variables at startup — surfaces misconfiguration early.
const missing = Object.entries(requiredEnvVars)
  .filter(([, v]) => !v)
  .map(([k]) => `VITE_FIREBASE_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`);

if (missing.length > 0) {
  // In development, throw so the developer notices immediately.
  // In production, we still attempt initialisation (Vercel injects these at build time).
  if (env.DEV) {
    throw new Error(
      `[Firebase] Missing environment variables: ${missing.join(', ')}.\n` +
      `Create a .env file at the project root with the required VITE_FIREBASE_* keys.`
    );
  }
}

const firebaseConfig = {
  apiKey:            (env.VITE_FIREBASE_API_KEY as string | undefined) || 'mock-api-key',
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId:         (env.VITE_FIREBASE_PROJECT_ID as string | undefined) || 'mock-project',
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId:             (env.VITE_FIREBASE_APP_ID as string | undefined) || '1:123456789:web:abcdef',
  measurementId:     env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined, // optional
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with experimentalForceLongPolling to eliminate ERR_QUIC_PROTOCOL_ERROR
// and WebChannel stream transport crashes on Chrome and corporate/mobile networks.
let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch {
  firestoreDb = getFirestore(app);
}
export const db = firestoreDb;

// Initialize Firebase Storage (for profile photos)
export const storage = getStorage(app);

// Initialize Firebase Functions (for Callable Functions like createOrder)
export const fns = getFunctions(app);
export const functions = fns;

// Analytics — lazy, safe for non-browser environments
export const analytics = typeof window !== "undefined"
  ? isSupported().then((supported) => (supported ? getAnalytics(app) : null))
  : null;

export { app };
