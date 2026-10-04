import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MiniSparkline, T, formatPct, toneColor } from '../dashboard/ui';
import TickerBadge from '../market/TickerBadge';
import { LiveStock } from '../../lib/liveData';
import { NewsEventItem } from '../../lib/newsEvents';

const MAX_MARKET_WIDE = 8;

export default function AffectedAssets({ event, stocks, compact = false }: { event: NewsEventItem; stocks: LiveStock[]; compact?: boolean }) {
  const navigate = useNavigate();
  const byTicker = new Map(stocks.map((s) => [s.ticker.toUpperCase(), s]));

  const rows = event.marketWide
    ? [...stocks]
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
        .slice(0, MAX_MARKET_WIDE)
        .map((s) => ({ ticker: s.ticker.toUpperCase(), stock: s }))
    : event.affected.map((a) => ({ ticker: a.ticker, stock: byTicker.get(a.ticker) }));

  if (!rows.length) {
    return <p className="text-xs text-[#65737A]">{event.marketWide ? 'No live price data yet.' : 'No specific assets listed for this event.'}</p>;
  }

  return (
    <div>
      <ul className="divide-y divide-[#26343C]/70">
        {rows.map((r) => {
          const s = r.stock;
          const change = s?.changePercent ?? null;
          return (
            <li key={r.ticker}>
              <button
                disabled={!s}
                onClick={() => s && navigate('/market', { state: { stockId: s.id } })}
                className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto_3.5rem] items-center gap-2.5 py-2 text-left rounded-md transition-colors duration-200 enabled:hover:bg-[#111A20]/70 enabled:cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
                aria-label={s ? `Open ${r.ticker} in Market` : `${r.ticker} (no live data)`}
              >
                <TickerBadge ticker={r.ticker} size={compact ? 24 : 28} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[#F3F5F4]">{r.ticker}</span>
                  <span className="block truncate text-[11px] text-[#65737A]">{s?.name || 'No live data'}</span>
                </span>
                {s ? <MiniSparkline values={s.history} width={compact ? 44 : 56} height={20} positive={(change ?? 0) >= 0} /> : <span />}
                <span className="text-right text-xs font-semibold tabular-nums" style={{ color: change === null ? T.muted : toneColor(change) }}>
                  {change === null ? '—' : formatPct(change)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[#65737A]">
        {event.marketWide ? 'Largest movers · market-wide event · change since open' : 'Change since open · tap to view in Market'}
      </p>
    </div>
  );
}
