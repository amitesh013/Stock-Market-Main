import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Megaphone, Pause } from 'lucide-react';
import { MarketState, formatCountdown } from '../../lib/marketState';
import { LiveStock } from '../../lib/liveData';
import { T, formatPct, toneColor } from '../dashboard/ui';

export default function MarketEventBanner({ market, stocks }: { market: MarketState; stocks: LiveStock[] }) {
  const { status, activeEvent } = market;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!activeEvent) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeEvent?.eventId]);

  if (status === 'RUNNING' && activeEvent) {
    const affected = new Set(activeEvent.affectedStocks.map((s) => (s.ticker || '').toUpperCase()));
    const hit = stocks.filter((s) => affected.has(s.ticker.toUpperCase()));
    const impact = hit.length ? hit.reduce((sum, s) => sum + s.changePercent, 0) / hit.length : null;
    const tone = activeEvent.sentiment === 'POSITIVE' ? T.positive : T.negative;

    return (
      <Link
        to="/news"
        className="group mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border bg-[#0D1419] px-4 py-3 transition-colors duration-200 hover:bg-[#111A20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
        style={{ borderColor: `${tone}55` }}
      >
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: tone }}>
          <Megaphone className="w-3.5 h-3.5" /> Live Market Event
        </span>
        <span className="text-sm font-semibold text-[#F3F5F4] min-w-0 flex-1 truncate">{activeEvent.headline}</span>
        <span className="text-xs text-[#A4AFB4] tabular-nums">
          <span className="font-semibold text-[#F3F5F4]">{formatCountdown(activeEvent.expiresAtMs - now)}</span> remaining
        </span>
        <span className="text-xs text-[#A4AFB4]">
          Market impact{' '}
          <span className="font-semibold tabular-nums" style={{ color: impact === null ? T.text2 : toneColor(impact) }}>
            {impact === null ? '—' : formatPct(impact, 1)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A4AFB4] group-hover:text-[#F3F5F4]">
          View Event <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </Link>
    );
  }

  if (status === 'RUNNING') return null;

  const closed = status !== 'PAUSED';
  const copy =
    status === 'COMPLETED'
      ? { title: 'Market Closed', note: 'The competition has ended. Final rankings are locked.' }
      : status === 'PAUSED'
      ? { title: 'Market Paused', note: 'Trading is temporarily paused by the admin.' }
      : { title: 'Pre-Market', note: 'Trading will begin once the admin opens the market.' };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-[#26343C] bg-[#0D1419] px-4 py-3">
      <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F3F5F4]">
        {closed ? <Lock className="w-3.5 h-3.5 text-[#FF4D5A]" /> : <Pause className="w-3.5 h-3.5 text-[#3B82FF]" />}
        {copy.title}
      </span>
      <span className="text-sm text-[#A4AFB4]">{copy.note} Charts and prices stay available for analysis.</span>
    </div>
  );
}
