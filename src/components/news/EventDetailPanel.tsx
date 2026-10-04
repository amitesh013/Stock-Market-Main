import React from 'react';
import { X } from 'lucide-react';
import { T } from '../dashboard/ui';
import { LiveStock } from '../../lib/liveData';
import { formatCountdown } from '../../lib/marketState';
import { NewsEventItem, eventLabel, eventSectors, eventWindowMs, sectorResponse } from '../../lib/newsEvents';
import MarketResponse from './MarketResponse';
import AffectedAssets from './AffectedAssets';
import { DirectionTag, MetaLabel, SectorChips, StatusChip, formatClockSec } from './newsUi';

interface EventDetailPanelProps {
  event: NewsEventItem;
  stocks: LiveStock[];
  now: number;
  onClose: () => void;
  inline?: boolean;
}

const SOURCE_LABEL: Record<NewsEventItem['source'], string> = {
  EVENT: 'Market event',
  BULLETIN: 'News bulletin',
  SCHEDULED: 'Scheduled event',
};

export default function EventDetailPanel({ event, stocks, now, onClose, inline = false }: EventDetailPanelProps) {
  const windowMs = eventWindowMs(event);
  const rows = sectorResponse(event, stocks);
  return (
    <section
      className={`mk-fade ${inline ? 'rounded-lg border border-[#26343C] bg-[#06090B]/60 p-4' : 'rounded-md border border-[#26343C] bg-[#0D1419] p-5'}`}
      aria-label={`${eventLabel(event.number)} details`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A4AFB4] tabular-nums">{eventLabel(event.number)}</span>
          <StatusChip event={event} />
        </div>
        <button
          onClick={onClose}
          aria-label="Close event details"
          className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md text-[#A4AFB4] hover:text-[#F3F5F4] hover:bg-[#111A20] transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!inline && <h3 className="mt-3 text-base font-semibold leading-snug text-[#F3F5F4]">{event.headline}</h3>}
      {event.description && <p className="mt-1.5 text-[13px] leading-relaxed text-[#A4AFB4]">{event.description}</p>}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <div>
          <dt><MetaLabel>Start</MetaLabel></dt>
          <dd className="mt-0.5 tabular-nums text-[#F3F5F4]">{formatClockSec(event.startMs)}</dd>
        </div>
        <div>
          <dt><MetaLabel>End</MetaLabel></dt>
          <dd className="mt-0.5 tabular-nums text-[#F3F5F4]">{formatClockSec(event.endMs)}</dd>
        </div>
        <div>
          <dt><MetaLabel>Impact window</MetaLabel></dt>
          <dd className="mt-0.5 tabular-nums text-[#F3F5F4]">
            {windowMs ? formatCountdown(windowMs) : event.source === 'BULLETIN' ? 'Instant' : '—'}
            {event.status === 'ACTIVE' && event.endMs && (
              <span className="ml-1.5 text-[#A4AFB4]">({formatCountdown(event.endMs - now)} left)</span>
            )}
          </dd>
        </div>
        <div>
          <dt><MetaLabel>Market impact</MetaLabel></dt>
          <dd className="mt-0.5"><DirectionTag event={event} /></dd>
        </div>
        <div className="col-span-2">
          <dt><MetaLabel>Type</MetaLabel></dt>
          <dd className="mt-0.5 text-[#D2D8DA]">{SOURCE_LABEL[event.source]}</dd>
        </div>
        <div className="col-span-2">
          <dt className="mb-1"><MetaLabel>Affected sectors</MetaLabel></dt>
          <dd><SectorChips sectors={eventSectors(event, stocks)} /></dd>
        </div>
        {event.affected.length > 0 && (
          <div className="col-span-2">
            <dt className="mb-1"><MetaLabel>Affected stocks</MetaLabel></dt>
            <dd className="text-[#D2D8DA]">{event.affected.map((a) => a.ticker).join(', ')}</dd>
          </div>
        )}
      </dl>

      {event.status !== 'UPCOMING' && (
        <div className="mt-5">
          <div className="mb-2.5"><MetaLabel>Market response</MetaLabel></div>
          <MarketResponse rows={rows} revealKey={event.id} />
        </div>
      )}

      {(event.affected.length > 0 || event.marketWide) && (
        <div className="mt-5">
          <div className="mb-1"><MetaLabel>Affected assets</MetaLabel></div>
          <AffectedAssets event={event} stocks={stocks} compact />
        </div>
      )}

      {event.status === 'UPCOMING' && (
        <p className="mt-4 text-xs leading-relaxed" style={{ color: T.text2 }}>
          Impact details are revealed when the event goes live.
        </p>
      )}
    </section>
  );
}
