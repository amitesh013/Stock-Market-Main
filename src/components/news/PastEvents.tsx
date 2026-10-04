import React from 'react';
import { ChevronDown } from 'lucide-react';
import { LiveStock } from '../../lib/liveData';
import { formatCountdown } from '../../lib/marketState';
import { NewsEventItem, eventLabel, eventSectors, eventWindowMs, sectorResponse } from '../../lib/newsEvents';
import MarketResponse from './MarketResponse';
import { DirectionTag, MetaLabel, SectorChips, formatClock } from './newsUi';

interface PastEventsProps {
  events: NewsEventItem[];
  stocks: LiveStock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function PastEvents({ events, stocks, selectedId, onSelect }: PastEventsProps) {
  if (!events.length) {
    return (
      <div className="rounded-md border border-dashed border-[#26343C] px-5 py-8 text-center text-sm text-[#A4AFB4]">
        No events have completed yet.
      </div>
    );
  }

  return (
    <ul className="rounded-md border border-[#26343C] bg-[#0D1419] divide-y divide-[#26343C]/80 overflow-hidden">
      {events.map((e) => {
        const open = selectedId === e.id;
        const windowMs = eventWindowMs(e);
        return (
          <li key={e.id}>
            <button
              onClick={() => onSelect(e.id)}
              aria-expanded={open}
              className={`w-full grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:bg-[#111A20] ${open ? 'bg-[#111A20]' : 'hover:bg-[#111A20]/60'}`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#65737A] tabular-nums whitespace-nowrap">
                ✓ {eventLabel(e.number)}
              </span>
              <span className={`truncate text-[13px] ${open ? 'text-[#F3F5F4]' : 'text-[#A4AFB4]'}`}>{e.headline}</span>
              <span className="text-[11px] tabular-nums text-[#65737A]">{formatClock(e.startMs)}</span>
              <ChevronDown className={`w-4 h-4 text-[#65737A] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="mk-fade px-4 pb-4 pt-1 bg-[#111A20]/40">
                <p className="text-sm font-medium leading-snug text-[#F3F5F4]">{e.headline}</p>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-xs">
                  <div>
                    <MetaLabel>Window</MetaLabel>
                    <div className="mt-0.5 tabular-nums text-[#D2D8DA]">
                      {e.endMs ? `${formatClock(e.startMs)} – ${formatClock(e.endMs)}` : formatClock(e.startMs)}
                    </div>
                  </div>
                  <div>
                    <MetaLabel>Duration</MetaLabel>
                    <div className="mt-0.5 tabular-nums text-[#D2D8DA]">{windowMs ? formatCountdown(windowMs) : 'Instant'}</div>
                  </div>
                  <div>
                    <MetaLabel>Market impact</MetaLabel>
                    <div className="mt-0.5"><DirectionTag event={e} /></div>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <MetaLabel>Sectors</MetaLabel>
                    <div className="mt-1"><SectorChips sectors={eventSectors(e, stocks)} /></div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2"><MetaLabel>Response</MetaLabel></div>
                  <MarketResponse
                    rows={sectorResponse(e, stocks)}
                    revealKey={e.id}
                    caption="Current change of affected assets · close-of-event snapshot not recorded"
                  />
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
