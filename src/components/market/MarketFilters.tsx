import React from 'react';
import { Plus, Check, X } from 'lucide-react';
import { CATEGORIES, Category } from './marketUtils';

export type WatchTab = 'WATCHLIST' | 'ALL' | 'SECTORS';

const TABS: { id: WatchTab; label: string }[] = [
  { id: 'WATCHLIST', label: 'Watchlist' },
  { id: 'ALL', label: 'All Assets' },
  { id: 'SECTORS', label: 'Sectors' },
];

interface MarketFiltersProps {
  tab: WatchTab;
  onTab: (t: WatchTab) => void;
  category: Category;
  onCategory: (c: Category) => void;
  categoryCounts: Record<Category, number>;
  sectorFilter: string | null;
  onClearSector: () => void;
  selectedTicker?: string;
  selectedStarred: boolean;
  onToggleSelected: () => void;
  watchCount: number;
}

export default function MarketFilters(props: MarketFiltersProps) {
  const { tab, onTab, category, onCategory, categoryCounts, sectorFilter, onClearSector, selectedTicker, selectedStarred, onToggleSelected, watchCount } = props;

  return (
    <div className="border-b border-[#26343C]">
      <div className="flex items-center justify-between gap-3 px-4">
        <div className="flex gap-5" role="tablist" aria-label="Market lists">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => onTab(t.id)}
                className={`relative py-3 text-[13px] font-semibold transition-colors duration-200 cursor-pointer ${active ? 'text-[#F3F5F4]' : 'text-[#A4AFB4] hover:text-[#F3F5F4]'}`}
              >
                {t.label}
                {t.id === 'WATCHLIST' && watchCount > 0 && <span className="ml-1.5 text-[11px] text-[#65737A] tabular-nums">{watchCount}</span>}
                <span className={`absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-[#3B82FF] transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            );
          })}
        </div>

        {selectedTicker && (
          <button
            onClick={onToggleSelected}
            className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#26343C] text-xs font-semibold text-[#A4AFB4] hover:text-[#F3F5F4] hover:border-[#4A5A63] transition-colors cursor-pointer"
          >
            {selectedStarred ? <Check className="w-3.5 h-3.5 text-[#3B82FF]" /> : <Plus className="w-3.5 h-3.5" />}
            {selectedStarred ? `${selectedTicker} in Watchlist` : 'Add to Watchlist'}
          </button>
        )}
      </div>

      {tab !== 'SECTORS' && (
        <div className="flex items-center gap-1.5 px-4 pb-3 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((c) => {
            const active = category === c;
            const count = categoryCounts[c] || 0;
            return (
              <button
                key={c}
                onClick={() => onCategory(c)}
                disabled={c !== 'All' && count === 0}
                className={`shrink-0 h-7 px-3 rounded-md text-xs font-medium border transition-colors duration-200 cursor-pointer disabled:cursor-default disabled:opacity-35 ${
                  active ? 'border-[#3B82FF]/60 bg-[#3B82FF]/10 text-[#F3F5F4]' : 'border-[#26343C] text-[#A4AFB4] enabled:hover:text-[#F3F5F4] enabled:hover:border-[#4A5A63]'
                }`}
              >
                {c}
              </button>
            );
          })}
          {sectorFilter && (
            <button
              onClick={onClearSector}
              className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium border border-[#3B82FF]/60 text-[#F3F5F4] cursor-pointer"
            >
              {sectorFilter} <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
