import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { LeaderboardEntry } from '../../lib/leaderboard';
import { Eyebrow, T, formatUSD, formatSignedUSD, formatPct, toneColor } from '../dashboard/ui';
import { PLACE_COLORS } from './FinalRaceTrack';

type SortKey = 'rank' | 'portfolio' | 'return';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'rank', label: 'Rank' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'return', label: 'Return' },
];
const CONTROLS_MIN = 8;

interface FinalResultsTableProps {
  standings: LeaderboardEntry[];
  myId?: string;
  trades: Record<string, number> | null;
}

export default function FinalResultsTable({ standings, myId, trades }: FinalResultsTableProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('rank');
  const showControls = standings.length >= CONTROLS_MIN;
  const grid = trades
    ? 'grid-cols-[3rem_minmax(0,1fr)_auto] sm:grid-cols-[3.5rem_minmax(0,1fr)_8.5rem_5.5rem] lg:grid-cols-[3.5rem_minmax(0,1fr)_9rem_8rem_5.5rem_4.5rem]'
    : 'grid-cols-[3rem_minmax(0,1fr)_auto] sm:grid-cols-[3.5rem_minmax(0,1fr)_8.5rem_5.5rem] lg:grid-cols-[3.5rem_minmax(0,1fr)_9rem_8rem_5.5rem]';

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = standings
      .map((u, i) => ({ u, rank: i + 1 }))
      .filter(({ u }) => !q || (u.name || 'trader').toLowerCase().includes(q));
    if (sort === 'return') list.sort((a, b) => b.u.returnPct - a.u.returnPct);
    else if (sort === 'portfolio') list.sort((a, b) => b.u.portfolioValue - a.u.portfolioValue);
    return list;
  }, [standings, query, sort]);

  return (
    <section className="rounded-md border border-[#26343C] bg-[#0D1419]" aria-label="Full final results">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <Eyebrow color={T.text}>Full Results</Eyebrow>
          <p className="text-xs text-[#A4AFB4] mt-1">{standings.length} participants · ranked by final portfolio value</p>
        </div>
        {showControls && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Search participants</span>
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#65737A]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search participant"
                className="h-8 w-44 rounded-md border border-[#26343C] bg-[#111A20] pl-8 pr-2 text-xs text-[#F3F5F4] placeholder:text-[#65737A] focus:outline-none focus:border-[#3B82FF]"
              />
            </label>
            <div className="flex rounded-md border border-[#26343C] p-0.5" role="group" aria-label="Sort results">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  aria-pressed={sort === s.key}
                  className={`h-7 px-2.5 rounded text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${sort === s.key ? 'bg-[#111A20] text-[#F3F5F4]' : 'text-[#65737A] hover:text-[#A4AFB4]'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`grid ${grid} gap-3 px-5 py-2 border-y border-[#26343C] bg-[#111A20] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]`} role="row">
        <span>Rank</span>
        <span>Participant</span>
        <span className="text-right">Final Portfolio</span>
        <span className="text-right hidden lg:block">Final P&amp;L</span>
        <span className="text-right hidden sm:block">Return</span>
        {trades && <span className="text-right hidden lg:block">Trades</span>}
      </div>

      <ul className="divide-y divide-[#26343C]">
        {rows.map(({ u, rank }) => {
          const isMe = u.id === myId;
          const placeColor = PLACE_COLORS[rank - 1];
          return (
            <li
              key={u.id}
              className={`grid ${grid} gap-3 items-center px-5 py-2.5 text-sm`}
              style={isMe ? { backgroundColor: '#111A20', boxShadow: `inset 0 0 0 1px ${T.user}99` } : undefined}
              aria-current={isMe ? 'true' : undefined}
            >
              <span className="font-semibold tabular-nums" style={{ color: isMe ? T.user : placeColor ?? T.text2 }}>
                #{String(rank).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex items-center gap-2">
                <span className={`truncate ${isMe ? 'font-semibold text-[#F3F5F4]' : 'font-medium text-[#D2D8DA]'}`}>{u.name || 'Trader'}</span>
                {isMe && <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border" style={{ color: T.user, borderColor: `${T.user}66` }}>YOU</span>}
                {placeColor && !isMe && <span className="sr-only">{['First', 'Second', 'Third'][rank - 1]} place</span>}
              </span>
              <span className="text-right tabular-nums text-[#F3F5F4]">
                {formatUSD(u.portfolioValue)}
                <span className="block sm:hidden text-xs" style={{ color: toneColor(u.returnPct) }}>{formatPct(u.returnPct, 2)}</span>
              </span>
              <span className="text-right tabular-nums hidden lg:block" style={{ color: toneColor(u.pnl) }}>{formatSignedUSD(u.pnl)}</span>
              <span className="text-right tabular-nums hidden sm:block" style={{ color: toneColor(u.returnPct) }}>{formatPct(u.returnPct, 2)}</span>
              {trades && <span className="text-right tabular-nums hidden lg:block text-[#A4AFB4]">{trades[u.id] || 0}</span>}
            </li>
          );
        })}
        {!rows.length && <li className="px-5 py-8 text-center text-sm text-[#65737A]">No participant matches "{query}".</li>}
      </ul>
    </section>
  );
}
