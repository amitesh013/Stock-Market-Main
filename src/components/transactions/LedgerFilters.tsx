import React from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { DateFilter, SideFilter, TxSort } from './txUtils';

const SIDES: SideFilter[] = ['ALL', 'BUY', 'SELL'];
const DATES: { id: DateFilter; label: string }[] = [
  { id: 'ALL', label: 'All Time' },
  { id: 'TODAY', label: 'Today' },
  { id: 'HOUR', label: 'Last Hour' },
];
const SORTS: { id: TxSort; label: string }[] = [
  { id: 'NEWEST', label: 'Newest' },
  { id: 'OLDEST', label: 'Oldest' },
  { id: 'LARGEST', label: 'Largest Trade' },
  { id: 'SMALLEST', label: 'Smallest Trade' },
];

function Select<V extends string>({ label, value, onChange, options }: {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options: { id: V; label: string }[];
}) {
  return (
    <label className="relative inline-flex items-center min-w-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as V)}
        className="appearance-none h-8 w-full pl-2.5 pr-7 rounded-lg border border-[#26343C] bg-[#0C1112] text-xs font-medium text-[#F3F5F4] hover:border-[#4A5A63] focus:outline-none focus:border-[#3B82FF]/60 transition-colors duration-200 cursor-pointer"
      >
        {options.map((o) => <option key={o.id} value={o.id} className="bg-[#0D1419]">{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 w-3.5 h-3.5 text-[#65737A]" />
    </label>
  );
}

export interface LedgerFiltersProps {
  side: SideFilter;
  onSide: (s: SideFilter) => void;
  asset: string;
  onAsset: (a: string) => void;
  assets: string[];
  date: DateFilter;
  onDate: (d: DateFilter) => void;
  sort: TxSort;
  onSort: (s: TxSort) => void;
  search: string;
  onSearch: (q: string) => void;
}

export default function LedgerFilters(p: LedgerFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[#26343C]">
      <div role="radiogroup" aria-label="Order side" className="inline-flex h-8 rounded-lg border border-[#26343C] p-0.5">
        {SIDES.map((s) => {
          const active = p.side === s;
          return (
            <button
              key={s}
              role="radio"
              aria-checked={active}
              onClick={() => p.onSide(s)}
              className={`px-2.5 rounded-md text-[11px] font-semibold tracking-[0.06em] transition-colors duration-200 cursor-pointer ${
                active ? 'bg-[#3B82FF]/10 text-[#F3F5F4] shadow-[inset_0_0_0_1px_rgba(213,166,83,0.45)]' : 'text-[#A4AFB4] hover:text-[#F3F5F4]'
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      <Select
        label="Asset"
        value={p.asset}
        onChange={p.onAsset}
        options={[{ id: 'ALL', label: 'All Assets' }, ...p.assets.map((a) => ({ id: a, label: a }))]}
      />
      <Select label="Date range" value={p.date} onChange={p.onDate} options={DATES} />
      <Select label="Sort by" value={p.sort} onChange={p.onSort} options={SORTS} />

      <label className="relative flex-1 min-w-[10rem] basis-40">
        <span className="sr-only">Search transactions</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#65737A]" />
        <input
          type="search"
          value={p.search}
          onChange={(e) => p.onSearch(e.target.value)}
          placeholder="Search ticker, company or side"
          className="h-8 w-full pl-8 pr-7 rounded-lg border border-[#26343C] bg-[#0C1112] text-xs text-[#F3F5F4] placeholder:text-[#65737A] hover:border-[#4A5A63] focus:outline-none focus:border-[#3B82FF]/60 transition-colors duration-200 [&::-webkit-search-cancel-button]:hidden"
        />
        {p.search && (
          <button
            onClick={() => p.onSearch('')}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#65737A] hover:text-[#F3F5F4] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </label>
    </div>
  );
}
