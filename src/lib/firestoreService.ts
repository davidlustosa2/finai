import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Transaction as FirestoreTransaction,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
  BATCH = 'batch',
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
  async batchUpdateCategories(items: { id: string, data: any }[]) {
    try {
      const batch = writeBatch(db);
      items.forEach(item => {
        const docRef = doc(db, 'categories', item.id);
        batch.update(docRef, cleanData(item.data));
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.BATCH, 'categories');
    }
  },

  async getTransactions(uidOverride?: string) {
    const uid = uidOverride || auth.currentUser?.uid;
    if (!uid) return [];
    const path = 'transactions';
    try {
      const q = query(collection(db, path), where('uid', '==', uid));
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

  async getAccounts(uidOverride?: string) {
    const uid = uidOverride || auth.currentUser?.uid;
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

  async getCards(uidOverride?: string) {
    const uid = uidOverride || auth.currentUser?.uid;
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

  async getCategories(uidOverride?: string) {
    const uid = uidOverride || auth.currentUser?.uid;
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
  },

  async updateCard(id: string, data: any) {
    const path = `cards/${id}`;
    try {
      await updateDoc(doc(db, 'cards', id), cleanData(data));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteCard(id: string) {
    const path = `cards/${id}`;
    try {
      await deleteDoc(doc(db, 'cards', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async getUserProfile(uidOverride?: string) {
    const uid = uidOverride || auth.currentUser?.uid;
    if (!uid) return null;
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() };
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async updateUserProfile(uid: string, data: any) {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        await updateDoc(docRef, cleanData({
          ...data,
          updatedAt: serverTimestamp()
        }));
      } else {
        await setDoc(docRef, cleanData({
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async getSentAlerts(uid: string) {
    const path = `users/${uid}/alertas_despesas`;
    try {
      const q = query(collection(db, 'users', uid, 'alertas_despesas'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async saveSentAlert(uid: string, alertId: string, alertData: any) {
    const path = `users/${uid}/alertas_despesas/${alertId}`;
    try {
      const docRef = doc(db, 'users', uid, 'alertas_despesas', alertId);
      await setDoc(docRef, cleanData({
        ...alertData,
        updatedAt: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async checkAndExtendRecurringTransactions(uid: string, transactionsList: any[]) {
    const groups: { [groupId: string]: any[] } = {};
    transactionsList.forEach(t => {
      if (t.isRecurringEntry && t.recurringGroup) {
        const gId = String(t.recurringGroup);
        if (!groups[gId]) groups[gId] = [];
        groups[gId].push(t);
      }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const todayTime = new Date(todayStr + 'T00:00:00').getTime();

    let extendedCount = 0;

    for (const gId of Object.keys(groups)) {
      const groupTrans = groups[gId];
      
      // Sort ascending
      groupTrans.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Filter those that are >= today's date
      const futureOrTodayCount = groupTrans.filter(t => {
        const tTime = new Date(t.date).getTime();
        return tTime >= todayTime;
      }).length;

      // If there are zero future transactions left, the series has been cancelled, deleted, or naturally finished.
      if (futureOrTodayCount === 0) {
        console.log(`[checkAndExtend] Grupo ${gId} não possui lançamentos para hoje ou futuros (cancelado ou finalizado). Pulando.`);
        continue;
      }

      const needed = 36 - futureOrTodayCount;
      if (needed > 0) {
        console.log(`[checkAndExtend] Grupo ${gId} tem ${futureOrTodayCount} lançamentos futuros. Estendendo mais ${needed} lançamentos.`);
        const archetype = groupTrans[groupTrans.length - 1];
        const frequency = archetype.recurringFrequency || 'monthly';
        const lastDate = new Date(archetype.date);

        for (let i = 1; i <= needed; i++) {
          const nextDate = new Date(lastDate);
          if (frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + i);
          else if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + i * 7);
          else if (frequency === 'annually') nextDate.setFullYear(nextDate.getFullYear() + i);
          else nextDate.setMonth(nextDate.getMonth() + i);

          const newTransPayload = {
            uid,
            description: archetype.description || "",
            amount: archetype.amount || 0,
            type: archetype.type || "expense",
            category: archetype.category || "Outros",
            account: archetype.account || "",
            date: nextDate.toISOString(),
            isRecurringEntry: true,
            recurringGroup: archetype.recurringGroup,
            recurringFrequency: frequency,
            settled: false
          };

          await this.addTransaction(newTransPayload);
          extendedCount++;
        }
      }
    }

    return extendedCount;
  }
};
