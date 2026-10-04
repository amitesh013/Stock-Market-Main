import {
  collection, doc, setDoc, getDoc, getDocs,
  serverTimestamp, Timestamp, query, where, addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  COLLECTIONS, SESSION_SUBCOLLECTIONS, SESSION_META_DOCS,
  FICTIONAL_STOCKS, type Session, type SessionStatus
} from './shared-types';

function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function createSession(name: string, startingCash: number = 100000): Promise<Session> {
  let sessionCode = '';
  let isUnique = false;
  while (!isUnique) {
    sessionCode = generateSessionCode();
    const existing = await getDocs(
      query(collection(db, COLLECTIONS.SESSIONS), where('sessionCode', '==', sessionCode))
    );
    isUnique = existing.empty;
  }

  const sessionRef = doc(collection(db, COLLECTIONS.SESSIONS));
  const session: Omit<Session, 'id'> = {
    sessionCode,
    name,
    status: 'LOBBY',
    startingCash,
    createdAt: serverTimestamp(),
    startedAt: null,
    endedAt: null,
    activeNewsEventId: null,
    activeNewsEventExpiresAt: null,
    priceUpdateIntervalSeconds: 30,
  };
  await setDoc(sessionRef, session);
  return { id: sessionRef.id, ...session };
}

export async function getSessionByCode(code: string): Promise<Session | null> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.SESSIONS), where('sessionCode', '==', code.toUpperCase().trim()))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Session;
}

export async function seedSessionStocks(sessionId: string): Promise<number> {
  const stocksRef = collection(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.STOCKS);
  const existing = await getDocs(stocksRef);
  if (!existing.empty) return 0;

  const now = Date.now();
  const batch: Promise<void>[] = [];
  for (const stock of FICTIONAL_STOCKS) {
    const ref = doc(stocksRef);
    batch.push(setDoc(ref, {
      ...stock,
      lastUpdated: serverTimestamp(),
    }));
    // Seed initial price_history point
    const histRef = doc(collection(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.PRICE_HISTORY));
    batch.push(setDoc(histRef, {
      stockId: ref.id,
      ticker: stock.ticker,
      price: stock.currentPrice,
      timestamp: Timestamp.fromDate(new Date(now)),
      sessionId,
      activeNewsEventId: null,
    }));
  }
  await Promise.all(batch);
  return FICTIONAL_STOCKS.length;
}

export async function joinSession(
  sessionId: string,
  uid: string,
  displayName: string,
  startingCash: number
): Promise<void> {
  const portfolioRef = doc(
    db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.PORTFOLIOS, uid
  );
  const existing = await getDoc(portfolioRef);
  if (!existing.exists()) {
    await setDoc(portfolioRef, {
      uid,
      displayName,
      sessionId,
      currentCash: startingCash,
      startingCash,
      portfolioValue: startingCash,
      totalPnL: 0,
      totalPnLPercent: 0,
      lastUpdated: serverTimestamp(),
    });
  }

  // Update user's currentSessionId
  await setDoc(doc(db, COLLECTIONS.USERS, uid), {
    currentSessionId: sessionId,
  }, { merge: true });
}
