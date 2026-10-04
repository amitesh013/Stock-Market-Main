import React from 'react';
import { formatCountdown } from '../../lib/marketState';
import { T } from '../dashboard/ui';
import { MetaLabel, formatClock } from './newsUi';

interface EventCountdownProps {
  startMs: number | null;
  endMs: number | null;
  now: number;
  tone: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function EventCountdown({ startMs, endMs, now, tone, className = '', style }: EventCountdownProps) {
  if (!endMs) return null;
  const remaining = endMs - now;
  const ended = remaining <= 0;
  const total = startMs && endMs > startMs ? endMs - startMs : null;
  const pct = total ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  return (
    <div className={`rounded-lg border border-[#26343C] bg-[#06090B]/60 px-4 py-3 ${className}`} style={style}>
      <div className="flex items-center justify-between gap-3">
        <MetaLabel>Event Window</MetaLabel>
        <span className="text-[11px] tabular-nums text-[#65737A]">
          {formatClock(startMs)} – {formatClock(endMs)}
        </span>
      </div>
      <div
        className="mt-1 text-3xl font-semibold tabular-nums tracking-tight"
        style={{ color: ended ? T.text2 : T.text }}
        role="timer"
        aria-live="off"
      >
        {ended ? <span className="text-xl uppercase tracking-[0.14em]">Event Ended</span> : formatCountdown(remaining)}
      </div>
      {total && (
        <div className="mt-2.5 h-[3px] rounded-full bg-[#111A20] overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
            style={{ width: `${pct}%`, backgroundColor: ended ? T.muted : tone }}
          />
        </div>
      )}
    </div>
  );
}
