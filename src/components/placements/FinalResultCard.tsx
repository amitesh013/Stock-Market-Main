import React from 'react';
import { LeaderboardEntry } from '../../lib/leaderboard';
import { useAnimatedNumber } from '../../lib/portfolio';
import { Eyebrow, T, formatUSD, formatSignedUSD, formatPct, toneColor } from '../dashboard/ui';
import { PLACE_COLORS } from './FinalRaceTrack';

interface FinalResultCardProps {
  me: LeaderboardEntry;
  rank: number;
  total: number;
  above?: LeaderboardEntry;
  below?: LeaderboardEntry;
  trades: number | null;
  revealed: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export default function FinalResultCard({ me, rank, total, above, below, trades, revealed }: FinalResultCardProps) {
  const shown = useAnimatedNumber(revealed ? me.portfolioValue : me.startingBalance, 900);
  const rankColor = PLACE_COLORS[rank - 1] ?? T.user;

  let relation: React.ReactNode = null;
  if (rank === 1 && below) {
    relation = <>You won the competition, {formatUSD(me.portfolioValue - below.portfolioValue, 0)} ahead of <b className="font-semibold text-[#F3F5F4]">{below.name || 'Trader'}</b>.</>;
  } else if (above) {
    relation = <>You finished 1 position behind <b className="font-semibold text-[#F3F5F4]">{above.name || 'Trader'}</b>, {formatUSD(above.portfolioValue - me.portfolioValue, 0)} short.</>;
  }

  const stats = [
    { label: 'Starting Capital', value: formatUSD(me.startingBalance), color: T.text },
    { label: 'Final Value', value: formatUSD(me.portfolioValue), color: T.text },
    { label: 'Net P&L', value: formatSignedUSD(me.pnl), color: toneColor(me.pnl) },
    { label: 'Return', value: formatPct(me.returnPct, 2), color: toneColor(me.returnPct) },
    ...(trades !== null ? [{ label: 'Trades', value: String(trades), color: T.text }] : []),
  ];

  return (
    <section className="rounded-md border bg-[#0D1419] p-5" style={{ borderColor: `${T.user}99` }} aria-label="Your final result">
      <div className="flex items-start justify-between gap-4">
        <Eyebrow color={T.user}>Your Final Result</Eyebrow>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border tracking-[0.12em]" style={{ color: T.user, borderColor: `${T.user}66` }}>YOU</span>
      </div>

      <div className="mt-4 flex items-end gap-5">
        <div className="shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#65737A]">Final Ranking</div>
          <div className="mt-1 flex items-baseline gap-1 tabular-nums">
            <span className="text-5xl font-semibold leading-none" style={{ color: rankColor }}>#{pad(rank)}</span>
            <span className="text-lg text-[#65737A]">/ {total}</span>
          </div>
        </div>
        <div className="min-w-0 pb-0.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#65737A]">Final Portfolio</div>
          <div className="mt-1 text-2xl sm:text-3xl font-semibold tabular-nums text-[#F3F5F4] truncate">{formatUSD(shown)}</div>
          <div className="text-sm font-medium tabular-nums" style={{ color: toneColor(me.pnl) }}>
            {formatSignedUSD(me.pnl)} <span className="text-[#65737A]">·</span> {formatPct(me.returnPct, 2)}
          </div>
        </div>
      </div>

      {relation && <p className="mt-4 text-sm text-[#A4AFB4] leading-relaxed">{relation}</p>}

      <div className="mt-5 pt-4 border-t border-[#26343C]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#65737A] mb-3">Your Final Performance</div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="text-[11px] text-[#65737A]">{s.label}</dt>
              <dd className="text-sm font-semibold tabular-nums truncate" style={{ color: s.color }}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
