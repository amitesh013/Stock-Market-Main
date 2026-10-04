import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { LiveStock } from '../../lib/liveData';
import { formatPrice } from './marketUtils';
import { toneColor } from '../dashboard/ui';

interface WatchRailProps {
  stocks: LiveStock[];
  watched: string[];
  selectedId?: string;
  onSelect: (s: LiveStock) => void;
}

/** Price that briefly pulses green or red when it moves. */
function PriceTick({ price }: { price: number }) {
  const prev = useRef(price);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (price === prev.current) return;
    setDir(price > prev.current ? 'up' : 'down');
    prev.current = price;
    const t = setTimeout(() => setDir(null), 700);
    return () => clearTimeout(t);
  }, [price]);
  return (
    <span className={`block text-[13px] rounded-sm px-1 -mx-1 ${dir === 'up' ? 'tick-up' : dir === 'down' ? 'tick-down' : 'text-[#F3F5F4]'}`}>
      {formatPrice(price)}
    </span>
  );
}

function WatchRail({ stocks, watched, selectedId, onSelect }: WatchRailProps) {
  const starred = useMemo(() => stocks.filter((s) => watched.includes(s.ticker)), [stocks, watched]);
  const list = starred.length
    ? starred
    : [...stocks].sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0)).slice(0, 10);

  return (
    <aside className="border-r border-[#26343C] pr-3 min-w-0" aria-label="Watchlist">
      <div className="flex items-center justify-between px-2 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A4AFB4]">
          {starred.length ? 'Watchlist' : 'Top Movers'}
        </span>
        {starred.length > 0 && <Star className="w-3 h-3 text-[#3B82FF]" fill="currentColor" aria-hidden="true" />}
      </div>
      {!list.length && <p className="px-2 py-4 text-xs text-[#65737A]">Waiting for market data…</p>}
      <ul className="flex flex-col">
        {list.map((s) => {
          const active = s.id === selectedId;
          const chg = s.changePercent || 0;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                aria-current={active ? 'true' : undefined}
                className={`relative w-full flex items-center justify-between gap-2 px-2 py-2 text-left rounded-sm transition-colors duration-200 cursor-pointer ${
                  active ? 'bg-[#111A20]' : 'hover:bg-[#0D1419]'
                }`}
              >
                {active && <span aria-hidden="true" className="absolute left-0 top-1.5 bottom-1.5 w-px bg-[#3B82FF]" />}
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[#F3F5F4]">{s.ticker}</span>
                  <span className="block text-[11px] text-[#65737A] truncate">{s.name}</span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <PriceTick price={s.currentPrice} />
                  <span className="block text-[11px]" style={{ color: toneColor(chg) }}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export default memo(WatchRail);
