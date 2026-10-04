import React from 'react';
import { format } from 'date-fns';
import { T } from '../dashboard/ui';
import { NewsEventItem, eventDirection } from '../../lib/newsEvents';

export const sentimentTone = (event: Pick<NewsEventItem, 'sentiment'>) =>
  event.sentiment === 'NEGATIVE' ? T.negative : T.cyan;

export function statusTone(event: NewsEventItem): string {
  if (event.status === 'ACTIVE') return sentimentTone(event);
  if (event.status === 'UPCOMING') return T.user;
  return T.muted;
}

export function StatusChip({ event }: { event: NewsEventItem }) {
  const tone = statusTone(event);
  const label =
    event.status === 'ACTIVE' ? '● Live'
      : event.status === 'UPCOMING' ? '○ Next'
        : event.source === 'BULLETIN' ? '✓ Published' : '✓ Ended';
  return (
    <span
      className="shrink-0 inline-flex items-center h-5 px-1.5 rounded border text-[10px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap"
      style={{ color: event.status === 'COMPLETED' ? T.text2 : tone, borderColor: `${tone}55`, backgroundColor: `${tone}12` }}
    >
      {label}
    </span>
  );
}

/** News describes impact, never a trade: Positive / Negative / Mixed rather than buy/sell or price targets. */
export const impactLabel = (dir: 'UP' | 'DOWN' | 'MIXED' | null | undefined) =>
  dir === 'UP' ? 'Positive' : dir === 'DOWN' ? 'Negative' : dir === 'MIXED' ? 'Mixed' : 'Neutral';

export function DirectionTag({ event }: { event: NewsEventItem }) {
  const dir = event.status === 'UPCOMING' ? null : eventDirection(event);
  if (!dir) return <span className="text-[#65737A]">—</span>;
  const color = dir === 'UP' ? T.positive : dir === 'DOWN' ? T.negative : T.text2;
  return (
    <span className="inline-flex items-center gap-1.5 font-medium" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {impactLabel(dir)}
    </span>
  );
}

export function MetaLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]">{children}</div>;
}

export function SectorChips({ sectors }: { sectors: string[] }) {
  if (!sectors.length) return <span className="text-xs text-[#65737A]">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {sectors.map((s) => (
        <span key={s} className="h-5 inline-flex items-center px-1.5 rounded border border-[#26343C] bg-[#111A20] text-[11px] font-medium text-[#D2D8DA]">
          {s}
        </span>
      ))}
    </div>
  );
}

export const formatClock = (ms: number | null) => (ms ? format(ms, 'HH:mm') : '—');
export const formatClockSec = (ms: number | null) => (ms ? format(ms, 'HH:mm:ss') : '—');
