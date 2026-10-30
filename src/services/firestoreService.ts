import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { firebaseApp, firebaseAuth } from './firebaseAuth';
import firebaseConfig from '../../firebase-applet-config.json';
import { MemoryNote, AuthorizedUser } from '../types';

export const FIRESTORE_PROJECT_ID: string =
  firebaseConfig.projectId || 'gen-lang-client-0012308220';

export const FIRESTORE_DATABASE_ID: string =
  (firebaseConfig as any).firestoreDatabaseId ||
  (typeof process !== 'undefined' && (process.env as any)?.VITE_FIREBASE_DATABASE_ID) ||
  'ai-studio-everly-cd5ac139-cf00-4957-bc41-efe152baebda';

// CRITICAL: Initialize single shared Firestore instance using the verified named database ID
export const db = getFirestore(firebaseApp, FIRESTORE_DATABASE_ID);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseAuth.currentUser?.uid,
      email: firebaseAuth.currentUser?.email,
      emailVerified: firebaseAuth.currentUser?.emailVerified,
      isAnonymous: firebaseAuth.currentUser?.isAnonymous,
      tenantId: firebaseAuth.currentUser?.tenantId,
      providerInfo: firebaseAuth.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface FirestoreConnectionDiagnostic {
  connected: boolean;
  status: 'connected' | 'permission-denied' | 'database-not-found' | 'network-error' | 'unauthenticated' | 'error';
  projectId: string;
  databaseId: string;
  message: string;
}

/**
 * Validate connection to Firestore on boot with specific actionable diagnostics
 */
export async function testFirestoreConnection(): Promise<FirestoreConnectionDiagnostic> {
  const diagnostic: FirestoreConnectionDiagnostic = {
    connected: false,
    status: 'error',
    projectId: FIRESTORE_PROJECT_ID,
    databaseId: FIRESTORE_DATABASE_ID,
    message: '',
  };

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        const timeoutErr = new Error("Backend didn't respond within 8 seconds (network timeout / client offline)");
        (timeoutErr as any).code = 'deadline-exceeded';
        reject(timeoutErr);
      }, 8000);
      if (typeof timer.unref === 'function') timer.unref();
    });

    const snap = await Promise.race([
      getDocFromServer(doc(db, 'test', 'connection')),
      timeoutPromise,
    ]);
    diagnostic.connected = true;
    diagnostic.status = 'connected';
    diagnostic.message = `Firestore connected successfully (Project: ${FIRESTORE_PROJECT_ID}, Database: ${FIRESTORE_DATABASE_ID}, doc exists: ${snap.exists()})`;
    return diagnostic;
  } catch (error: any) {
    const errorMsg: string = error?.message || String(error);
    const errorCode: string = error?.code || '';

    if (errorMsg.includes('Database') && errorMsg.includes('not found')) {
      diagnostic.status = 'database-not-found';
      diagnostic.message = `Cloud Firestore database '${FIRESTORE_DATABASE_ID}' not found in project '${FIRESTORE_PROJECT_ID}'. Please verify database ID in Firebase Console.`;
      console.error(`[Firestore Diagnostic] ${diagnostic.message}`);
    } else if (errorCode === 'permission-denied' || errorMsg.includes('insufficient permissions')) {
      // Permission denied proves the cloud database exists, is reachable, and enforcing rules!
      diagnostic.connected = true;
      diagnostic.status = 'permission-denied';
      diagnostic.message = `Connected to cloud database '${FIRESTORE_DATABASE_ID}' in project '${FIRESTORE_PROJECT_ID}'. Access rules require verified authentication.`;
    } else if (
      errorMsg.includes('the client is offline') ||
      errorMsg.includes("didn't respond within") ||
      errorCode === 'unavailable' ||
      errorCode === 'deadline-exceeded'
    ) {
      diagnostic.status = 'network-error';
      diagnostic.message = `Network connectivity timeout reaching Firestore backend (Project: ${FIRESTORE_PROJECT_ID}, Database: ${FIRESTORE_DATABASE_ID}). Client operating in resilient offline mode.`;
      console.warn(`[Firestore Diagnostic] ${diagnostic.message}`);
    } else {
      diagnostic.status = 'error';
      diagnostic.message = `Firestore diagnostic (Project: ${FIRESTORE_PROJECT_ID}, Database: ${FIRESTORE_DATABASE_ID}): ${errorMsg}`;
    }

    return diagnostic;
  }
}

/**
 * Sync user profile to Firestore
 */
export async function syncUserProfileToFirestore(user: AuthorizedUser): Promise<void> {
  if (!firebaseAuth.currentUser?.uid) return;
  const path = `users/${firebaseAuth.currentUser.uid}`;
  try {
    const userRef = doc(db, 'users', firebaseAuth.currentUser.uid);
    await setDoc(
      userRef,
      {
        email: user.email,
        name: user.name,
        role: user.role,
        avatarInitials: user.avatarInitials,
        avatarColor: user.avatarColor,
        avatarUrl: user.picture || '',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Active subscription management to prevent duplicate listeners
let activeNotesUnsubscribe: (() => void) | null = null;

/**
 * Subscribe to Memory Notes from Firestore with duplicate listener protection
 * and pre-flight Firebase authentication check to prevent permission failures.
 */
export function subscribeFirestoreMemoryNotes(
  onNotes: (notes: MemoryNote[]) => void,
  onError?: (err: Error) => void
): () => void {
  // Wait for Firebase authentication before attaching protected listeners (Requirement 3)
  const currentFirebaseUser = firebaseAuth.currentUser;
  if (!currentFirebaseUser) {
    console.info('[Firestore] Deferring memoryNotes listener: waiting for Firebase authenticated session.');
    return () => {};
  }

  // Clean up any existing active listener to prevent memory leaks and duplicate triggers
  if (activeNotesUnsubscribe) {
    activeNotesUnsubscribe();
    activeNotesUnsubscribe = null;
  }

  const notesPath = 'memoryNotes';
  try {
    const q = query(collection(db, notesPath));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notes: MemoryNote[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          notes.push({
            id: d.id || docSnap.id,
            content: d.content,
            author: {
              email: d.authorEmail,
              name: d.authorName,
              role: d.authorRole || 'Member',
              avatarColor: d.colorScheme === 'rose' ? 'from-rose-500 to-pink-600' : 'from-indigo-500 to-purple-600',
              avatarInitials: d.authorName ? d.authorName.slice(0, 2).toUpperCase() : 'EV',
            },
            createdAt: d.createdAt,
            category: d.category || 'memory',
            colorScheme: d.colorScheme || 'rose',
          });
        });
        notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onNotes(notes);
      },
      (error) => {
        // Stop retry loop on permission-denied
        if (error.code === 'permission-denied') {
          console.warn('[Firestore] Permission denied for memoryNotes listener. Disconnecting listener to avoid retry loop.');
          if (activeNotesUnsubscribe) {
            activeNotesUnsubscribe();
            activeNotesUnsubscribe = null;
          }
        }
        if (onError) onError(error);
      }
    );

    activeNotesUnsubscribe = unsubscribe;
    return () => {
      if (activeNotesUnsubscribe === unsubscribe) {
        activeNotesUnsubscribe = null;
      }
      unsubscribe();
    };
  } catch (error) {
    if (onError && error instanceof Error) onError(error);
    return () => {};
  }
}

/**
 * Add a new Memory Note to Firestore
 */
export async function addMemoryNoteToFirestore(note: MemoryNote): Promise<boolean> {
  const currentFirebaseUser = firebaseAuth.currentUser;
  if (!currentFirebaseUser) {
    console.info('[Firestore] User not authenticated in Firebase Auth; note saved to local vault.');
    return false;
  }

  const notesPath = 'memoryNotes';
  try {
    const noteRef = doc(db, notesPath, note.id);
    await setDoc(noteRef, {
      id: note.id,
      content: note.content,
      authorEmail: note.author.email,
      authorName: note.author.name,
      authorRole: note.author.role,
      category: note.category,
      colorScheme: note.colorScheme,
      createdAt: note.createdAt,
    });
    return true;
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn('[Firestore] Permission denied saving note to cloud; preserved in local vault.');
      return false;
    }
    handleFirestoreError(error, OperationType.WRITE, `${notesPath}/${note.id}`);
  }
}

/**
 * Delete a Memory Note from Firestore
 */
export async function deleteMemoryNoteFromFirestore(noteId: string): Promise<boolean> {
  const currentFirebaseUser = firebaseAuth.currentUser;
  if (!currentFirebaseUser) {
    return false;
  }

  const notePath = `memoryNotes/${noteId}`;
  try {
    await deleteDoc(doc(db, 'memoryNotes', noteId));
    return true;
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn('[Firestore] Permission denied deleting note from cloud; removed locally.');
      return false;
    }
    handleFirestoreError(error, OperationType.DELETE, notePath);
  }
}

// ----------------------------------------------------
// Draft Recovery Helpers (Ensures user input is never lost)
// ----------------------------------------------------
const DRAFT_STORAGE_KEY = 'everly_memory_note_draft';

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
  } catch {}
  return null;
}

export function saveLocalDraft(text: string): void {
  try {
    const storage = getStorage();
    if (storage) {
      if (text.trim()) {
        storage.setItem(DRAFT_STORAGE_KEY, text);
      } else {
        storage.removeItem(DRAFT_STORAGE_KEY);
      }
    }
  } catch {}
}

export function getLocalDraft(): string {
  try {
    const storage = getStorage();
    if (storage) {
      return storage.getItem(DRAFT_STORAGE_KEY) || '';
    }
  } catch {}
  return '';
}

export function clearLocalDraft(): void {
  try {
    const storage = getStorage();
    if (storage) {
      storage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch {}
}
