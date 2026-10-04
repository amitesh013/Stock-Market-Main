import { collection, doc, writeBatch, getDocs, getDoc, setDoc, serverTimestamp, Timestamp, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { nextPrice, toMillis, DEFAULT_LIQUIDITY, type SimStockConfig, type ActiveNews } from './priceEngine';

export interface DefaultStock {
  ticker: string;
  name: string;
  currentPrice: number;
  volatility: number; // Annualized equity volatility (e.g. 0.16 = 16% annual vol)
  sector: string;
  beta?: number;
  peRatio?: number;
  marketCap?: string;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  avgVolume?: number;
  isActive: boolean;
}

export const TECH_TITANS: DefaultStock[] = [
  { ticker: 'AAPL', name: 'Apple Inc.', currentPrice: 188.50, volatility: 0.20, sector: 'Technology', beta: 1.05, peRatio: 29.8, marketCap: '$2.88T', fiftyTwoWeekHigh: 199.62, fiftyTwoWeekLow: 164.08, avgVolume: 58000000, isActive: true },
  { ticker: 'MSFT', name: 'Microsoft Corp.', currentPrice: 418.30, volatility: 0.19, sector: 'Technology', beta: 0.92, peRatio: 34.2, marketCap: '$3.11T', fiftyTwoWeekHigh: 468.35, fiftyTwoWeekLow: 309.45, avgVolume: 21500000, isActive: true },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', currentPrice: 124.60, volatility: 0.38, sector: 'Semiconductors', beta: 1.68, peRatio: 42.1, marketCap: '$3.06T', fiftyTwoWeekHigh: 140.76, fiftyTwoWeekLow: 45.60, avgVolume: 74000000, isActive: true },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', currentPrice: 178.20, volatility: 0.23, sector: 'Communication Services', beta: 1.08, peRatio: 24.6, marketCap: '$2.21T', fiftyTwoWeekHigh: 191.75, fiftyTwoWeekLow: 129.40, avgVolume: 24000000, isActive: true },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', currentPrice: 185.90, volatility: 0.25, sector: 'Consumer Discretionary', beta: 1.15, peRatio: 38.4, marketCap: '$1.94T', fiftyTwoWeekHigh: 201.20, fiftyTwoWeekLow: 118.35, avgVolume: 35000000, isActive: true },
  { ticker: 'META', name: 'Meta Platforms Inc.', currentPrice: 512.40, volatility: 0.28, sector: 'Communication Services', beta: 1.22, peRatio: 26.5, marketCap: '$1.30T', fiftyTwoWeekHigh: 542.80, fiftyTwoWeekLow: 279.40, avgVolume: 16000000, isActive: true },
];

export const FINANCIAL_TITANS: DefaultStock[] = [
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', currentPrice: 198.40, volatility: 0.17, sector: 'Financials', beta: 1.10, peRatio: 11.8, marketCap: '$565B', fiftyTwoWeekHigh: 205.88, fiftyTwoWeekLow: 135.20, avgVolume: 9200000, isActive: true },
  { ticker: 'GS', name: 'Goldman Sachs Group Inc.', currentPrice: 472.10, volatility: 0.21, sector: 'Financials', beta: 1.30, peRatio: 14.2, marketCap: '$152B', fiftyTwoWeekHigh: 504.60, fiftyTwoWeekLow: 287.75, avgVolume: 2400000, isActive: true },
  { ticker: 'V', name: 'Visa Inc.', currentPrice: 274.50, volatility: 0.15, sector: 'Financials', beta: 0.88, peRatio: 28.1, marketCap: '$558B', fiftyTwoWeekHigh: 290.96, fiftyTwoWeekLow: 227.60, avgVolume: 5800000, isActive: true },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc.', currentPrice: 446.80, volatility: 0.13, sector: 'Financials', beta: 0.75, peRatio: 19.5, marketCap: '$970B', fiftyTwoWeekHigh: 452.10, fiftyTwoWeekLow: 338.40, avgVolume: 3100000, isActive: true },
];

export const HEALTHCARE_DEFENSIVE: DefaultStock[] = [
  { ticker: 'JNJ', name: 'Johnson & Johnson', currentPrice: 156.70, volatility: 0.12, sector: 'Healthcare', beta: 0.55, peRatio: 15.6, marketCap: '$377B', fiftyTwoWeekHigh: 175.97, fiftyTwoWeekLow: 143.15, avgVolume: 7100000, isActive: true },
  { ticker: 'LLY', name: 'Eli Lilly and Company', currentPrice: 915.20, volatility: 0.26, sector: 'Healthcare', beta: 0.72, peRatio: 62.4, marketCap: '$869B', fiftyTwoWeekHigh: 960.00, fiftyTwoWeekLow: 517.00, avgVolume: 3400000, isActive: true },
  { ticker: 'UNH', name: 'UnitedHealth Group Inc.', currentPrice: 538.60, volatility: 0.16, sector: 'Healthcare', beta: 0.65, peRatio: 22.8, marketCap: '$496B', fiftyTwoWeekHigh: 554.70, fiftyTwoWeekLow: 436.38, avgVolume: 3800000, isActive: true },
  { ticker: 'COST', name: 'Costco Wholesale Corp.', currentPrice: 852.30, volatility: 0.18, sector: 'Consumer Staples', beta: 0.78, peRatio: 48.2, marketCap: '$378B', fiftyTwoWeekHigh: 896.67, fiftyTwoWeekLow: 535.25, avgVolume: 2200000, isActive: true },
  { ticker: 'PG', name: 'Procter & Gamble Co.', currentPrice: 168.40, volatility: 0.11, sector: 'Consumer Staples', beta: 0.48, peRatio: 25.1, marketCap: '$395B', fiftyTwoWeekHigh: 172.90, fiftyTwoWeekLow: 141.45, avgVolume: 6400000, isActive: true },
];

export const ENERGY_INDUSTRIALS: DefaultStock[] = [
  { ticker: 'XOM', name: 'Exxon Mobil Corp.', currentPrice: 114.80, volatility: 0.22, sector: 'Energy', beta: 0.95, peRatio: 13.9, marketCap: '$455B', fiftyTwoWeekHigh: 123.75, fiftyTwoWeekLow: 95.77, avgVolume: 17000000, isActive: true },
  { ticker: 'CAT', name: 'Caterpillar Inc.', currentPrice: 342.10, volatility: 0.24, sector: 'Industrials', beta: 1.18, peRatio: 16.4, marketCap: '$165B', fiftyTwoWeekHigh: 382.40, fiftyTwoWeekLow: 223.22, avgVolume: 2900000, isActive: true },
  { ticker: 'BA', name: 'Boeing Company', currentPrice: 162.50, volatility: 0.32, sector: 'Industrials / Aerospace', beta: 1.42, peRatio: 31.0, marketCap: '$99B', fiftyTwoWeekHigh: 267.54, fiftyTwoWeekLow: 155.00, avgVolume: 6100000, isActive: true },
];

export const MARKET_ETFS: DefaultStock[] = [
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', currentPrice: 546.80, volatility: 0.14, sector: 'Index ETF', beta: 1.00, peRatio: 23.5, marketCap: '$570B', fiftyTwoWeekHigh: 565.16, fiftyTwoWeekLow: 410.07, avgVolume: 52000000, isActive: true },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq 100)', currentPrice: 472.90, volatility: 0.19, sector: 'Index ETF', beta: 1.18, peRatio: 29.2, marketCap: '$285B', fiftyTwoWeekHigh: 503.52, fiftyTwoWeekLow: 350.25, avgVolume: 41000000, isActive: true },
  { ticker: 'DIA', name: 'SPDR Dow Jones Industrial ETF', currentPrice: 408.20, volatility: 0.12, sector: 'Index ETF', beta: 0.85, peRatio: 20.8, marketCap: '$34B', fiftyTwoWeekHigh: 414.90, fiftyTwoWeekLow: 325.20, avgVolume: 3800000, isActive: true },
];

export const DEFAULT_STOCKS = [...TECH_TITANS, ...FINANCIAL_TITANS, ...MARKET_ETFS];

export const DEFAULT_NEWS = [
  {
    headline: 'US Inflation Moderates to 2.5%, Solidifying Federal Reserve Rate Cut Path',
    summary: 'Core CPI figures met Wall Street projections, easing bond yields and bolstering benchmark equity valuations.',
    ticker: 'ALL',
    sentiment: 'BULLISH',
    impact: 0.018,
  },
  {
    headline: 'Semiconductor Foundry Shipments Hit Record High on Enterprise Datacenter Demand',
    summary: 'Tier-1 cloud hyperscalers expanded advance wafer orders, reinforcing multi-quarter revenue outlooks.',
    ticker: 'NVDA',
    sentiment: 'BULLISH',
    impact: 0.024,
  },
  {
    headline: 'Federal Reserve Committee Affirms Resilient Liquidity Across Money Markets',
    summary: 'Chairman signaled policy stance is properly calibrated to foster sustainable non-inflationary economic expansion.',
    ticker: 'SPY',
    sentiment: 'BULLISH',
    impact: 0.012,
  },
  {
    headline: 'Investment Banking Advisory Fees Rebound on Robust Global M&A Activity',
    summary: 'Underwriting pipelines showed accelerated deal completion velocity across financial institutions.',
    ticker: 'JPM',
    sentiment: 'BULLISH',
    impact: 0.019,
  },
  {
    headline: 'Commercial Aviation Backlog Expands as Global Passenger Carrier Capacity Rises',
    summary: 'Airlines reported elevated load factors and confirmed additional wide-body aircraft delivery schedules.',
    ticker: 'BA',
    sentiment: 'BULLISH',
    impact: 0.021,
  },
  {
    headline: 'Enterprise Cloud Infrastructure Contracts Exceed Consensus Forecasts',
    summary: 'Software and compute consumption trends accelerated across fortune 500 enterprise customers.',
    ticker: 'MSFT',
    sentiment: 'BULLISH',
    impact: 0.016,
  }
];

/**
 * Completely purges all cryptocurrency documents from the database,
 * cleaning up any holdings or price history associated with them.
 */
export async function purgeAllCrypto() {
  const stocksRef = collection(db, 'stocks');
  const snap = await getDocs(stocksRef);

  const cryptoTickers = new Set(['BTC', 'ETH', 'SOL', 'DOGE', 'SHIB', 'XRP', 'ADA', 'AVAX', 'BNB']);
  const cryptoDocs: { id: string; ref: any; ticker: string; price: number }[] = [];

  snap.docs.forEach((d) => {
    const data = d.data();
    const ticker = (data.ticker || '').trim().toUpperCase();
    const sector = (data.sector || '').trim();
    if (cryptoTickers.has(ticker) || sector.toLowerCase().includes('crypto')) {
      cryptoDocs.push({
        id: d.id,
        ref: d.ref,
        ticker,
        price: Number(data.currentPrice) || 0,
      });
    }
  });

  if (cryptoDocs.length === 0) {
    return { purgedCount: 0 };
  }

  const batch = writeBatch(db);

  // 1. Clean up holdings for these crypto assets and refund cash if any
  for (const cDoc of cryptoDocs) {
    const holdingsSnap = await getDocs(query(collection(db, 'holdings'), where('stockId', '==', cDoc.id)));
    for (const hDoc of holdingsSnap.docs) {
      const hData = hDoc.data();
      const refund = (Number(hData.quantity) || 0) * (cDoc.price || Number(hData.averageBuyPrice) || 0);
      if (refund > 0 && hData.userId) {
        const uSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', hData.userId)));
        if (!uSnap.empty) {
          const uDoc = uSnap.docs[0];
          const curCash = Number(uDoc.data().currentCash) || 0;
          batch.update(uDoc.ref, {
            currentCash: Math.round((curCash + refund) * 100) / 100,
          });
        }
      }
      batch.delete(hDoc.ref);
    }

    // 2. Clean up price history points
    const histSnap = await getDocs(query(collection(db, 'price_history'), where('stockId', '==', cDoc.id)));
    histSnap.docs.forEach((hd) => batch.delete(hd.ref));

    // 3. Delete the crypto stock document
    batch.delete(cDoc.ref);
  }

  await batch.commit();
  console.log(`Successfully purged ${cryptoDocs.length} crypto assets from database.`);
  return { purgedCount: cryptoDocs.length };
}

export async function seedStockPreset(presetList: DefaultStock[]) {
  const stocksRef = collection(db, 'stocks');
  const existingSnap = await getDocs(stocksRef);
  const existingTickers = new Set(existingSnap.docs.map(d => (d.data().ticker || '').trim().toUpperCase()));

  const batch = writeBatch(db);
  let added = 0;
  const now = Date.now();

  // Try to fetch real quotes for preset symbols
  const tickersToFetch = presetList.map(s => s.ticker);
  let liveQuoteMap: Record<string, any> = {};
  try {
    const res = await fetch(`/api/stocks/quotes?symbols=${encodeURIComponent(tickersToFetch.join(','))}`);
    if (res.ok) {
      const qData = await res.json();
      (qData.quotes || []).forEach((q: any) => {
        liveQuoteMap[q.symbol.toUpperCase()] = q;
        liveQuoteMap[q.symbol.replace(/-/g, '.').toUpperCase()] = q;
      });
    }
  } catch {
    // Fallback to presets if server is spinning up
  }

  for (const stock of presetList) {
    const normTicker = stock.ticker.trim().toUpperCase();
    if (!existingTickers.has(normTicker)) {
      const newRef = doc(stocksRef);
      const liveQuote = liveQuoteMap[normTicker];

      const currentPrice = liveQuote?.price || stock.currentPrice;
      const dayOpenPrice = liveQuote?.previousClose || Math.round(currentPrice * 0.996 * 100) / 100;
      const change = liveQuote ? liveQuote.change : Math.round((currentPrice - dayOpenPrice) * 100) / 100;
      const changePercent = liveQuote ? liveQuote.changePercent : (dayOpenPrice > 0 ? Math.round((change / dayOpenPrice) * 10000) / 100 : 0);
      const spread = 0.02;
      const bid = Math.round((currentPrice - spread / 2) * 100) / 100;
      const ask = Math.round((currentPrice + spread / 2) * 100) / 100;
      const dayHigh = liveQuote?.dayHigh || Math.max(currentPrice, dayOpenPrice * 1.006);
      const dayLow = liveQuote?.dayLow || Math.min(currentPrice, dayOpenPrice * 0.994);
      const sessionVolume = liveQuote?.volume || Math.floor(Math.random() * 850000) + 150000;
      const vwap = Math.round(((dayOpenPrice + currentPrice + dayHigh + dayLow) / 4) * 100) / 100;

      batch.set(newRef, {
        ...stock,
        name: liveQuote?.name || stock.name,
        ticker: normTicker,
        currentPrice,
        dayOpenPrice,
        dayHigh: Math.round(dayHigh * 100) / 100,
        dayLow: Math.round(dayLow * 100) / 100,
        change,
        changePercent,
        bid,
        ask,
        spread,
        sessionVolume,
        vwap,
        beta: stock.beta || 1.0,
        peRatio: stock.peRatio || 22.0,
        marketCap: stock.marketCap || '$100B',
        fiftyTwoWeekHigh: liveQuote?.fiftyTwoWeekHigh || stock.fiftyTwoWeekHigh || Math.round(currentPrice * 1.18 * 100) / 100,
        fiftyTwoWeekLow: liveQuote?.fiftyTwoWeekLow || stock.fiftyTwoWeekLow || Math.round(currentPrice * 0.82 * 100) / 100,
        avgVolume: stock.avgVolume || 12000000,
        trend: 0,
        isRealFeed: true,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      });

      existingTickers.add(normTicker);

      // Add baseline history point
      const historyRef = doc(collection(db, 'price_history'));
      batch.set(historyRef, {
        stockId: newRef.id,
        price: currentPrice,
        timestamp: Timestamp.fromDate(new Date(now)),
      });
      added++;
    }
  }

  if (added > 0) {
    await batch.commit();
  }
  return added;
}

// ---------- M2: session support ----------
// Everything for one session lives under sessions/{sessionId}/<collection>.
// With no sessionId the old global collections are used, so existing code keeps working.
// If TL1 picks a different layout, only these two helpers need to change.
const sCol = (sessionId: string | undefined, name: string) =>
  sessionId ? collection(db, 'sessions', sessionId, name) : collection(db, name);
const sDoc = (sessionId: string | undefined, col: string, id: string) =>
  sessionId ? doc(db, 'sessions', sessionId, col, id) : doc(db, col, id);

/**
 * Creates a brand-new market for one session: its own stocks at the preset's initial prices
 * (never copied from another session), a first price-history point, and its own config.
 * Does nothing if the session already has stocks.
 */
export async function createSessionMarket(
  sessionId: string,
  presetList: DefaultStock[] = DEFAULT_STOCKS
): Promise<number> {
  const stocksRef = sCol(sessionId, 'stocks');
  const existing = await getDocs(stocksRef);
  if (!existing.empty) return 0;

  const batch = writeBatch(db);
  const spread = 0.02;
  presetList.forEach((stock) => {
    const ref = doc(stocksRef);
    const price = stock.currentPrice;
    batch.set(ref, {
      ...stock,
      ticker: stock.ticker.trim().toUpperCase(),
      currentPrice: price,
      dayOpenPrice: price,
      dayHigh: price,
      dayLow: price,
      change: 0,
      changePercent: 0,
      bid: Math.round((price - spread / 2) * 100) / 100,
      ask: Math.round((price + spread / 2) * 100) / 100,
      spread,
      trend: 0,
      isActive: true,
      isRealFeed: false,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });
    batch.set(doc(sCol(sessionId, 'price_history')), {
      stockId: ref.id,
      price,
      timestamp: Timestamp.now(),
    });
  });
  batch.set(sDoc(sessionId, 'simulation', 'config'), {
    status: 'NOT_STARTED',
    isRealMarketFeed: false,
    feedStatus: 'SIMULATED_MARKET',
    priceUpdateIntervalSeconds: 10,
    startingBalanceAmount: 100000,
    createdAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  return presetList.length;
}

/**
 * M2: simulated market tick. Keeps the old name so SimulationEngine, Watchlist and AdminPanel
 * keep working. Instead of fetching real quotes, it computes every price with nextPrice().
 * With a sessionId it only touches sessions/{sessionId}/...; without one it behaves as before (global).
 */
export async function syncLiveMarketPrices(sessionId?: string): Promise<{ updatedCount: number; timestamp: number }> {
  const stocksRef = sCol(sessionId, 'stocks');
  const stocksSnap = await getDocs(query(stocksRef, where('isActive', '==', true)));
  if (stocksSnap.empty) return { updatedCount: 0, timestamp: Date.now() };

  const nowMs = Date.now();
  const configSnap = await getDoc(sDoc(sessionId, 'simulation', 'config'));
  const config: any = configSnap.data() || {};
  const tickMs = Math.max(5, config.priceUpdateIntervalSeconds || 10) * 1000;

  // Two tabs must not both move the price in the same tick.
  const lastTickMs = Number(config.lastEngineTickMs) || nowMs - tickMs;
  if (nowMs - lastTickMs < tickMs * 0.5) return { updatedCount: 0, timestamp: nowMs };

  // Active news event (written by the admin panel): { targetPct, startedAt, endsAt }
  let news: ActiveNews | null = null;
  const ev = config.activeEvent;
  if (ev && ev.targetPct) {
    const startedAt = toMillis(ev.startedAt);
    const endsAt = toMillis(ev.endsAt);
    // keep the event for the one tick that crosses endsAt so its full effect is applied
    if (endsAt > startedAt && lastTickMs < endsAt) {
      news = { targetPct: ev.targetPct, startedAt, endsAt };
    }
  }

  // Buying / selling pressure since the last tick
  const txSnap = await getDocs(
    query(sCol(sessionId, 'transactions'), where('timestamp', '>', Timestamp.fromMillis(lastTickMs)))
  );
  const pressure: Record<string, number> = {};
  txSnap.docs.forEach((t) => {
    const d: any = t.data();
    const sign = d.type === 'BUY' ? 1 : -1;
    pressure[d.stockId] = (pressure[d.stockId] || 0) + sign * (Number(d.quantity) || 0);
  });

  const batch = writeBatch(db);
  const ts = serverTimestamp();
  const currentPriceMap: Record<string, number> = {};
  let updatedCount = 0;

  stocksSnap.docs.forEach((sd) => {
    const stock: any = sd.data();
    const ticker = (stock.ticker || '').trim().toUpperCase();
    const oldPrice = Number(stock.currentPrice);
    if (!ticker || !oldPrice || oldPrice <= 0) return;

    const cfg: SimStockConfig = {
      ticker,
      volatility: Number(stock.volatility) || 0.2,
      liquidity: Number(stock.liquidity) || DEFAULT_LIQUIDITY,
    };
    const price = nextPrice(oldPrice, cfg, pressure[sd.id] || 0, news, lastTickMs, nowMs);
    currentPriceMap[sd.id] = price;

    const open = Number(stock.dayOpenPrice) || oldPrice;
    const change = Math.round((price - open) * 100) / 100;
    const spread = 0.02;

    batch.update(sd.ref, {
      currentPrice: price,
      dayOpenPrice: open,
      change,
      changePercent: open > 0 ? Math.round((change / open) * 10000) / 100 : 0,
      dayHigh: Math.max(Number(stock.dayHigh) || price, price),
      dayLow: Math.min(Number(stock.dayLow) || price, price),
      bid: Math.round((price - spread / 2) * 100) / 100,
      ask: Math.round((price + spread / 2) * 100) / 100,
      spread,
      isRealFeed: false,
      lastUpdated: ts,
    });

    batch.set(doc(sCol(sessionId, 'price_history')), { stockId: sd.id, price, timestamp: ts });
    updatedCount++;
  });

  if (updatedCount > 0) {
    // Re-evaluate every participant's portfolio value (same as before)
    const usersSnap = await getDocs(sCol(sessionId, 'users'));
    const holdingsSnap = await getDocs(sCol(sessionId, 'holdings'));
    const holdingsValue: Record<string, number> = {};
    holdingsSnap.docs.forEach((h) => {
      const hd: any = h.data();
      const p = currentPriceMap[hd.stockId];
      if (p && hd.quantity > 0) holdingsValue[hd.userId] = (holdingsValue[hd.userId] || 0) + hd.quantity * p;
    });
    usersSnap.docs.forEach((u) => {
      const cash = Number((u.data() as any).currentCash) || 0;
      batch.update(u.ref, { portfolioValue: Math.round((cash + (holdingsValue[u.id] || 0)) * 100) / 100 });
    });

    batch.set(sDoc(sessionId, 'simulation', 'config'), {
      lastEngineTickMs: nowMs,
      lastLiveSync: ts,
      isRealMarketFeed: false,
      feedStatus: 'SIMULATED_MARKET',
    }, { merge: true });

    await batch.commit();
  }

  return { updatedCount, timestamp: nowMs };
}

export async function deduplicateAndCleanStocks() {
  const stocksRef = collection(db, 'stocks');
  const snap = await getDocs(stocksRef);
  const byTicker = new Map<string, any[]>();

  snap.docs.forEach(d => {
    const data = d.data();
    const ticker = (data.ticker || '').trim().toUpperCase();
    if (!ticker) return;
    if (!byTicker.has(ticker)) byTicker.set(ticker, []);
    byTicker.get(ticker)!.push({ id: d.id, ref: d.ref, ...data });
  });

  const batch = writeBatch(db);
  let removedCount = 0;

  for (const [ticker, list] of byTicker.entries()) {
    if (list.length > 1) {
      list.sort((a, b) => {
        const timeA = a.lastUpdated?.seconds || a.createdAt?.seconds || 0;
        const timeB = b.lastUpdated?.seconds || b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      for (let i = 1; i < list.length; i++) {
        batch.delete(list[i].ref);
        removedCount++;
      }
    }
  }

  if (removedCount > 0) {
    await batch.commit();
  }
  return removedCount;
}

export async function seedDefaultStocks() {
  // First, purge any stray crypto assets from database
  await purgeAllCrypto();
  const count = await seedStockPreset(DEFAULT_STOCKS);
  await seedDefaultNews();
  return count;
}

export async function seedDefaultNews() {
  const newsRef = collection(db, 'news');
  const existingSnap = await getDocs(newsRef);
  if (!existingSnap.empty) return 0;

  const batch = writeBatch(db);
  const now = Date.now();

  DEFAULT_NEWS.forEach((item, index) => {
    const newDoc = doc(newsRef);
    batch.set(newDoc, {
      ...item,
      timestamp: Timestamp.fromDate(new Date(now - (index * 120000))),
    });
  });

  await batch.commit();
  return DEFAULT_NEWS.length;
}

export async function resetSimulationState(startingCashAmount = 100000) {
  // 1. Reset simulation config
  await setDoc(doc(db, 'simulation', 'config'), {
    status: 'NOT_STARTED',
    startingBalanceAmount: startingCashAmount,
    priceUpdateIntervalSeconds: 3,
    marketRegime: 'NORMAL',
    lastResetAt: serverTimestamp(),
  });

  // 2. Clear all holdings
  const holdingsSnap = await getDocs(collection(db, 'holdings'));
  const batchH = writeBatch(db);
  holdingsSnap.forEach(h => batchH.delete(h.ref));
  await batchH.commit();

  // 3. Clear all transactions
  const txSnap = await getDocs(collection(db, 'transactions'));
  const batchT = writeBatch(db);
  txSnap.forEach(t => batchT.delete(t.ref));
  await batchT.commit();

  // 4. Reset users cash and portfolio values
  const usersSnap = await getDocs(collection(db, 'users'));
  const batchU = writeBatch(db);
  usersSnap.forEach(u => {
    batchU.update(u.ref, {
      currentCash: startingCashAmount,
      portfolioValue: startingCashAmount,
      startingBalance: startingCashAmount,
    });
  });
  await batchU.commit();
}
