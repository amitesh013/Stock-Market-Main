import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { useMarketState, AffectedStock } from '../lib/marketState';
import { usePositionSummary, LiveStock } from '../lib/liveData';
import { useLeaderboardUsers } from '../lib/leaderboard';
import { useChartSeries, ChartRange } from '../lib/chartData';
import { useWatchlist } from '../lib/watchlist';
import { seedDefaultStocks, syncLiveMarketPrices } from '../lib/stockData';
import { prefersReducedMotion } from '../components/race/Runner';
import MarketHeader from '../components/market/MarketHeader';
import MarketEventBanner from '../components/market/MarketEventBanner';
import StockDetailHeader from '../components/market/StockDetailHeader';
import StockChart, { ChartType } from '../components/market/StockChart';
import OrderPanel from '../components/market/OrderPanel';
import MarketWatchlist from '../components/market/Watchlist';
import WatchRail from '../components/market/WatchRail';
import { Side, SortKey, sortStocks } from '../components/market/marketUtils';

const RANGES: ChartRange[] = ['1D', '1W', '1M', '3M', '1Y'];
const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'CANDLE', label: 'Candlestick' },
  { value: 'LINE', label: 'Line' },
  { value: 'AREA', label: 'Area' },
];

export default function MarketTrading() {
  const { user, userData } = useAuth();
  const market = useMarketState();
  const { stocks, holdings, cash } = usePositionSummary();
  const ranked = useLeaderboardUsers().filter((u) => u.role !== 'admin');
  const watch = useWatchlist();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('GAINERS');
  const location = useLocation();
  const [selectedId, setSelectedId] = useState<string | undefined>((location.state as any)?.stockId);
  const [side, setSide] = useState<Side>('BUY');
  const [range, setRange] = useState<ChartRange>('1D');
  const [chartType, setChartType] = useState<ChartType>('CANDLE');
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const chartPanelRef = useRef<HTMLDivElement>(null);
  const orderRef = useRef<HTMLDivElement>(null);

  const tradingOpen = market.status === 'RUNNING';

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? stocks.filter((s) => s.ticker.toLowerCase().includes(term) || (s.name || '').toLowerCase().includes(term))
      : stocks;
    return sortStocks(list, sort);
  }, [stocks, search, sort]);

  useEffect(() => {
    if (selectedId && stocks.some((s) => s.id === selectedId)) return;
    const first = sortStocks(stocks, sort)[0];
    if (first) setSelectedId(first.id);
  }, [stocks, selectedId, sort]);

  const selected = useMemo(() => stocks.find((s) => s.id === selectedId) ?? null, [stocks, selectedId]);
  const series = useChartSeries(selected, range);

  const holding = holdings.find((h) => h.stockId === selected?.id);
  const sharesOwned = Number(holding?.quantity) || 0;
  const avgCost = Number(holding?.averageBuyPrice) || 0;

  const myIndex = ranked.findIndex((u) => u.id === user?.uid);
  const rank = myIndex >= 0 ? { position: myIndex + 1, total: ranked.length } : null;

  const impactByTicker = useMemo(() => {
    const map: Record<string, AffectedStock> = {};
    if (tradingOpen) market.activeEvent?.affectedStocks.forEach((s) => { map[(s.ticker || '').toUpperCase()] = s; });
    return map;
  }, [market.activeEvent, tradingOpen]);

  const handleSelect = useCallback((s: LiveStock) => setSelectedId(s.id), []);

  const handleTrade = useCallback((s: LiveStock, nextSide: Side) => {
    setSelectedId(s.id);
    setSide(nextSide);
    if (window.innerWidth < 1280) {
      orderRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await syncLiveMarketPrices(); } catch (err) { console.warn('Market refresh notice:', err); }
    finally { setRefreshing(false); }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try { await seedDefaultStocks(); } catch (err) { console.error('Seed error:', err); }
    finally { setSeeding(false); }
  };

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === chartPanelRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else chartPanelRef.current?.requestFullscreen?.().catch(() => {});
  };

  return (
    <div>
      <MarketHeader
        search={search}
        onSearch={setSearch}
        sort={sort}
        onSort={setSort}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      <MarketEventBanner market={market} stocks={stocks} />

      <div className="grid grid-cols-1 xl:grid-cols-[200px_minmax(0,1fr)_300px] gap-4 mb-6">
        <div className="hidden xl:block">
          <div className="sticky top-[4.5rem]">
            <WatchRail stocks={stocks} watched={watch.tickers} selectedId={selectedId} onSelect={handleSelect} />
          </div>
        </div>
        <div
          ref={chartPanelRef}
          className={`border-y border-[#26343C] py-4 flex flex-col gap-4 min-w-0 ${fullscreen ? 'h-screen bg-[#06090B] px-4' : ''}`}
        >
          {selected ? (
            <StockDetailHeader
              stock={selected}
              starred={watch.has(selected.ticker)}
              onToggleStar={() => watch.toggle(selected.ticker)}
              impact={impactByTicker[selected.ticker.toUpperCase()]}
            />
          ) : (
            <div className="h-10 flex items-center text-sm text-[#65737A]">
              {stocks.length ? 'Select a stock to view its chart.' : 'Waiting for market data…'}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1" role="group" aria-label="Chart range">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  aria-pressed={range === r}
                  className={`h-7 px-2.5 rounded-md text-xs font-semibold border transition-colors duration-200 cursor-pointer ${
                    range === r ? 'border-[#3B82FF]/60 bg-[#3B82FF]/10 text-[#F3F5F4]' : 'border-transparent text-[#A4AFB4] hover:text-[#F3F5F4]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]">
                {series.candles.length ? (series.source === 'exchange' ? 'Exchange data' : 'Simulation ticks') : ''}
              </span>
              <label htmlFor="chart-type" className="sr-only">Chart type</label>
              <select
                id="chart-type"
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
                className="h-7 px-2 rounded-md bg-[#111A20] border border-[#26343C] text-xs text-[#F3F5F4] outline-none focus:border-[#3B82FF]/60 cursor-pointer"
              >
                {CHART_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button
                onClick={toggleFullscreen}
                aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen chart'}
                className="h-7 w-7 flex items-center justify-center rounded-md border border-[#26343C] text-[#A4AFB4] hover:text-[#F3F5F4] hover:border-[#4A5A63] transition-colors cursor-pointer"
              >
                {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className={fullscreen ? 'flex-1 min-h-0' : 'h-[300px] sm:h-[360px] xl:h-[400px]'}>
            <StockChart
              candles={series.candles}
              hasVolume={series.hasVolume}
              type={chartType}
              range={range}
              currentPrice={selected?.currentPrice || 0}
              loading={series.loading}
            />
          </div>
        </div>

        <div ref={orderRef} className="xl:sticky xl:top-[4.5rem] self-start w-full">
          <OrderPanel
            stock={selected}
            side={side}
            onSide={setSide}
            marketStatus={market.status}
            cash={cash}
            sharesOwned={sharesOwned}
            avgCost={avgCost}
            rank={rank}
          />
        </div>
      </div>

      <MarketWatchlist
        stocks={visible}
        totalStocks={stocks.length}
        searching={!!search.trim()}
        selectedId={selectedId}
        tradingOpen={tradingOpen}
        impactByTicker={impactByTicker}
        watch={watch}
        onSelect={handleSelect}
        onTrade={handleTrade}
        emptyAction={userData?.role === 'admin' ? (
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="h-8 px-3 rounded-lg border border-[#3B82FF]/50 text-xs font-semibold text-[#3B82FF] hover:bg-[#3B82FF]/10 cursor-pointer disabled:cursor-wait"
          >
            {seeding ? 'Loading stocks…' : 'Load market stocks'}
          </button>
        ) : null}
      />
    </div>
  );
}
