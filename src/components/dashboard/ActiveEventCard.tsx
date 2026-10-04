import React, { useEffect, useState } from 'react';
import { Megaphone, Clock } from 'lucide-react';
import { MarketState, formatCountdown } from '../../lib/marketState';
import { LiveStock } from '../../lib/liveData';
import { Card, CardTitle, Eyebrow, ViewLink, T, formatPct, toneColor } from './ui';

const toMillis = (v: any): number => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'number') return v;
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
};

export default function ActiveEventCard({ market, stocks }: { market: MarketState; stocks: LiveStock[] }) {
  const event = market.activeEvent;
  // Optional: scheduled next event on simulation/config (pending TL1/TL2 schema).
  const next = market.config?.nextNewsEvent;
  const nextStartsAt = toMillis(next?.startsAt);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!event && !nextStartsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [event?.eventId, nextStartsAt]);

  if (event) {
    const affected = new Set(event.affectedStocks.map((s) => (s.ticker || '').toUpperCase()));
    const affectedStocks = stocks.filter((s) => affected.has(s.ticker.toUpperCase()));
    const impact = affectedStocks.length
      ? affectedStocks.reduce((sum, s) => sum + s.changePercent, 0) / affectedStocks.length
      : null;
    const tone = event.sentiment === 'POSITIVE' ? T.positive : T.negative;
    const remainingMs = event.expiresAtMs - now;
    const totalMs = Math.max(1, event.expiresAtMs - event.triggeredAtMs);
    const remainingPct = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

    return (
      <Card className="h-full flex flex-col" >
        <div className="flex items-center justify-between gap-3 mb-4">
          <Eyebrow color={tone}>
            <span className="inline-flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5" /> Live Event
            </span>
          </Eyebrow>
          <ViewLink to="/news">View Event</ViewLink>
        </div>

        <h3 className="text-[15px] font-semibold leading-snug text-[#F3F5F4] line-clamp-2">{event.headline}</h3>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">Time left</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-[#F3F5F4] flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#65737A]" />
              {formatCountdown(remainingMs)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">Market impact</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: impact === null ? T.text2 : toneColor(impact) }}>
              {impact === null ? '—' : formatPct(impact, 1)}
            </div>
          </div>
        </div>

        {event.affectedStocks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {event.affectedStocks.map((s) => (
              <span
                key={s.ticker}
                className="inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded border border-[#26343C] text-[#D2D8DA]"
              >
                {s.ticker}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-4">
          <div className="h-[3px] rounded-full bg-[#111A20] overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${remainingPct}%`, backgroundColor: tone }} />
          </div>
        </div>
      </Card>
    );
  }

  if (next?.headline) {
    return (
      <Card className="h-full flex flex-col">
        <CardTitle right={<ViewLink to="/news">View Events</ViewLink>}>Next Event</CardTitle>
        <h3 className="text-[15px] font-semibold leading-snug text-[#F3F5F4] line-clamp-2">{next.headline}</h3>
        {nextStartsAt > 0 && (
          <div className="mt-auto pt-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">Starts in</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: T.cyan }}>
              {formatCountdown(nextStartsAt - now)}
            </div>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardTitle right={<ViewLink to="/news">View Events</ViewLink>}>Market News</CardTitle>
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-[15px] font-semibold text-[#F3F5F4]">No live event</div>
        <p className="text-sm text-[#A4AFB4] mt-1.5 leading-relaxed">
          Prices move on trading activity. When news breaks, it appears here with a 15-minute countdown.
        </p>
      </div>
    </Card>
  );
}
