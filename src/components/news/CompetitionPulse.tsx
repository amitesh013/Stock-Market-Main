import React from 'react';
import { Card, Eyebrow, ViewLink, T, formatUSD, formatPct, toneColor } from '../dashboard/ui';

interface CompetitionPulseProps {
  status: string;
  hasLiveEvent: boolean;
  portfolioValue: number;
  returnPct: number;
  rank: number | null;
  total: number;
}

export default function CompetitionPulse({ status, hasLiveEvent, portfolioValue, returnPct, rank, total }: CompetitionPulseProps) {
  const title =
    status === 'COMPLETED' ? 'Final Standing'
      : status !== 'RUNNING' ? 'Your Position'
        : 'Market Is Moving';
  return (
    <Card className="!p-4">
      <Eyebrow color={hasLiveEvent && status === 'RUNNING' ? T.cyan : T.text2}>{title}</Eyebrow>
      <p className="mt-1 text-xs text-[#A4AFB4]">
        {hasLiveEvent && status === 'RUNNING' ? 'Prices are reacting to the live event.' : 'Where you stand right now.'}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-[#26343C] bg-[#06090B]/50 px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">Portfolio</div>
          <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-[#F3F5F4] truncate">{formatUSD(portfolioValue)}</div>
          <div className="text-[11px] font-medium tabular-nums" style={{ color: toneColor(returnPct) }}>{formatPct(returnPct)}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">Rank</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-[15px] font-semibold tabular-nums" style={{ color: T.user }}>{rank ? `#${rank}` : '—'}</span>
            <span className="text-[11px] tabular-nums text-[#65737A]">/ {total}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ViewLink to="/portfolio">View Portfolio</ViewLink>
        <ViewLink to="/leaderboard">View Leaderboard</ViewLink>
      </div>
    </Card>
  );
}
