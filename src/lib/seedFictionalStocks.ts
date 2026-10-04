import {
  collection, getDocs, writeBatch, doc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { FICTIONAL_STOCKS } from './shared-types';
import { fetchYahooReferencePrices } from './sessionManager';
// Note: standalone seeder replaced by sessionManager.seedSessionStocks()

export async function seedFictionalStocks(): Promise<number> {
  const stocksRef = collection(db, 'stocks');
  const existingSnap = await getDocs(stocksRef);
  const existingTickers = new Set(
    existingSnap.docs.map(d => (d.data().ticker || '').toUpperCase())
  );

  const toAdd = FICTIONAL_STOCKS.filter(
    s => !existingTickers.has(s.ticker.toUpperCase())
  );
  if (toAdd.length === 0) return 0;

  const batch = writeBatch(db);
  const now = Date.now();
  const yahooPrices = await fetchYahooReferencePrices();

  for (const stock of toAdd) {
    const ref = doc(stocksRef);
    const price = yahooPrices.get(stock.yahooSymbol) || stock.currentPrice;
    batch.set(ref, {
      ...stock,
      currentPrice: price,
      initialPrice: price,
      referencePrice: price,
      dayOpenPrice: price,
      dayHigh: price,
      dayLow: price,
      change: 0,
      changePercent: 0,
      trend: 0,
      isActive: true,
      source: yahooPrices.has(stock.yahooSymbol) ? 'Yahoo Finance' : 'Fallback price (Yahoo unavailable)',
      lastYahooSync: yahooPrices.has(stock.yahooSymbol) ? serverTimestamp() : null,
      isRealFeed: yahooPrices.has(stock.yahooSymbol),
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });

    const histRef = doc(collection(db, 'price_history'));
    batch.set(histRef, {
      stockId: ref.id,
      ticker: stock.ticker,
      price,
      timestamp: Timestamp.fromDate(new Date(now)),
      activeNewsEventId: null,
    });
  }

  await batch.commit();
  return toAdd.length;
}
