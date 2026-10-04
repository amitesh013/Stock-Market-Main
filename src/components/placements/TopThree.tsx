import React from 'react';
import { LeaderboardEntry } from '../../lib/leaderboard';
import { Eyebrow, T, formatUSD, formatPct, toneColor } from '../dashboard/ui';
import { PLACE_COLORS } from './FinalRaceTrack';

const PLACE_LABEL = ['1st', '2nd', '3rd'];

export default function TopThree({ top, myId }: { top: LeaderboardEntry[]; myId?: string }) {
  if (!top.length) return null;
  return (
    <section className="rounded-md border border-[#26343C] bg-[#0D1419] p-5" aria-label="Top placements">
      <Eyebrow color={T.text}>Top Placements</Eyebrow>
      <ol className="mt-3 divide-y divide-[#26343C]">
        {top.map((u, i) => {
          const isMe = u.id === myId;
          const color = PLACE_COLORS[i];
          return (
            <li key={u.id} className="flex items-center gap-3 py-2.5">
              <span
                className="w-11 shrink-0 text-center rounded border text-[11px] font-semibold uppercase tracking-[0.08em] leading-6"
                style={{ color, borderColor: `${color}66`, backgroundColor: `${color}10` }}
              >
                {PLACE_LABEL[i]}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#F3F5F4]">
                {u.name || 'Trader'}
                {isMe && <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded border" style={{ color: T.user, borderColor: `${T.user}66` }}>YOU</span>}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold tabular-nums text-[#F3F5F4]">{formatUSD(u.portfolioValue)}</span>
                <span className="block text-xs tabular-nums" style={{ color: toneColor(u.returnPct) }}>{formatPct(u.returnPct, 2)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
