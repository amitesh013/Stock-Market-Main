import React from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import { LiveStock } from '../../lib/liveData';
import { formatCountdown } from '../../lib/marketState';
import { NewsEventItem, eventLabel, eventSectors, eventWindowMs } from '../../lib/newsEvents';
import { DirectionTag, MetaLabel, SectorChips, StatusChip, statusTone } from './newsUi';

interface EventListProps {
  events: NewsEventItem[];
  stocks: LiveStock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyText: string;
  /** Rendered under the selected row below the desktop breakpoint, where there is no side panel. */
  renderInline: (event: NewsEventItem) => React.ReactNode;
}

export default function EventList({ events, stocks, selectedId, onSelect, emptyText, renderInline }: EventListProps) {
  if (!events.length) {
    return <div className="rounded-md border border-dashed border-[#26343C] px-5 py-8 text-center text-sm text-[#A4AFB4]">{emptyText}</div>;
  }
  return (
    <ul className="space-y-2.5">
      {events.map((e) => (
        <li key={e.id}>
          <EventRow event={e} stocks={stocks} selected={selectedId === e.id} onSelect={onSelect} />
          {selectedId === e.id && <div className="lg:hidden mt-2">{renderInline(e)}</div>}
        </li>
      ))}
    </ul>
  );
}

function EventRow({ event, stocks, selected, onSelect }: { event: NewsEventItem; stocks: LiveStock[]; selected: boolean; onSelect: (id: string) => void }) {
  const windowMs = eventWindowMs(event);
  const tone = statusTone(event);
  return (
    <article
      className={`relative rounded-md border bg-[#0D1419] px-4 py-3.5 transition-colors duration-200 ${selected ? 'border-[#34444D] bg-[#111A20]' : 'border-[#26343C] hover:border-[#34444D]'}`}
    >
      {event.status !== 'COMPLETED' && (
        <span aria-hidden="true" className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full" style={{ backgroundColor: tone }} />
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A4AFB4] tabular-nums">{eventLabel(event.number)}</span>
          <StatusChip event={event} />
        </div>
        <button
          onClick={() => onSelect(event.id)}
          aria-expanded={selected}
          className="group shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A4AFB4] hover:text-[#F3F5F4] transition-colors duration-200 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
        >
          {selected ? 'Hide' : 'View Event'}
          <ArrowRight className={`w-3.5 h-3.5 transition-transform duration-200 ${selected ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} />
        </button>
      </div>

      <h3 className="mt-2 text-sm font-semibold leading-snug text-[#F3F5F4] line-clamp-2">{event.headline}</h3>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] gap-x-5 gap-y-2 text-xs">
        <div>
          <MetaLabel>Window</MetaLabel>
          <div className="mt-0.5 inline-flex items-center gap-1 tabular-nums text-[#D2D8DA]">
            <Clock className="w-3 h-3 text-[#65737A]" />
            {windowMs ? formatCountdown(windowMs) : event.source === 'BULLETIN' ? 'Instant' : '—'}
          </div>
        </div>
        <div className="order-last col-span-2 sm:order-none sm:col-span-1 min-w-0">
          <MetaLabel>Sectors</MetaLabel>
          <div className="mt-1"><SectorChips sectors={eventSectors(event, stocks)} /></div>
        </div>
        <div>
          <MetaLabel>Market impact</MetaLabel>
          <div className="mt-0.5"><DirectionTag event={event} /></div>
        </div>
      </div>
    </article>
  );
}
