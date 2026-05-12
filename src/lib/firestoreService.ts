import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Transaction as FirestoreTransaction 
} from 'firebase/firestore';
import { db, auth } from './firebase';

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
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function cleanData(data: any) {
  const cleaned: any = {};
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      cleaned[key] = data[key];
    }
  });
  return cleaned;
}

export const firestoreService = {
  async getTransactions() {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const path = 'transactions';
    try {
      const q = query(collection(db, path), where('uid', '==', uid), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async addTransaction(data: any) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    const path = 'transactions';
    try {
      const docRef = await addDoc(collection(db, path), cleanData({
        ...data,
        uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateTransaction(id: string, data: any) {
    const path = `transactions/${id}`;
    try {
      const docRef = doc(db, 'transactions', id);
      await updateDoc(docRef, cleanData({
        ...data,
        updatedAt: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteTransaction(id: string) {
    const path = `transactions/${id}`;
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async getAccounts() {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const path = 'accounts';
    try {
      const q = query(collection(db, path), where('uid', '==', uid));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async saveAccounts(accounts: any[]) {
     const uid = auth.currentUser?.uid;
     if (!uid) return;
     // For simplicity in this app, we'll just handle them individually if needed, 
     // but let's provide a way to seed them if empty
     for (const account of accounts) {
       if (!account.id) {
         await addDoc(collection(db, 'accounts'), cleanData({ ...account, uid }));
       }
     }
  },

  async getCards() {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const path = 'cards';
    try {
      const q = query(collection(db, path), where('uid', '==', uid));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async getCategories() {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const path = 'categories';
    try {
      const q = query(collection(db, path), where('uid', '==', uid));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async addCard(data: any) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    const path = 'cards';
    try {
      const docRef = await addDoc(collection(db, path), cleanData({
        ...data,
        uid,
      }));
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async addCategory(data: any) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    const path = 'categories';
    try {
      const docRef = await addDoc(collection(db, path), cleanData({
        ...data,
        uid,
      }));
      return { id: docRef.id, ...data };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateCategory(id: string, data: any) {
    const path = `categories/${id}`;
    try {
      await updateDoc(doc(db, 'categories', id), cleanData(data));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteCategory(id: string) {
    const path = `categories/${id}`;
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
};
