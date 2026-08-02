/**
 * Firebase — used ONLY for Phone OTP authentication.
 * Google and email/password auth remain on Supabase; nothing here touches them.
 *
 * Config values are Firebase web (publishable) keys. Fill them in via
 * VITE_FIREBASE_* env vars or replace the fallbacks below.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env['VITE_FIREBASE_API_KEY'] ?? "",
  authDomain: import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'] ?? "",
  projectId: import.meta.env['VITE_FIREBASE_PROJECT_ID'] ?? "",
  storageBucket: import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'] ?? "",
  messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'] ?? "",
  appId: import.meta.env['VITE_FIREBASE_APP_ID'] ?? "",
};

/** True once the Firebase web config has been supplied. */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let cachedApp: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured yet. Add the VITE_FIREBASE_* values.");
  }
  if (!cachedApp) {
    cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return cachedApp;
}

/** Firebase Auth instance (browser only) — used exclusively for Phone OTP. */
export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp());
  auth.useDeviceLanguage();
  return auth;
}