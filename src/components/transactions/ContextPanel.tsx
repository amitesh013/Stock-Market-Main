import React from 'react';
import { ViewLink, T, formatUSD, formatSignedUSD, formatPct, toneColor } from '../dashboard/ui';
import { useAnimatedNumber } from '../../lib/portfolio';

export default function ContextPanel({ netWorth, pnl, returnPct, rankIndex, rankTotal, trades }: {
  netWorth: number;
  pnl: number;
  returnPct: number;
  rankIndex: number;
  rankTotal: number;
  trades: number;
}) {
  const value = useAnimatedNumber(netWorth);

  return (
    <section aria-label="Portfolio and competition" className="h-full rounded-md border border-[#26343C] bg-[#0D1419] grid grid-cols-2">
      <div className="min-w-0 px-4 py-3.5 flex flex-col">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]">Current Portfolio</div>
        <div className="mt-1 text-lg font-semibold tabular-nums text-[#F3F5F4] truncate">{formatUSD(value)}</div>
        <div className="text-[11px] tabular-nums truncate" style={{ color: toneColor(pnl) }}>
          {formatSignedUSD(pnl)} <span className="text-[#65737A]">·</span> {formatPct(returnPct)}
        </div>
        <div className="mt-2"><ViewLink to="/portfolio">View Portfolio</ViewLink></div>
      </div>
      <div className="min-w-0 px-4 py-3.5 flex flex-col border-l border-[#26343C]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]">Competition</div>
        <div className="mt-1 text-lg font-semibold tabular-nums truncate" style={{ color: T.user }}>
          {rankIndex >= 0 ? `#${String(rankIndex + 1).padStart(2, '0')}` : '—'}
          <span className="text-sm font-normal text-[#65737A]"> / {rankTotal}</span>
        </div>
        <div className="text-[11px] text-[#65737A] tabular-nums truncate">
          {trades} {trades === 1 ? 'trade' : 'trades'} executed
        </div>
        <div className="mt-2"><ViewLink to="/leaderboard">View Leaderboard</ViewLink></div>
      </div>
    </section>
  );
}
