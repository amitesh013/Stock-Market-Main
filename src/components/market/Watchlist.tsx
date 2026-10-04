import React, { useMemo, useState } from 'react';
import { LiveStock } from '../../lib/liveData';
import { AffectedStock } from '../../lib/marketState';
import { formatPct, toneColor } from '../dashboard/ui';
import MarketFilters, { WatchTab } from './MarketFilters';
import WatchlistRow, { ROW_GRID } from './WatchlistRow';
import { CATEGORIES, Category, Side, categoryOf } from './marketUtils';

interface MarketWatchlistProps {
  stocks: LiveStock[];
  totalStocks: number;
  searching: boolean;
  selectedId?: string;
  tradingOpen: boolean;
  impactByTicker: Record<string, AffectedStock>;
  watch: { tickers: string[]; toggle: (t: string) => void; has: (t: string) => boolean };
  onSelect: (stock: LiveStock) => void;
  onTrade: (stock: LiveStock, side: Side) => void;
  emptyAction?: React.ReactNode;
}

export default function MarketWatchlist({
  stocks, totalStocks, searching, selectedId, tradingOpen, impactByTicker, watch, onSelect, onTrade, emptyAction,
}: MarketWatchlistProps) {
  const [tab, setTab] = useState<WatchTab>('ALL');
  const [category, setCategory] = useState<Category>('All');
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
    stocks.forEach((s) => {
      counts.All++;
      const c = categoryOf(s);
      if (c) counts[c]++;
    });
    return counts;
  }, [stocks]);

  const sectors = useMemo(() => {
    const map = new Map<string, LiveStock[]>();
    stocks.forEach((s) => {
      const key = s.sector || 'Other';
      map.set(key, [...(map.get(key) || []), s]);
    });
    return Array.from(map.entries())
      .map(([name, list]) => ({ name, count: list.length, avg: list.reduce((a, s) => a + s.changePercent, 0) / list.length }))
      .sort((a, b) => b.avg - a.avg);
  }, [stocks]);

  const rows = useMemo(() => {
    return stocks.filter((s) => {
      if (tab === 'WATCHLIST' && !watch.has(s.ticker)) return false;
      if (category !== 'All' && categoryOf(s) !== category) return false;
      if (sectorFilter && (s.sector || 'Other') !== sectorFilter) return false;
      return true;
    });
  }, [stocks, tab, category, sectorFilter, watch]);

  const selected = stocks.find((s) => s.id === selectedId);

  let empty: React.ReactNode = null;
  if (totalStocks === 0) empty = <>Waiting for market data…{emptyAction}</>;
  else if (rows.length === 0) {
    empty = searching
      ? 'No matching assets'
      : tab === 'WATCHLIST'
      ? 'Your watchlist is empty. Star a stock to follow it here.'
      : 'No assets in this category.';
  }

  return (
    <section className="rounded-md border border-[#26343C] bg-[#0D1419] overflow-hidden">
      <MarketFilters
        tab={tab}
        onTab={setTab}
        category={category}
        onCategory={(c) => { setCategory(c); setSectorFilter(null); }}
        categoryCounts={categoryCounts}
        sectorFilter={sectorFilter}
        onClearSector={() => setSectorFilter(null)}
        selectedTicker={selected?.ticker}
        selectedStarred={selected ? watch.has(selected.ticker) : false}
        onToggleSelected={() => selected && watch.toggle(selected.ticker)}
        watchCount={watch.tickers.length}
      />

      {tab === 'SECTORS' ? (
        <ul className="divide-y divide-[#26343C]">
          {sectors.map((s) => (
            <li key={s.name}>
              <button
                onClick={() => { setSectorFilter(s.name); setCategory('All'); setTab('ALL'); }}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-[#111A20]/60 transition-colors cursor-pointer"
              >
                <span className="text-[13px] font-medium text-[#F3F5F4]">{s.name}</span>
                <span className="flex items-center gap-4 text-xs tabular-nums">
                  <span className="text-[#65737A]">{s.count} asset{s.count === 1 ? '' : 's'}</span>
                  <span className="w-16 text-right font-semibold" style={{ color: toneColor(s.avg) }}>{formatPct(s.avg)}</span>
                </span>
              </button>
            </li>
          ))}
          {sectors.length === 0 && <li className="px-4 py-8 text-center text-sm text-[#65737A]">{searching ? 'No matching assets' : 'No sectors yet.'}</li>}
        </ul>
      ) : (
        <>
          <div className={`${ROW_GRID} px-4 py-2 border-b border-[#26343C] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]`} aria-hidden="true">
            <span>Symbol</span>
            <span className="hidden md:block">Company</span>
            <span className="hidden md:block text-right">Price</span>
            <span className="hidden md:block text-right">Change</span>
            <span className="md:hidden text-right">Price</span>
            <span className="hidden sm:block text-center">1D Trend</span>
            <span className="hidden xl:block text-right">Day Range</span>
            <span className="hidden xl:block text-right">Volume</span>
            <span className="text-right">Action</span>
          </div>

          {empty ? (
            <div className="px-4 py-10 text-center text-sm text-[#65737A] flex flex-col items-center gap-3">{empty}</div>
          ) : (
            <ul className="divide-y divide-[#26343C]/70" aria-label="Market assets">
              {rows.map((s) => (
                <WatchlistRow
                  key={s.id}
                  stock={s}
                  selected={s.id === selectedId}
                  starred={watch.has(s.ticker)}
                  tradingOpen={tradingOpen}
                  impact={impactByTicker[s.ticker.toUpperCase()]}
                  onSelect={onSelect}
                  onTrade={onTrade}
                  onToggleStar={watch.toggle}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
