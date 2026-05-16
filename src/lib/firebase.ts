import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfigLocal from '../../firebase-applet-config.json';

// Support both environment variables (for production) and local config file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigLocal.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigLocal.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigLocal.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigLocal.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigLocal.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigLocal.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigLocal.measurementId
};

const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const rawDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigLocal.firestoreDatabaseId;

let databaseId: string | undefined;

// Logic:
// 1. If we are using the local project ID (AI Studio project), and the user says "(default)", 
//    we check if local config has a better ID (AI Studio often creates a specific one).
// 2. If we are using a DIFFERENT project ID (user's own project), we strictly follow their database ID.
if (envProjectId && envProjectId !== firebaseConfigLocal.projectId) {
  // External project: respect their database ID fully
  databaseId = (rawDatabaseId === "(default)" || !rawDatabaseId) ? undefined : rawDatabaseId;
} else {
  // Local/Internal project: be smart about avoiding "(default)" if we have a specific one
  databaseId = (rawDatabaseId === "(default)" || !rawDatabaseId)
    ? (firebaseConfigLocal.firestoreDatabaseId !== "(default)" ? firebaseConfigLocal.firestoreDatabaseId : undefined)
    : rawDatabaseId;
}

console.log("Firebase Init - Project:", firebaseConfig.projectId, "Database:", databaseId || "(default)");

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, databaseId);
export const auth = getAuth();

// Export configuration for diagnostics
export const firebaseDebugInfo = {
  projectId: firebaseConfig.projectId,
  databaseId: databaseId || "(default)",
  apiKeySet: !!firebaseConfig.apiKey,
  envApplied: !!import.meta.env.VITE_FIREBASE_PROJECT_ID
};

// Simple connectivity check without throwing hard errors
export async function checkConnectivity() {
  try {
    const pingDoc = doc(db, 'system', 'ping');
    await getDocFromServer(pingDoc);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, code: error.code, message: error.message };
  }
}
