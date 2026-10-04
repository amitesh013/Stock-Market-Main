import {
  collection, getDocs, writeBatch, doc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { FICTIONAL_STOCKS, COLLECTIONS } from './shared-types';
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

  for (const stock of toAdd) {
    const ref = doc(stocksRef);
    batch.set(ref, {
      ...stock,
      dayOpenPrice: stock.currentPrice,
      dayHigh: stock.currentPrice,
      dayLow: stock.currentPrice,
      change: 0,
      changePercent: 0,
      trend: 0,
      isActive: true,
      isRealFeed: false,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });

    const histRef = doc(collection(db, 'price_history'));
    batch.set(histRef, {
      stockId: ref.id,
      ticker: stock.ticker,
      price: stock.currentPrice,
      timestamp: Timestamp.fromDate(new Date(now)),
      activeNewsEventId: null,
    });
  }

  await batch.commit();
  return toAdd.length;
}
