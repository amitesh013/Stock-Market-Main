import React from 'react';
import { Search, RefreshCw, X } from 'lucide-react';
import { SortKey } from './marketUtils';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'GAINERS', label: 'Top Gainers' },
  { value: 'LOSERS', label: 'Top Losers' },
  { value: 'PRICE', label: 'Price' },
  { value: 'VOLUME', label: 'Volume' },
];

interface MarketHeaderProps {
  search: string;
  onSearch: (v: string) => void;
  sort: SortKey;
  onSort: (v: SortKey) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function MarketHeader({ search, onSearch, sort, onSort, onRefresh, refreshing }: MarketHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[#F3F5F4]">Market &amp; Trading</h1>
        <p className="text-[13px] text-[#A4AFB4] mt-0.5">Live stock market with real-time prices. Analyze, trade and build your portfolio.</p>
      </div>

      <div className="flex items-center gap-2">
        <label className="relative flex-1 md:w-64 md:flex-none">
          <span className="sr-only">Search ticker or company</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#65737A] pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search ticker or company…"
            className="w-full h-9 pl-9 pr-8 rounded-lg bg-[#0D1419] border border-[#26343C] text-sm text-[#F3F5F4] placeholder:text-[#65737A] outline-none focus:border-[#3B82FF]/60 transition-colors [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              onClick={() => onSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-[#65737A] hover:text-[#F3F5F4] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </label>

        <label className="sr-only" htmlFor="market-sort">Sort</label>
        <select
          id="market-sort"
          value={sort}
          onChange={(e) => onSort(e.target.value as SortKey)}
          className="h-9 px-3 rounded-lg bg-[#0D1419] border border-[#26343C] text-sm text-[#F3F5F4] outline-none focus:border-[#3B82FF]/60 cursor-pointer"
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh prices"
          title="Refresh prices"
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg bg-[#0D1419] border border-[#26343C] text-[#A4AFB4] hover:text-[#F3F5F4] hover:border-[#4A5A63] transition-colors cursor-pointer disabled:cursor-wait"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
        </button>
      </div>
    </div>
  );
}
