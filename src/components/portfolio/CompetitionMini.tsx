import React from 'react';
import { LeaderboardEntry } from '../../lib/leaderboard';
import { Eyebrow, ViewLink, T, formatUSD } from '../dashboard/ui';

export default function CompetitionMini({ ranked, myId, myValue }: { ranked: LeaderboardEntry[]; myId?: string; myValue: number }) {
  const idx = ranked.findIndex((u) => u.id === myId);
  const above = idx > 0 ? ranked[idx - 1] : null;
  const below = idx >= 0 && idx < ranked.length - 1 ? ranked[idx + 1] : null;

  let gapLabel = 'Next position';
  let gapValue = '—';
  let gapColor: string = T.text2;
  if (idx === 0 && below) {
    gapLabel = 'Lead over #2';
    gapValue = `+${formatUSD(myValue - below.portfolioValue)}`;
    gapColor = T.positive;
  } else if (above) {
    gapLabel = `Gap to #${idx}`;
    gapValue = `${formatUSD(Math.max(0, above.portfolioValue - myValue))}`;
    gapColor = T.text;
  }

  return (
    <section className="h-full rounded-md border border-[#26343C] bg-[#0D1419] p-5 flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Your Competition</Eyebrow>
        <ViewLink to="/leaderboard">Leaderboard</ViewLink>
      </div>

      <div className="mt-4 mb-4 flex items-baseline gap-1.5">
        <span className="text-[28px] leading-none font-semibold tabular-nums" style={{ color: T.user }}>
          {idx >= 0 ? `#${String(idx + 1).padStart(2, '0')}` : '—'}
        </span>
        <span className="text-sm text-[#65737A] tabular-nums">/ {ranked.length}</span>
      </div>

      <dl className="mt-auto pt-4 grid grid-cols-2 gap-3 border-t border-[#26343C]">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">Portfolio</dt>
          <dd className="mt-1 text-[13px] font-semibold tabular-nums text-[#F3F5F4]">{formatUSD(myValue)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">{gapLabel}</dt>
          <dd className="mt-1 text-[13px] font-semibold tabular-nums" style={{ color: gapColor }}>{gapValue}</dd>
        </div>
      </dl>
    </section>
  );
}
