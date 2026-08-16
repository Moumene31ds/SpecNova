"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

/** True when all client-side Firebase env vars are present. */
export function isFirebaseClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );
}

function ensureApp(): FirebaseApp {
  if (app) return app;
  app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
  return app;
}

/** Singleton client-side Firebase services (import once in root providers). */
export function getFirebaseClient() {
  const firebaseApp = ensureApp();

  if (!db) {
    db = getFirestore(firebaseApp);
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true") {
      import("firebase/firestore").then(({ connectFirestoreEmulator }) =>
        connectFirestoreEmulator(db!, "localhost", 8080),
      );
    }
  }

  if (!auth) {
    auth = getAuth(firebaseApp);
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true") {
      import("firebase/auth").then(({ connectAuthEmulator }) =>
        connectAuthEmulator(auth!, "http://localhost:9099"),
      );
    }
  }

  if (!storage) storage = getStorage(firebaseApp);

  return { app: firebaseApp, auth, db, storage };
}
