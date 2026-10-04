import {
  collection, doc, setDoc, getDoc, getDocs,
  serverTimestamp, Timestamp, query, where, addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  COLLECTIONS, SESSION_SUBCOLLECTIONS, SESSION_META_DOCS,
  FICTIONAL_STOCKS, type Session, type SessionStatus
} from './shared-types';

interface YahooQuote {
  symbol?: string;
  price?: number;
}

export async function fetchYahooReferencePrices(): Promise<Map<string, number>> {
  const symbols = FICTIONAL_STOCKS.map(stock => stock.yahooSymbol).join(',');
  const prices = new Map<string, number>();

  try {
    const response = await fetch(`/api/stocks/quotes?symbols=${encodeURIComponent(symbols)}`);
    if (!response.ok) throw new Error(`Yahoo quotes returned HTTP ${response.status}`);

    const payload = await response.json() as { quotes?: YahooQuote[] };
    for (const quote of payload.quotes || []) {
      const symbol = quote.symbol?.replace(/\./g, '-').toUpperCase();
      const price = Number(quote.price);
      if (symbol && Number.isFinite(price) && price > 0) {
        prices.set(symbol, price);
      }
    }
  } catch (error) {
    console.error('Yahoo reference price fetch failed; using fallback prices.', error);
  }

  return prices;
}

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

export async function seedSessionStocks(sessionId: string, refreshReference = false): Promise<number> {
  const stocksRef = collection(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.STOCKS);
  const existing = await getDocs(stocksRef);
  if (!existing.empty && !refreshReference) return 0;

  const now = Date.now();
  const batch: Promise<void>[] = [];
  const yahooPrices = await fetchYahooReferencePrices();

  for (const stock of FICTIONAL_STOCKS) {
    const existingDoc = existing.docs.find(d => d.data()?.ticker === stock.ticker);
    const ref = existingDoc?.ref || doc(stocksRef);
    const yahooPrice = yahooPrices.get(stock.yahooSymbol);
    const referencePrice = yahooPrice || stock.currentPrice;
    const stockState = {
      ...stock,
      currentPrice: referencePrice,
      initialPrice: referencePrice,
      dayOpenPrice: referencePrice,
      referencePrice,
      source: yahooPrice ? 'Yahoo Finance' : 'Fallback price (Yahoo unavailable)',
      lastYahooSync: yahooPrice ? serverTimestamp() : null,
      lastUpdated: serverTimestamp(),
    };

    batch.push(setDoc(ref, stockState, { merge: Boolean(existingDoc) }));
    // Seed initial price_history point
    const histRef = doc(collection(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.PRICE_HISTORY));
    batch.push(setDoc(histRef, {
      stockId: ref.id,
      ticker: stock.ticker,
      price: referencePrice,
      timestamp: Timestamp.fromDate(new Date(now)),
      sessionId,
      activeNewsEventId: null,
    }));
  }
  await Promise.all(batch);
  return existing.empty ? FICTIONAL_STOCKS.length : 0;
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
