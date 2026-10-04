import React from 'react';
import { ArrowRight, Radio } from 'lucide-react';
import { T } from '../dashboard/ui';
import { LiveStock } from '../../lib/liveData';
import { formatCountdown } from '../../lib/marketState';
import { NewsEventItem, eventLabel, sectorResponse } from '../../lib/newsEvents';
import EventCountdown from './EventCountdown';
import MarketResponse from './MarketResponse';
import { MetaLabel, StatusChip, sentimentTone } from './newsUi';

interface ActiveEventHeroProps {
  featured: NewsEventItem | null;
  next: NewsEventItem | null;
  status: string;
  now: number;
  stocks: LiveStock[];
  onView: (id: string) => void;
}

const stagger = (i: number): React.CSSProperties => ({ animationDelay: `${i * 140}ms` });

export default function ActiveEventHero({ featured, next, status, now, stocks, onView }: ActiveEventHeroProps) {
  if (!featured) return <IdleHero next={next} status={status} now={now} onView={onView} />;

  const live = featured.status === 'ACTIVE';
  const tone = live ? sentimentTone(featured) : T.muted;
  const rows = sectorResponse(featured, stocks);

  return (
    <section
      key={featured.id}
      className="relative overflow-hidden rounded-md border bg-[#0D1419] p-5 sm:p-6"
      style={{ borderColor: live ? `${tone}55` : T.border }}
      aria-label={live ? 'Live market event' : 'Last market event'}
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px]" style={{ backgroundColor: tone, opacity: live ? 0.8 : 0.4 }} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: live ? tone : T.text2 }}>
            {live && <span aria-hidden="true" className="ne-live-dot">●</span>}
            {live ? 'Live Market Event' : 'Last Market Event'}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65737A] tabular-nums">{eventLabel(featured.number)}</span>
        </div>
        <button
          onClick={() => onView(featured.id)}
          className="group inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A4AFB4] hover:text-[#F3F5F4] transition-colors duration-200 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
        >
          View Event
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>

      <h2 className="ne-reveal mt-3 text-xl sm:text-2xl font-semibold leading-snug tracking-tight text-[#F3F5F4]" style={stagger(0)}>
        {featured.headline}
      </h2>
      {featured.description && (
        <p className="ne-reveal mt-2 text-sm leading-relaxed text-[#A4AFB4] max-w-[62ch]" style={stagger(1)}>
          {featured.description}
        </p>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_13.5rem] md:items-start">
        <div className="ne-reveal min-w-0" style={stagger(2)}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <MetaLabel>Event Impact</MetaLabel>
            <StatusChip event={featured} />
          </div>
          <MarketResponse rows={rows} revealKey={featured.id} emptyText="Waiting for live prices on the affected assets." />
          {featured.affected.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {featured.affected.map((a) => (
                <span key={a.ticker} className="inline-flex items-center h-5 px-1.5 rounded border border-[#26343C] text-[11px] font-semibold text-[#D2D8DA]">
                  {a.ticker}
                </span>
              ))}
            </div>
          )}
        </div>

        <EventCountdown
          className="ne-reveal order-first md:order-last"
          style={stagger(3)}
          startMs={featured.startMs}
          endMs={featured.endMs}
          now={now}
          tone={tone}
        />
      </div>
    </section>
  );
}

function IdleHero({ next, status, now, onView }: { next: NewsEventItem | null; status: string; now: number; onView: (id: string) => void }) {
  const closed = status !== 'RUNNING';
  return (
    <section className="rounded-md border border-[#26343C] bg-[#0D1419] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A4AFB4]">
        <Radio className="w-3.5 h-3.5" />
        {closed ? 'Market Closed' : 'No Live Event'}
      </div>
      <h2 className="mt-3 text-lg font-semibold text-[#F3F5F4]">
        {status === 'COMPLETED' ? 'The simulation has ended.' : closed ? 'Events resume when the market opens.' : 'Prices are moving on trading activity.'}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-[#A4AFB4] max-w-[60ch]">
        When the organisers trigger a market event it appears here with its impact window, affected sectors and a live countdown.
      </p>

      {next && (
        <button
          onClick={() => onView(next.id)}
          className="mt-5 w-full text-left rounded-lg border px-4 py-3 transition-colors duration-200 hover:bg-[#111A20] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
          style={{ borderColor: `${T.user}44` }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: T.user }}>○ Next Event</span>
            {next.startMs && next.startMs > now && (
              <span className="text-sm font-semibold tabular-nums" style={{ color: T.user }}>in {formatCountdown(next.startMs - now)}</span>
            )}
          </div>
          <div className="mt-1 text-sm font-medium text-[#F3F5F4] line-clamp-2">{next.headline}</div>
        </button>
      )}
    </section>
  );
}
