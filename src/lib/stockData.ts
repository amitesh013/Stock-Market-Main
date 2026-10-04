import { collection, doc, writeBatch, getDocs, setDoc, serverTimestamp, Timestamp, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { FICTIONAL_STOCKS, LEGACY_COLLECTIONS as COLLECTIONS, SIMULATION_DOCS } from './shared-types';
import { fetchYahooReferencePrices } from './sessionManager';

// DefaultStock removed — fictional stocks use FICTIONAL_STOCKS from shared-types

// Re-export fictional stocks as DEFAULT_STOCKS so existing imports still work
export const DEFAULT_STOCKS = FICTIONAL_STOCKS;

// Keep these exports so AdminPanel imports don't break
export const TECH_TITANS = FICTIONAL_STOCKS.filter(s => s.sector === 'Technology');
export const FINANCIAL_TITANS = FICTIONAL_STOCKS.filter(s => s.sector === 'Finance' || s.sector === 'Banking');
export const HEALTHCARE_DEFENSIVE = FICTIONAL_STOCKS.filter(s => s.sector === 'Pharmaceuticals');
export const MARKET_ETFS: any[] = []; // No ETFs in the new fictional setup

export const DEFAULT_NEWS = [
  {
    headline: 'FinQuest Market Simulation — Live Trading Now Open',
    summary: 'All 8 fictional companies are now available for trading. Watch for news events that will create market opportunities.',
    ticker: 'ALL',
    sentiment: 'BULLISH',
    impact: 0.01,
  },
];

/**
 * Seeds the legacy stock view with Yahoo reference prices when available.
 * Session competitions use seedSessionStocks in sessionManager.
 */
export async function seedDefaultStocks() {
  const stocksRef = collection(db, COLLECTIONS.STOCKS);
  const existingSnap = await getDocs(stocksRef);
  const existingTickers = new Set(existingSnap.docs.map(d => (d.data().ticker || '').trim().toUpperCase()));

  const batch = writeBatch(db);
  let added = 0;
  const now = Date.now();
  const yahooPrices = await fetchYahooReferencePrices();

  for (const stock of FICTIONAL_STOCKS) {
    const normTicker = stock.ticker.trim().toUpperCase();
    if (!existingTickers.has(normTicker)) {
      const newRef = doc(stocksRef);
      const price = yahooPrices.get(stock.yahooSymbol) || stock.currentPrice;
      const spread = 0.02;

      batch.set(newRef, {
        ticker: normTicker,
        yahooSymbol: stock.yahooSymbol,
        name: stock.name,
        sector: stock.sector,
        currentPrice: price,
        initialPrice: price,
        dayOpenPrice: price,
        change: 0,
        changePercent: 0,
        volatility: stock.volatility,
        newsSensitivity: stock.newsSensitivity,
        bid: Math.round((price - spread / 2) * 100) / 100,
        ask: Math.round((price + spread / 2) * 100) / 100,
        spread,
        dayHigh: price,
        dayLow: price,
        sessionVolume: 0,
        isActive: true,
        source: yahooPrices.has(stock.yahooSymbol) ? 'Yahoo Finance' : 'Fallback price (Yahoo unavailable)',
        referencePrice: price,
        lastYahooSync: yahooPrices.has(stock.yahooSymbol) ? serverTimestamp() : null,
        isRealFeed: yahooPrices.has(stock.yahooSymbol),
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      });

      // Baseline price history entry
      const historyRef = doc(collection(db, COLLECTIONS.PRICE_HISTORY));
      batch.set(historyRef, {
        stockId: newRef.id,
        ticker: normTicker,
        price,
        timestamp: Timestamp.fromDate(new Date(now)),
        activeNewsEventId: null,
      });

      existingTickers.add(normTicker);
      added++;
    }
  }

  if (added > 0) {
    await batch.commit();
    console.log(`Seeded ${added} fictional stocks.`);
  }

  await seedDefaultNews();
  return added;
}

export async function seedDefaultNews() {
  const newsRef = collection(db, COLLECTIONS.NEWS);
  const existingSnap = await getDocs(newsRef);
  if (!existingSnap.empty) return 0;

  const batch = writeBatch(db);
  DEFAULT_NEWS.forEach((item, index) => {
    const newDoc = doc(newsRef);
    batch.set(newDoc, {
      ...item,
      timestamp: Timestamp.fromDate(new Date(Date.now() - index * 120000)),
    });
  });
  await batch.commit();
  return DEFAULT_NEWS.length;
}

/**
 * No-op kept for backward compatibility — no crypto in fictional setup.
 */
export async function purgeAllCrypto() {
  return { purgedCount: 0 };
}

/**
 * Session prices are intentionally not overwritten by quote refreshes.
 * Keep this compatibility function for the legacy watchlist controls.
 */
export async function syncLiveMarketPrices(): Promise<{ updatedCount: number; timestamp: number }> {
  return { updatedCount: 0, timestamp: Date.now() };
}

export async function deduplicateAndCleanStocks() {
  const stocksRef = collection(db, COLLECTIONS.STOCKS);
  const snap = await getDocs(stocksRef);
  const byTicker = new Map<string, any[]>();

  snap.docs.forEach(d => {
    const ticker = (d.data().ticker || '').trim().toUpperCase();
    if (!ticker) return;
    if (!byTicker.has(ticker)) byTicker.set(ticker, []);
    byTicker.get(ticker)!.push({ id: d.id, ref: d.ref, ...d.data() });
  });

  const batch = writeBatch(db);
  let removedCount = 0;

  for (const [, list] of byTicker.entries()) {
    if (list.length > 1) {
      list.sort((a, b) => (b.lastUpdated?.seconds || 0) - (a.lastUpdated?.seconds || 0));
      for (let i = 1; i < list.length; i++) {
        batch.delete(list[i].ref);
        removedCount++;
      }
    }
  }

  if (removedCount > 0) await batch.commit();
  return removedCount;
}

export async function seedStockPreset(presetList: any[]) {
  return seedDefaultStocks();
}

export async function resetSimulationState(startingCashAmount = 100000) {
  await setDoc(doc(db, COLLECTIONS.SIMULATION, SIMULATION_DOCS.CONFIG), {
    status: 'NOT_STARTED',
    startingBalanceAmount: startingCashAmount,
    priceUpdateIntervalSeconds: 5,
    activeNewsEventId: null,
    activeNewsEventExpiresAt: null,
    lastResetAt: serverTimestamp(),
  });

  // Reset active event
  await setDoc(doc(db, COLLECTIONS.SIMULATION, SIMULATION_DOCS.ACTIVE_EVENT), {
    isExpired: true,
  });

  // Clear holdings
  const holdingsSnap = await getDocs(collection(db, COLLECTIONS.HOLDINGS));
  const bH = writeBatch(db);
  holdingsSnap.forEach(h => bH.delete(h.ref));
  await bH.commit();

  // Clear transactions
  const txSnap = await getDocs(collection(db, COLLECTIONS.TRANSACTIONS));
  const bT = writeBatch(db);
  txSnap.forEach(t => bT.delete(t.ref));
  await bT.commit();

  // Reset users
  const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
  const bU = writeBatch(db);
  usersSnap.forEach(u => {
    bU.update(u.ref, {
      currentCash: startingCashAmount,
      portfolioValue: startingCashAmount,
      startingBalance: startingCashAmount,
    });
  });
  await bU.commit();

  // Reset stock prices back to initial prices
  const stocksSnap = await getDocs(collection(db, COLLECTIONS.STOCKS));
  const bS = writeBatch(db);
  stocksSnap.forEach(s => {
    const data = s.data();
    const initialPrice = data.initialPrice || data.currentPrice;
    bS.update(s.ref, {
      currentPrice: initialPrice,
      dayOpenPrice: initialPrice,
      change: 0,
      changePercent: 0,
      dayHigh: initialPrice,
      dayLow: initialPrice,
      lastUpdated: serverTimestamp(),
    });
  });
  await bS.commit();
}
