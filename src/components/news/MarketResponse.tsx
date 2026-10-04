import React, { useEffect, useState } from 'react';
import { T, formatPct, toneColor } from '../dashboard/ui';
import { SectorResponse } from '../../lib/newsEvents';

interface MarketResponseProps {
  rows: SectorResponse[];
  caption?: string;
  emptyText?: string;
  /** Bars grow from zero whenever this key changes (e.g. a new event activates). */
  revealKey?: string;
}

export default function MarketResponse({ rows, caption = 'Current change of affected assets', emptyText, revealKey }: MarketResponseProps) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    setGrown(false);
    let inner = 0;
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setGrown(true)); });
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
  }, [revealKey]);

  if (!rows.length) {
    return <p className="text-xs text-[#65737A] leading-relaxed">{emptyText ?? 'No live price data for the affected assets yet.'}</p>;
  }

  const max = Math.max(...rows.map((r) => Math.abs(r.changePct)), 0.01);

  return (
    <div>
      <ul className="space-y-2">
        {rows.map((r) => {
          const color = toneColor(r.changePct);
          const width = (Math.abs(r.changePct) / max) * 100;
          return (
            <li key={r.sector} className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_3.75rem] items-center gap-3">
              <span className="truncate text-xs font-medium text-[#D2D8DA]">
                {r.sector}
                <span className="ml-1 text-[10px] text-[#65737A] tabular-nums">{r.count}</span>
              </span>
              <span className="h-1.5 rounded-full bg-[#111A20] overflow-hidden" aria-hidden="true">
                <span
                  className="ne-bar block h-full rounded-full"
                  style={{ width: grown ? `${Math.max(width, 2)}%` : '0%', backgroundColor: color, opacity: 0.85 }}
                />
              </span>
              <span className="text-right text-xs font-semibold tabular-nums" style={{ color }}>
                {formatPct(r.changePct)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2.5 text-[10px] uppercase tracking-[0.1em]" style={{ color: T.muted }}>{caption}</p>
    </div>
  );
}
