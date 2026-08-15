import "server-only";

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage, type Storage } from "firebase-admin/storage";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

export interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export const SERVICE_ACCOUNT: ServiceAccount | null = parseServiceAccount();

function parseServiceAccount(): ServiceAccount | null {
  if (typeof process === "undefined") return null;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is malformed");
    }
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch (err) {
    console.error("[specnova] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON", err);
    return null;
  }
}

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]!;

  if (!SERVICE_ACCOUNT) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set. Server-side Firebase calls are unavailable.",
    );
  }

  return initializeApp({
    credential: cert({
      projectId: SERVICE_ACCOUNT.projectId,
      clientEmail: SERVICE_ACCOUNT.clientEmail,
      privateKey: SERVICE_ACCOUNT.privateKey,
    }),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

/** Lazily-initialized Firestore handle shared across the server runtime. */
export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}

export function getAdminMessaging(): Messaging {
  return getMessaging(getAdminApp());
}

export const isFirebaseConfigured = () => Boolean(SERVICE_ACCOUNT);
