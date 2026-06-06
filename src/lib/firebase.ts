import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../config';

let firebaseApp: FirebaseApp | null = null;
let db: Firestore | null = null;

const hasFirebaseConfig = FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId;

if (hasFirebaseConfig) {
  firebaseApp = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];
  db = getFirestore(firebaseApp);
  if (import.meta.env.DEV) {
    try { connectFirestoreEmulator(db, 'localhost', 8080); } catch (_) {}
  }
} else {
  console.warn('[Firebase] Missing Firebase config. Using mock backend. Set VITE_FIREBASE_* env vars for real Firebase.');
}

// Load auth module dynamically
let auth: any = null;
if (hasFirebaseConfig) {
  try {
    const mod: any = await import('firebase/auth');
    if (firebaseApp) {
      auth = mod.getAuth(firebaseApp);
      if (import.meta.env.DEV) {
        mod.connectAuthEmulator(auth, 'http://localhost:9099');
      }
    }
  } catch (_) {
    console.warn('[Firebase] Auth module not available');
  }
}

function createMockDb() {
  const mockDoc = (id: string) => ({
    id,
    set: () => Promise.resolve(),
    update: () => Promise.resolve(),
    delete: () => Promise.resolve(),
    get: () => Promise.resolve({ exists: false, data: () => undefined, id }),
  });

  const mockCollection = (path: string) => ({
    path,
    doc: (subPath: string) => mockDoc(subPath),
    where: () => ({
      get: () => Promise.resolve({ docs: [], size: 0, empty: true }),
      onSnapshot: (_cb: any) => () => {},
    }),
    orderBy: () => ({ ...mockCollection(path), where: () => ({ get: () => Promise.resolve({ docs: [], size: 0, empty: true }) }) }),
    limit: () => ({ ...mockCollection(path), where: () => ({ get: () => Promise.resolve({ docs: [], size: 0, empty: true }) }) }),
    get: () => Promise.resolve({ docs: [], size: 0, empty: true }),
    add: () => Promise.resolve(mockDoc(Math.random().toString(36).substr(2, 9))),
  });

  return {
    collection: (_firestore: any, path: string) => mockCollection(path),
  };
}

export const db_instance = db || (createMockDb() as any);
export const auth_instance = auth || {
  currentUser: null,
  onAuthStateChanged: (cb: (u: any) => void) => { cb(null); return () => {}; },
  signInWithEmailAndPassword: () => Promise.reject(new Error('Firebase not configured')),
  signOut: () => Promise.resolve(),
};

export { firebaseApp, db, auth };
export default db_instance;

// ─── Backward-compatible mock exports ────────────────────────────
export const collection = (firestore: any, path: string) => db_instance.collection(firestore, path);

export const doc = (reference: any, ...paths: string[]) => {
  if (paths.length === 0) {
    return { id: reference.split('/').pop(), parent: null, firestore: null, path: reference };
  }
  const fullPath = [reference.path || reference, ...paths].join('/');
  return { id: fullPath.split('/').pop(), parent: reference, firestore: reference.firestore || reference, path: fullPath };
};

export const query = (collectionRef: any, ...constraints: any[]) => ({
  ...collectionRef, constraints, type: 'query'
});

export const where = (_field: string, _op: string, _value: any) => ({});
export const orderBy = (_field: string, _direction?: 'asc' | 'desc') => ({});
export const limit = (count: number) => ({ limit: count });

export const onSnapshot = (_ref: any, callback: (snapshot: any) => void, _errorCallback?: (error: any) => void) => {
  setTimeout(() => callback({ docs: [], size: 0, empty: true } as any), 100);
  return () => {};
};

export const addDoc = async (_collectionRef: any, _data: any) => {
  return { id: Math.random().toString(36).substr(2, 9) };
};
export const serverTimestamp = () => ({ __timestamp__: Date.now() });
export const deleteDoc = async (_docRef: any) => Promise.resolve();
export const updateDoc = async (_docRef: any, _data: any) => Promise.resolve();
export const setDoc = async (_docRef: any, _data: any, _options?: any) => Promise.resolve();
export const getDocFromServer = (_docRef: any) => Promise.resolve({ exists: () => true, data: () => ({}) });

export enum OperationType {
  CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LIST = 'list', GET = 'get', WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: { userId?: string | null; email?: string | null; emailVerified?: boolean | null; isAnonymous?: boolean | null; }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
