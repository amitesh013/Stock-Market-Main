import React, { useEffect, useState, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { useSession } from '../lib/SessionContext';
import { COLLECTIONS, SESSION_SUBCOLLECTIONS } from '../lib/shared-types';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Sparkles,
  Play,
  Activity,
  Zap,
  BarChart2,
  LayoutGrid,
  Table as TableIcon,
  ArrowUpDown,
  Flame,
  Clock,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  X
} from 'lucide-react';
import { seedDefaultStocks, syncLiveMarketPrices } from '../lib/stockData';
import Sparkline from './Sparkline';

interface WatchlistProps {
  simulationStatus: string;
  onOpenStockChart: (stock: any) => void;
}

// Currency formatter with thousand separators
function formatUSD(val: number): string {
  if (isNaN(val)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export default function Watchlist({ simulationStatus, onOpenStockChart }: WatchlistProps) {
  const { userData } = useAuth();
  const { sessionId } = useSession();
  const [stocks, setStocks] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [sortBy, setSortBy] = useState<'GAINERS' | 'LOSERS' | 'PRICE_HIGH' | 'PRICE_LOW' | 'ALPHA'>('GAINERS');
  const [viewMode, setViewMode] = useState<'TABLE' | 'GRID'>('TABLE');
  const [seeding, setSeeding] = useState(false);

  // Price history cache for mini sparklines
  const [priceHistoryMap, setPriceHistoryMap] = useState<Record<string, number[]>>({});
  // Price tick flash state: 'up' | 'down'
  const [tickFlash, setTickFlash] = useState<Record<string, 'up' | 'down'>>({});
  const prevPricesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!sessionId) { setStocks([]); return; }
    const q = query(collection(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.STOCKS), where('isActive', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      const rawList: any[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter((s: any) => !((s.sector || '').toLowerCase().includes('crypto')));

      // 1. Deduplicate by uppercase ticker
      const tickerMap = new Map<string, any>();
      rawList.forEach((s) => {
        const normTicker = (s.ticker || '').trim().toUpperCase();
        if (!normTicker) return;
        const existing = tickerMap.get(normTicker);
        if (!existing) {
          tickerMap.set(normTicker, s);
        } else {
          // Keep the one with the latest update or highest price
          const timeA = s.lastUpdated?.seconds || s.createdAt?.seconds || 0;
          const timeB = existing.lastUpdated?.seconds || existing.createdAt?.seconds || 0;
          if (timeA >= timeB) {
            tickerMap.set(normTicker, s);
          }
        }
      });
      const uniqueStocks = Array.from(tickerMap.values());

      // 2. Update price history cache & tick flashes
      const newHistory = { ...priceHistoryMap };
      const newFlash: Record<string, 'up' | 'down'> = {};

      uniqueStocks.forEach((s) => {
        const p = Number(s.currentPrice) || 0;
        const prevP = prevPricesRef.current[s.id];

        if (prevP !== undefined && prevP !== p) {
          newFlash[s.id] = p > prevP ? 'up' : 'down';
        }
        prevPricesRef.current[s.id] = p;

        // Maintain array of recent prices
        const curArr = newHistory[s.id] || [];
        if (curArr.length === 0) {
          // Synthesize initial curve around open price
          const dayOpen = Number(s.dayOpenPrice || s.basePrice || p * 0.985);
          const initialCurve: number[] = [];
          for (let i = 0; i < 8; i++) {
            const step = dayOpen + (p - dayOpen) * (i / 7) + (Math.random() - 0.5) * (p * 0.008);
            initialCurve.push(Math.round(step * 100) / 100);
          }
          newHistory[s.id] = initialCurve;
        } else if (curArr[curArr.length - 1] !== p) {
          const updatedArr = [...curArr, p];
          if (updatedArr.length > 20) updatedArr.shift();
          newHistory[s.id] = updatedArr;
        }
      });

      setPriceHistoryMap(newHistory);
      setStocks(uniqueStocks);

      if (Object.keys(newFlash).length > 0) {
        setTickFlash((cur) => ({ ...cur, ...newFlash }));
        setTimeout(() => {
          setTickFlash({});
        }, 800);
      }
    });

    return () => unsub();
  }, [sessionId]);

  const handleQuickSeed = async () => {
    setSeeding(true);
    try {
      await seedDefaultStocks();
    } catch (e) {
      console.error('Seed error:', e);
    } finally {
      setSeeding(false);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshLiveQuotes = async () => {
    setIsRefreshing(true);
    try {
      await syncLiveMarketPrices();
    } catch (err) {
      console.warn('Real market sync notice:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleQuickStartSim = async () => {
    try {
      await setDoc(
        doc(db, 'simulation', 'config'),
        {
          status: 'RUNNING',
          startTime: serverTimestamp(),
          startingBalanceAmount: 100000,
          priceUpdateIntervalSeconds: 10,
          isRealMarketFeed: true,
          feedStatus: 'LIVE_EXCHANGE_CONNECTED',
        },
        { merge: true }
      );
      await syncLiveMarketPrices().catch(() => {});
    } catch (e) {
      console.error('Quick start sim error:', e);
    }
  };

  // Enriched stock computations
  const enrichedStocks = useMemo(() => {
    return stocks.map((s) => {
      const currentPrice = Number(s.currentPrice) || 0;
      const dayOpen = Number(s.dayOpenPrice || s.basePrice || s.startingPrice || currentPrice);
      const dayHigh = Number(s.dayHigh) || Math.max(currentPrice, dayOpen);
      const dayLow = Number(s.dayLow) || Math.min(currentPrice, dayOpen);

      const change = s.change !== undefined ? Number(s.change) : Math.round((currentPrice - dayOpen) * 100) / 100;
      const changePercent =
        s.changePercent !== undefined
          ? Number(s.changePercent)
          : dayOpen > 0
          ? Math.round(((currentPrice - dayOpen) / dayOpen) * 10000) / 100
          : 0;

      const isUp = change >= 0;
      const history = priceHistoryMap[s.id] || [dayOpen, currentPrice];

      // Position in day range: 0% = dayLow, 100% = dayHigh
      const rangeSpan = dayHigh - dayLow;
      const rangePosition = rangeSpan > 0 ? Math.max(0, Math.min(100, ((currentPrice - dayLow) / rangeSpan) * 100)) : 50;

      return {
        ...s,
        currentPrice,
        dayOpen,
        dayHigh,
        dayLow,
        change,
        changePercent,
        isUp,
        history,
        rangePosition,
      };
    });
  }, [stocks, priceHistoryMap]);

  // Sector list with counts
  const sectors = useMemo(() => {
    const map = new Map<string, number>();
    enrichedStocks.forEach((s) => {
      const sec = s.sector || 'Equities';
      map.set(sec, (map.get(sec) || 0) + 1);
    });
    return [
      { name: 'ALL', count: enrichedStocks.length },
      ...Array.from(map.entries()).map(([name, count]) => ({ name, count })),
    ];
  }, [enrichedStocks]);

  // Filter & Sort
  const filteredStocks = useMemo(() => {
    let list = enrichedStocks.filter((s) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        s.ticker?.toLowerCase().includes(term) ||
        s.name?.toLowerCase().includes(term) ||
        s.sector?.toLowerCase().includes(term);
      const matchesSector = selectedSector === 'ALL' || s.sector === selectedSector;
      return matchesSearch && matchesSector;
    });

    list.sort((a, b) => {
      if (sortBy === 'GAINERS') return b.changePercent - a.changePercent;
      if (sortBy === 'LOSERS') return a.changePercent - b.changePercent;
      if (sortBy === 'PRICE_HIGH') return b.currentPrice - a.currentPrice;
      if (sortBy === 'PRICE_LOW') return a.currentPrice - b.currentPrice;
      if (sortBy === 'ALPHA') return (a.ticker || '').localeCompare(b.ticker || '');
      return 0;
    });

    return list;
  }, [enrichedStocks, searchTerm, selectedSector, sortBy]);

  // Market Breadth Stats
  const marketStats = useMemo(() => {
    let up = 0;
    let down = 0;
    let topGainer: any = null;
    let topLoser: any = null;

    enrichedStocks.forEach((s) => {
      if (s.change >= 0) up++;
      else down++;

      if (!topGainer || s.changePercent > topGainer.changePercent) topGainer = s;
      if (!topLoser || s.changePercent < topLoser.changePercent) topLoser = s;
    });

    const total = up + down;
    const upRatio = total > 0 ? (up / total) * 100 : 50;

    return { up, down, total, upRatio, topGainer, topLoser };
  }, [enrichedStocks]);

  const isRunning = simulationStatus === 'RUNNING';
  const isAdmin = userData?.role === 'admin';

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-zinc-200/90 overflow-hidden">
      {/* 1. Market Telemetry Ribbon */}
      <div className="bg-zinc-950 text-zinc-100 px-4 sm:px-6 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {isRunning ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-500"></span>
              )}
            </span>
            <span className="font-bold text-zinc-200 uppercase tracking-wider text-[11px]">
              {isRunning ? 'Market Active' : 'Market Halted'}
            </span>
          </div>

          <span className="text-zinc-600 hidden sm:inline">•</span>

          {/* Real-time Exchange Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-950/60 border border-blue-800/60 text-blue-300 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>NYSE / NASDAQ Feed</span>
          </div>

          <span className="text-zinc-600 hidden sm:inline">•</span>

          {/* Advancers vs Decliners ratio */}
          <div className="hidden sm:flex items-center gap-2 text-zinc-400">
            <span className="text-emerald-400 font-semibold">{marketStats.up} Up</span>
            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${marketStats.upRatio}%` }} />
              <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${100 - marketStats.upRatio}%` }} />
            </div>
            <span className="text-rose-400 font-semibold">{marketStats.down} Down</span>
          </div>
        </div>

        {/* Top Movers Highlights */}
        <div className="flex items-center gap-3">
          {marketStats.topGainer && (
            <div className="hidden md:flex items-center gap-1 text-[11px] text-zinc-400">
              <span className="text-zinc-500">Leader:</span>
              <button
                onClick={() => onOpenStockChart(marketStats.topGainer)}
                className="font-bold text-zinc-200 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                {marketStats.topGainer.ticker}
              </button>
              <span className="text-emerald-400 font-semibold">
                +{marketStats.topGainer.changePercent.toFixed(2)}%
              </span>
            </div>
          )}

          {!isRunning && isAdmin && (
            <button
              onClick={handleQuickStartSim}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 px-2.5 py-1 rounded-lg border border-emerald-700/60 transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Start Market Floor</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Controls & Search Toolbar */}
      <div className="p-4 sm:p-5 border-b border-zinc-100 bg-zinc-50/50 space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Title & Description */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <BarChart2 className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-zinc-900 text-base tracking-tight">
                Live Market Watchlist
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-zinc-200/80 text-zinc-700">
                {enrichedStocks.length} Assets
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 ml-9.5">
              Streaming real-time execution quotes, intraday sparklines, and session price dynamics
            </p>
          </div>

          {/* Actions: Search, Sort & View Mode */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search ticker, company, sector..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8.5 pr-7 py-1.5 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium placeholder:text-zinc-400 shadow-2xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort Select */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs text-zinc-700 font-semibold outline-none cursor-pointer hover:bg-zinc-50 transition-colors shadow-2xs"
              >
                <option value="GAINERS">🚀 Top Gainers</option>
                <option value="LOSERS">🔻 Top Losers</option>
                <option value="PRICE_HIGH">💰 Price: High to Low</option>
                <option value="PRICE_LOW">🏷️ Price: Low to High</option>
                <option value="ALPHA">🔤 Symbol: A to Z</option>
              </select>
            </div>

            {/* View Mode Toggle (Table vs Bento Grid) */}
            <div className="flex items-center bg-zinc-200/80 p-0.5 rounded-xl border border-zinc-200">
              <button
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'TABLE'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
                title="Terminal Table View"
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('GRID')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'GRID'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
                title="Card Bento View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sync Live Quotes Button */}
            <button
              onClick={handleRefreshLiveQuotes}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 hover:text-zinc-900 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Fetch fresh real-time quotes directly from the exchange"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync Live'}</span>
            </button>
          </div>
        </div>

        {/* Sector Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {sectors.map((sec) => (
            <button
              key={sec.name}
              onClick={() => setSelectedSector(sec.name)}
              className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedSector === sec.name
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/80'
              }`}
            >
              <span>{sec.name === 'ALL' ? 'All Assets' : sec.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedSector === sec.name ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-500'
                }`}
              >
                {sec.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Display: TABLE or GRID */}
      {viewMode === 'TABLE' ? (
        /* Professional Terminal Table View */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-zinc-200/80 bg-zinc-50/60 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                <th className="py-3 px-5">Symbol & Asset</th>
                <th className="py-3 px-4">Sector</th>
                <th className="py-3 px-4 text-right">Last Price</th>
                <th className="py-3 px-4 text-right">Session Change</th>
                <th className="py-3 px-5 text-center">Intraday Trend</th>
                <th className="py-3 px-4">Day Range (L - H)</th>
                <th className="py-3 px-5 text-right">Quick Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {filteredStocks.map((stock) => {
                const flash = tickFlash[stock.id];
                const flashClass =
                  flash === 'up'
                    ? 'bg-emerald-50/80 transition-colors duration-200'
                    : flash === 'down'
                    ? 'bg-rose-50/80 transition-colors duration-200'
                    : 'hover:bg-zinc-50/60 transition-colors';

                return (
                  <tr key={stock.id} className={`${flashClass} group`}>
                    {/* Symbol & Name */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => onOpenStockChart(stock)}
                          className="w-9 h-9 rounded-xl bg-zinc-100 text-zinc-900 group-hover:bg-blue-50 group-hover:text-blue-600 font-extrabold flex items-center justify-center text-xs tracking-tight transition-colors shrink-0 cursor-pointer border border-zinc-200/60"
                        >
                          {stock.ticker.slice(0, 3)}
                        </button>
                        <div>
                          <button
                            onClick={() => onOpenStockChart(stock)}
                            className="font-bold text-zinc-900 group-hover:text-blue-600 transition-colors text-left flex items-center gap-1.5 cursor-pointer"
                          >
                            <span className="text-sm tracking-tight">{stock.ticker}</span>
                          </button>
                          <div className="text-zinc-500 text-[11px] line-clamp-1 max-w-[170px]">
                            {stock.name}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Sector */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 border border-zinc-200/50">
                        {stock.sector || 'Equities'}
                      </span>
                    </td>

                    {/* Last Price */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="font-mono text-sm font-bold text-zinc-900 tabular-nums">
                        {formatUSD(stock.currentPrice)}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-medium">
                        Open: {formatUSD(stock.dayOpen)}
                      </div>
                    </td>

                    {/* Session Change ($ and %) */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          stock.isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {stock.isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        <span className="font-mono">
                          {stock.isUp ? '+' : ''}
                          {stock.changePercent.toFixed(2)}%
                        </span>
                      </div>
                      <div className="text-[10px] font-mono font-semibold text-zinc-400 text-right mt-0.5">
                        {stock.isUp ? '+' : ''}
                        {formatUSD(stock.change)}
                      </div>
                    </td>

                    {/* Live Mini Sparkline */}
                    <td className="py-3.5 px-5 text-center">
                      <div className="flex justify-center">
                        <Sparkline
                          prices={stock.history}
                          width={110}
                          height={28}
                          isPositive={stock.isUp}
                        />
                      </div>
                    </td>

                    {/* Day High / Low Range */}
                    <td className="py-3.5 px-4">
                      <div className="w-36">
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-1">
                          <span>{formatUSD(stock.dayLow)}</span>
                          <span>{formatUSD(stock.dayHigh)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden relative">
                          <div
                            className={`h-full rounded-full ${stock.isUp ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${stock.rangePosition}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenStockChart(stock)}
                          className="px-2.5 py-1 text-zinc-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-semibold border border-zinc-200 transition-colors cursor-pointer"
                          title="Interactive Chart"
                        >
                          Chart
                        </button>
                        <button
                          onClick={() => onOpenStockChart(stock)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Trade</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Bento Card View (Carefully proportioned with min width) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4.5 p-5">
          {filteredStocks.map((stock) => {
            const flash = tickFlash[stock.id];
            const flashClass =
              flash === 'up'
                ? 'ring-2 ring-emerald-500/50 bg-emerald-50/20'
                : flash === 'down'
                ? 'ring-2 ring-rose-500/50 bg-rose-50/20'
                : 'border-zinc-200/80 hover:border-zinc-300 hover:shadow-sm';

            return (
              <div
                key={stock.id}
                className={`border rounded-2xl p-4.5 bg-white flex flex-col justify-between transition-all group ${flashClass}`}
              >
                {/* Card Top: Ticker, Name, Sector */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => onOpenStockChart(stock)}
                        className="w-10 h-10 rounded-xl bg-zinc-100 group-hover:bg-blue-50 text-zinc-900 group-hover:text-blue-600 font-extrabold flex items-center justify-center text-xs tracking-tight transition-colors shrink-0 cursor-pointer border border-zinc-200/60"
                      >
                        {stock.ticker.slice(0, 3)}
                      </button>
                      <div>
                        <button
                          onClick={() => onOpenStockChart(stock)}
                          className="font-extrabold text-base text-zinc-900 group-hover:text-blue-600 transition-colors text-left tracking-tight cursor-pointer"
                        >
                          {stock.ticker}
                        </button>
                        <div className="text-zinc-500 text-xs line-clamp-1 max-w-[140px]">
                          {stock.name}
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200/50 shrink-0">
                      {stock.sector || 'Equities'}
                    </span>
                  </div>

                  {/* Sparkline Banner */}
                  <div className="py-2.5 my-1 flex justify-center bg-zinc-50/70 rounded-xl border border-zinc-100 overflow-hidden">
                    <Sparkline
                      prices={stock.history}
                      width={220}
                      height={44}
                      isPositive={stock.isUp}
                    />
                  </div>
                </div>

                {/* Card Bottom: Big Price, Change Chip, Actions */}
                <div className="mt-3 pt-3 border-t border-zinc-100">
                  <div className="flex items-baseline justify-between mb-2.5">
                    <div>
                      <div className="text-xl font-extrabold font-mono text-zinc-900 tracking-tight tabular-nums">
                        {formatUSD(stock.currentPrice)}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400">
                        Open: {formatUSD(stock.dayOpen)}
                      </div>
                    </div>

                    <div
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                        stock.isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {stock.isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span className="font-mono">
                        {stock.isUp ? '+' : ''}
                        {stock.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Intraday Range Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-1">
                      <span>Low: {formatUSD(stock.dayLow)}</span>
                      <span>High: {formatUSD(stock.dayHigh)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${stock.isUp ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        style={{ width: `${stock.rangePosition}%` }}
                      />
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenStockChart(stock)}
                      className="flex-1 py-1.5 px-3 rounded-xl border border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 text-xs font-bold transition-colors cursor-pointer text-center"
                    >
                      Terminal
                    </button>
                    <button
                      onClick={() => onOpenStockChart(stock)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Trade</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Empty State */}
      {filteredStocks.length === 0 && (
        <div className="py-16 px-4 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-zinc-900 text-sm">
              {stocks.length === 0 ? 'No Active Assets Listed' : 'No Assets Match Your Filters'}
            </h4>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {stocks.length === 0
                ? isAdmin
                  ? 'Click below to instantly populate the floor with high-liquidity US equities, financial leaders, and market ETFs.'
                  : 'The floor manager has not activated any stocks yet. Please standby.'
                : 'Try adjusting your search query or selecting "All Assets" from the filter tabs above.'}
            </p>
            {stocks.length === 0 && isAdmin && (
              <button
                onClick={handleQuickSeed}
                disabled={seeding}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{seeding ? 'Seeding Market Assets...' : 'Seed Default Assets'}</span>
              </button>
            )}
            {stocks.length > 0 && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedSector('ALL');
                }}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Reset Search Filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
