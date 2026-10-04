import React from 'react';
import { T } from '../dashboard/ui';

export type EventTab = 'ACTIVE' | 'UPCOMING' | 'PAST';

const TABS: { id: EventTab; label: string }[] = [
  { id: 'ACTIVE', label: 'Active' },
  { id: 'UPCOMING', label: 'Upcoming' },
  { id: 'PAST', label: 'Past' },
];

function marketPill(status: string): { label: string; color: string; dot: string } {
  if (status === 'RUNNING') return { label: 'Live Market', color: T.positive, dot: '●' };
  if (status === 'PAUSED') return { label: 'Market Paused', color: T.gold, dot: '❚❚' };
  if (status === 'COMPLETED') return { label: 'Simulation Complete', color: T.text2, dot: '✓' };
  return { label: 'Market Not Open', color: T.text2, dot: '○' };
}

interface NewsHeaderProps {
  status: string;
  total: number;
  tab: EventTab;
  onTab: (t: EventTab) => void;
  counts: Record<EventTab, number>;
}

export default function NewsHeader({ status, total, tab, onTab, counts }: NewsHeaderProps) {
  const pill = marketPill(status);
  return (
    <header className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-[#F3F5F4]">News Events</h1>
          <p className="text-sm text-[#A4AFB4] mt-0.5">Market intelligence driving the simulation.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
          <span
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border"
            style={{ color: pill.color, borderColor: `${pill.color}44`, backgroundColor: `${pill.color}10` }}
          >
            <span aria-hidden="true" className={status === 'RUNNING' ? 'ne-live-dot' : ''}>{pill.dot}</span>
            {pill.label}
          </span>
          <span className="inline-flex items-center h-7 px-2.5 rounded-md border border-[#26343C] text-[#A4AFB4] tabular-nums">
            {total} {total === 1 ? 'Event' : 'Events'}
          </span>
        </div>
      </div>

      <div className="mt-4 border-b border-[#26343C] flex gap-6" role="tablist" aria-label="Event filters">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => onTab(t.id)}
              className={`relative py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:text-[#F3F5F4] ${active ? 'text-[#F3F5F4]' : 'text-[#A4AFB4] hover:text-[#F3F5F4]'}`}
            >
              {t.label}
              <span className="ml-1.5 text-[11px] text-[#65737A] tabular-nums">{counts[t.id]}</span>
              <span className={`absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-[#3B82FF] transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          );
        })}
      </div>
    </header>
  );
}
