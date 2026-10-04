import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Trophy } from 'lucide-react';
import { MarketState, formatCountdown } from '../../lib/marketState';
import { LiveStock } from '../../lib/liveData';
import { MiniSparkline, T, formatPct, toneColor } from './ui';

const STEPS = [
  { label: 'Pre-Market', sub: 'Waiting' },
  { label: 'Market Open', sub: 'Trading' },
  { label: 'Active Events', sub: 'News impact' },
  { label: 'Final Rankings', sub: 'Results' },
];

// Deterministic decorative price line that climbs toward a finish flag on the right.
const BACKDROP_PATH = (() => {
  let h = 0x2f6b1d3;
  const rand = () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pts: string[] = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = 500 + t * 440;
    const trend = 170 - Math.pow(t, 1.6) * 130;
    const noise = (rand() - 0.5) * 22 * (1 - t * 0.7);
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${(trend + noise).toFixed(1)}`);
  }
  return pts.join(' ');
})();

function stageFor(market: MarketState): number {
  if (market.status === 'COMPLETED') return 3;
  if (market.status === 'RUNNING') return market.activeEvent ? 2 : 1;
  if (market.status === 'PAUSED') return 1;
  return 0;
}

export default function MarketStatusHero({ market, stocks }: { market: MarketState; stocks: LiveStock[] }) {
  const navigate = useNavigate();
  const { status, activeEvent } = market;
  const isOpen = status === 'RUNNING';
  const stage = stageFor(market);

  const avgChange = stocks.length ? stocks.reduce((sum, s) => sum + s.changePercent, 0) / stocks.length : 0;
  const historyRef = useRef<number[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  useEffect(() => {
    if (!stocks.length) return;
    const last = historyRef.current[historyRef.current.length - 1];
    if (last !== undefined && Math.abs(last - avgChange) < 1e-6) return;
    historyRef.current = [...(historyRef.current.length ? historyRef.current : [0]), avgChange].slice(-40);
    setHistory(historyRef.current);
  }, [avgChange, stocks.length]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!activeEvent) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeEvent?.eventId]);

  const copy =
    status === 'RUNNING'
      ? { eyebrow: 'Market Live', dot: T.cyan, lead: 'Live', accent: 'Market', note: 'Everyone trades at the same price. Every trade changes your position.' }
      : status === 'PAUSED'
      ? { eyebrow: 'Market Paused', dot: T.gold, lead: 'Trading', accent: 'Paused', note: 'The admin has paused trading. Your positions are safe.' }
      : status === 'COMPLETED'
      ? { eyebrow: 'Competition Complete', dot: T.gold, lead: 'Final', accent: 'Rankings', note: 'The market has closed. Final placements are locked.' }
      : { eyebrow: 'Pre-Market', dot: T.user, lead: 'Market', accent: 'Not Open Yet', note: 'Trading will begin once the admin opens the market.' };

  return (
    <section className="relative overflow-hidden rounded-md border border-[#26343C] bg-[#0D1419]">
      {/* Backdrop: thin price path rising to a finish flag */}
      <svg
        className="hidden md:block absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1000 220"
        preserveAspectRatio="xMaxYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="hero-fade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={T.chart} stopOpacity="0" />
            <stop offset="0.35" stopColor={T.chart} stopOpacity="0.45" />
            <stop offset="1" stopColor={T.chart} stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {[60, 110, 160].map((y) => (
          <line key={y} x1="500" x2="1000" y1={y} y2={y} stroke={T.border} strokeOpacity="0.6" strokeDasharray="2 6" />
        ))}
        <path d={BACKDROP_PATH} fill="none" stroke="url(#hero-fade)" strokeWidth="1.5" strokeLinejoin="round" />
        <g transform="translate(940 30)" opacity="0.85">
          <line x1="0" x2="0" y1="0" y2="22" stroke={T.text2} strokeWidth="1" />
          <path d="M0 0 L12 3.5 L0 7 Z" fill={T.gold} />
        </g>
      </svg>

      <div className="relative p-5 sm:p-6 lg:p-7 flex flex-col lg:flex-row lg:items-end gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: copy.dot }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: T.text2 }}>
              {copy.eyebrow}
            </span>
            {isOpen && (
              activeEvent ? (
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded border"
                  style={{
                    color: activeEvent.sentiment === 'POSITIVE' ? T.positive : T.negative,
                    borderColor: `${activeEvent.sentiment === 'POSITIVE' ? T.positive : T.negative}55`,
                  }}
                >
                  News event · <span className="tabular-nums">{formatCountdown(activeEvent.expiresAtMs - now)}</span>
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded border border-[#26343C] text-[#A4AFB4]">
                  Normal Market
                </span>
              )
            )}
          </div>

          <h1 className="mt-3 text-[28px] sm:text-[34px] leading-[1.1] font-semibold tracking-tight text-[#F3F5F4]">
            {copy.lead} <span style={{ color: status === 'COMPLETED' ? T.gold : status === 'RUNNING' ? T.cyan : T.user }}>{copy.accent}</span>
          </h1>
          <p className="mt-2 text-sm text-[#A4AFB4] max-w-md">{copy.note}</p>

          {/* Market timeline */}
          <ol className="mt-6 grid grid-cols-4 max-w-xl" aria-label="Market timeline">
            {STEPS.map((step, i) => {
              const done = i < stage;
              const current = i === stage;
              return (
                <li key={step.label} className="relative pr-2" aria-current={current ? 'step' : undefined}>
                  {i < STEPS.length - 1 && (
                    <span
                      className="absolute top-[5px] left-3 right-0 h-px"
                      style={{ backgroundColor: done ? T.chart : T.border }}
                    />
                  )}
                  <span
                    className="relative block w-[11px] h-[11px] rounded-full border"
                    style={{
                      borderColor: current ? T.cyan : done ? T.chart : T.border,
                      backgroundColor: current ? T.cyan : done ? T.chart : T.bg,
                    }}
                  />
                  <div className={`mt-2 text-[11px] font-semibold leading-tight ${current ? 'text-[#F3F5F4]' : 'text-[#A4AFB4]'}`}>
                    {step.label}
                  </div>
                  <div className="text-[10px] text-[#65737A] hidden sm:block">{step.sub}</div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex flex-row lg:flex-col items-end gap-4 lg:gap-5 justify-between">
          {isOpen && stocks.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-[#26343C] bg-[#06090B]/60 px-3.5 py-2.5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]">Market move</div>
                <div className="text-base font-semibold tabular-nums" style={{ color: toneColor(avgChange) }}>
                  {formatPct(avgChange)}
                </div>
              </div>
              <MiniSparkline values={history} width={96} height={30} positive={avgChange >= 0} />
            </div>
          )}

          {status === 'COMPLETED' ? (
            <button
              onClick={() => navigate('/placements')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors duration-200 cursor-pointer hover:bg-[#3B82FF]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
              style={{ color: T.gold, borderColor: `${T.gold}66` }}
            >
              <Trophy className="w-4 h-4" />
              View Final Placements
            </button>
          ) : (
            <button
              onClick={() => navigate('/market')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#F3F5F4] border border-[#26343C] bg-[#111A20] hover:border-[#4A5A63] transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
            >
              {isOpen ? 'Open Market' : 'Preview Market'}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
