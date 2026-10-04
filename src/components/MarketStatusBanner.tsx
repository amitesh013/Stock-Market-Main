import React, { useEffect, useState } from 'react';
import { Activity, Clock, Megaphone, TrendingDown, TrendingUp, PauseCircle, Award } from 'lucide-react';
import { MarketState, formatCountdown } from '../lib/marketState';

interface MarketStatusBannerProps {
  market: MarketState;
}

export default function MarketStatusBanner({ market }: MarketStatusBannerProps) {
  const { status, activeEvent } = market;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!activeEvent) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeEvent?.eventId]);

  if (status === 'COMPLETED') {
    return (
      <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50 flex items-center gap-3">
        <Award className="w-5 h-5 text-amber-600 shrink-0" />
        <div>
          <div className="text-sm font-bold text-amber-900">Simulation Complete</div>
          <div className="text-xs text-amber-800">Trading is closed. Final standings are based on final portfolio value.</div>
        </div>
      </div>
    );
  }

  if (status !== 'RUNNING') {
    return (
      <div className="p-4 rounded-2xl border border-zinc-200 bg-white flex items-center gap-3">
        <PauseCircle className="w-5 h-5 text-zinc-500 shrink-0" />
        <div>
          <div className="text-sm font-bold text-zinc-800">
            {status === 'PAUSED' ? 'Market Paused' : 'Market Not Open Yet'}
          </div>
          <div className="text-xs text-zinc-500">Trading will be available once the admin opens the market.</div>
        </div>
      </div>
    );
  }

  if (!activeEvent) {
    return (
      <div className="p-4 rounded-2xl border border-green-200 bg-green-50/70 flex items-center gap-3">
        <span className="relative flex w-3 h-3 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping motion-reduce:animate-none" />
          <span className="relative inline-flex w-3 h-3 rounded-full bg-green-500" />
        </span>
        <div className="flex-1">
          <div className="text-sm font-bold text-green-900 flex items-center gap-1.5">
            <Activity className="w-4 h-4" /> Normal Market
          </div>
          <div className="text-xs text-green-800">
            No active news. Prices move on participant trading and normal volatility.
          </div>
        </div>
      </div>
    );
  }

  const isPositive = activeEvent.sentiment === 'POSITIVE';
  const remainingMs = activeEvent.expiresAtMs - now;
  const totalMs = Math.max(1, activeEvent.expiresAtMs - activeEvent.triggeredAtMs);
  const remainingPct = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  const tone = isPositive
    ? { wrap: 'border-emerald-300 bg-emerald-50', accent: 'text-emerald-800', bar: 'bg-emerald-500', pill: 'bg-emerald-600' }
    : { wrap: 'border-rose-300 bg-rose-50', accent: 'text-rose-800', bar: 'bg-rose-500', pill: 'bg-rose-600' };

  return (
    <div className={`rounded-2xl border-2 ${tone.wrap} overflow-hidden`}>
      <div className="p-4 flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white rounded-full flex items-center gap-1.5 ${tone.pill}`}>
              <Megaphone className="w-3.5 h-3.5" /> News Event Active
            </span>
            <span className={`text-[11px] font-bold flex items-center gap-1 ${tone.accent}`}>
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {isPositive ? 'Positive' : 'Negative'}
            </span>
          </div>
          <h2 className="text-base font-extrabold text-zinc-900 leading-snug">{activeEvent.headline}</h2>
          {activeEvent.description && (
            <p className="text-xs text-zinc-700 leading-relaxed">{activeEvent.description}</p>
          )}
          {activeEvent.affectedStocks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeEvent.affectedStocks.map((s) => (
                <span
                  key={s.ticker}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                    s.direction === 'UP' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {s.direction === 'UP' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {s.ticker}
                  {s.strength && <span className="font-medium opacity-80">· {s.strength.toLowerCase()}</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 bg-zinc-900 text-white px-4 py-2.5 rounded-xl text-center min-w-[140px]">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">News effect ends in</div>
          <div className="text-2xl font-mono font-bold flex items-center justify-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-400" />
            {formatCountdown(remainingMs)}
          </div>
        </div>
      </div>
      <div className="h-1.5 bg-zinc-200/70">
        <div className={`h-full ${tone.bar} transition-all duration-1000 ease-linear`} style={{ width: `${remainingPct}%` }} />
      </div>
    </div>
  );
}
