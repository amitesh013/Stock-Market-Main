import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LeaderboardEntry, makeProgressScale } from '../../lib/leaderboard';
import Runner from '../race/Runner';
import { Card, Eyebrow, ViewLink, T, formatUSD, formatPct, toneColor } from './ui';

const LANE_H = 300;
const FINISH_Y = 34;
const START_Y = LANE_H - 18;
const TRACK_X = 34;      // centre line of the track, px from the left
const LABEL_X = 78;      // labels start here
const MIN_LABEL_GAP = 34;
const MOVE = 'transform 500ms cubic-bezier(0.25, 0.1, 0.25, 1)';
const NEUTRAL_RUNNER = '#7D8A90';

// Fixed, deterministic price line running from the start (bottom) to the finish (top).
// Volatile near the start, settling into a calm path near the finish.
const TRACK_POINTS: [number, number][] = (() => {
  let h = 0x9e3779b9;
  const rand = () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const steps = 40;
  let walk = 0;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 at start (bottom), 1 at finish (top)
    walk = walk * 0.55 + (rand() - 0.5) * 2;
    const volatility = Math.pow(Math.max(0, 1 - t / 0.8), 1.2);
    const x = TRACK_X + walk * 12 * volatility;
    const y = START_Y - t * (START_Y - FINISH_Y);
    pts.push([Math.max(10, Math.min(58, x)), y]);
  }
  return pts;
})();

const TRACK_PATH = TRACK_POINTS.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

// Faint ridge behind the lane: the "climb" metaphor, kept subtle.
const RIDGE_PATH = `M0 ${START_Y + 18} L0 ${START_Y - 40} L40 ${START_Y - 90} L70 ${START_Y - 70} L120 ${FINISH_Y + 120} L150 ${FINISH_Y + 150} L200 ${FINISH_Y + 40} L240 ${FINISH_Y + 90} L300 ${FINISH_Y + 10} L360 ${FINISH_Y + 110} L420 ${START_Y - 60} L420 ${START_Y + 18} Z`;

const CANDLES = [
  { y: START_Y - 20, h: 10, up: true },
  { y: START_Y - 58, h: 14, up: false },
  { y: START_Y - 96, h: 8, up: true },
  { y: START_Y - 132, h: 12, up: true },
];

function yForProgress(p: number) {
  return START_Y - p * (START_Y - FINISH_Y);
}

function xAtY(y: number) {
  for (let i = 1; i < TRACK_POINTS.length; i++) {
    const [x1, y1] = TRACK_POINTS[i];
    const [x0, y0] = TRACK_POINTS[i - 1];
    if (y >= y1) return x0 + ((y0 - y) / (y0 - y1 || 1)) * (x1 - x0);
  }
  return TRACK_POINTS[TRACK_POINTS.length - 1][0];
}

function spreadLabels(ys: number[]): number[] {
  // ys sorted ascending (top to bottom). Push apart, then pull back inside the lane.
  const minY = FINISH_Y + 14;
  const maxY = START_Y - 8;
  const out = ys.map((y) => Math.min(maxY, Math.max(minY, y)));
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + MIN_LABEL_GAP);
  for (let i = out.length - 1; i >= 0; i--) {
    const limit = i === out.length - 1 ? maxY : out[i + 1] - MIN_LABEL_GAP;
    out[i] = Math.min(out[i], limit);
  }
  return out;
}

interface CompetitionSnapshotProps {
  ranked: LeaderboardEntry[];
  myId?: string;
}

export default function CompetitionSnapshot({ ranked, myId }: CompetitionSnapshotProps) {
  const navigate = useNavigate();
  const myIndex = ranked.findIndex((u) => u.id === myId);
  const me = myIndex >= 0 ? ranked[myIndex] : null;
  const progressFor = makeProgressScale(ranked.map((u) => u.portfolioValue));

  const picks = new Set<number>([0, 1, 2, ranked.length - 1]);
  if (myIndex >= 0) [myIndex - 1, myIndex, myIndex + 1].forEach((i) => picks.add(i));
  const entrants = Array.from(picks)
    .filter((i) => i >= 0 && i < ranked.length)
    .sort((a, b) => a - b)
    .map((i) => {
      const u = ranked[i];
      const progress = progressFor(u.portfolioValue);
      const y = yForProgress(progress);
      return { u, rank: i + 1, progress, y, x: xAtY(y), isMe: u.id === myId };
    });

  const labelYs = spreadLabels(entrants.map((e) => e.y));
  const myY = me ? yForProgress(progressFor(me.portfolioValue)) : null;
  const colorFor = (e: { isMe: boolean; rank: number }) => (e.isMe ? T.user : e.rank === 1 ? T.gold : NEUTRAL_RUNNER);

  return (
    <Card
      onClick={() => navigate('/leaderboard')}
      className="h-full flex flex-col cursor-pointer transition-colors duration-200 hover:border-[#34444D] !bg-[#0D1419]/55"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow color={T.text}>Competition</Eyebrow>
          <p className="text-xs text-[#A4AFB4] mt-1">Live ranking based on portfolio value</p>
        </div>
        <ViewLink to="/leaderboard">View Leaderboard</ViewLink>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-[#26343C] bg-[#06090B]/50 px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">Your Rank</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-2xl font-semibold tabular-nums" style={{ color: T.user }}>{me ? `#${myIndex + 1}` : '—'}</span>
            <span className="text-xs text-[#65737A] tabular-nums">/ {ranked.length}</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">Portfolio</div>
          <div className="mt-1.5 text-sm font-semibold tabular-nums text-[#F3F5F4] truncate">
            {me ? formatUSD(me.portfolioValue) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">Return</div>
          <div className="mt-1.5 text-sm font-semibold tabular-nums" style={{ color: me ? toneColor(me.returnPct) : T.text2 }}>
            {me ? formatPct(me.returnPct, 1) : '—'}
          </div>
        </div>
      </div>

      {/* Vertical race lane */}
      <div className="flex-1 flex items-center">
        <div
          className="relative mt-4 w-full select-none"
          style={{ height: LANE_H }}
          role="img"
          aria-label={me ? `You are ranked ${myIndex + 1} of ${ranked.length}` : 'Competition race'}
        >
          <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 420 ${LANE_H}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="cs-ridge" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={T.surface2} stopOpacity="0.9" />
                <stop offset="1" stopColor={T.surface} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={RIDGE_PATH} fill="url(#cs-ridge)" />
          </svg>
          <svg className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
            <defs>
              <clipPath id="cs-progress">
                <rect
                  x="0"
                  y={myY ?? START_Y}
                  width="70"
                  height={START_Y - (myY ?? START_Y) + 4}
                  className="lb-anim"
                  style={{ transition: 'y 500ms ease, height 500ms ease' }}
                />
              </clipPath>
            </defs>

            {/* distance ticks */}
            {Array.from({ length: 11 }, (_, i) => {
              const y = yForProgress(i / 10);
              return <line key={i} x1="2" x2={i % 5 === 0 ? 10 : 6} y1={y} y2={y} stroke={T.muted} strokeOpacity="0.7" strokeWidth="1" />;
            })}
            <line x1="2" x2="2" y1={FINISH_Y} y2={START_Y} stroke={T.muted} strokeOpacity="0.5" strokeWidth="1" />

            {/* candlesticks near the start */}
            {CANDLES.map((c, i) => (
              <g key={i} opacity="0.45">
                <line x1="60" x2="60" y1={c.y - c.h / 2 - 4} y2={c.y + c.h / 2 + 4} stroke={T.chart} strokeWidth="1" />
                <rect x="57.5" y={c.y - c.h / 2} width="5" height={c.h} rx="0.5" fill={c.up ? 'none' : T.chart} stroke={T.chart} strokeWidth="1" />
              </g>
            ))}

            {/* finish */}
            <g>
              <line x1={TRACK_X - 18} x2={LABEL_X + 40} y1={FINISH_Y} y2={FINISH_Y} stroke={T.border} strokeDasharray="2 4" />
              {Array.from({ length: 6 }, (_, i) => (
                <g key={i}>
                  <rect x={TRACK_X - 18 + i * 6} y={FINISH_Y - 10} width="6" height="4" fill={i % 2 === 0 ? T.text : 'transparent'} opacity="0.5" />
                  <rect x={TRACK_X - 18 + i * 6} y={FINISH_Y - 6} width="6" height="4" fill={i % 2 === 1 ? T.text : 'transparent'} opacity="0.5" />
                </g>
              ))}
              <text x={LABEL_X} y={FINISH_Y - 5} fontSize="10" fontWeight="600" letterSpacing="1.4" fill={T.text2}>FINISH</text>
            </g>

            {/* price-line track */}
            <path d={TRACK_PATH} fill="none" stroke={T.chart} strokeOpacity="0.8" strokeWidth="1.25" strokeLinejoin="round" />
            {myY !== null && (
              <path d={TRACK_PATH} fill="none" stroke={T.user} strokeWidth="2" strokeLinejoin="round" clipPath="url(#cs-progress)" />
            )}

            {/* connectors from runners to labels */}
            {entrants.map((e, i) => (
              <path
                key={e.u.id}
                className="lb-anim"
                d={`M${e.x + 10} ${e.y} L${LABEL_X - 6} ${labelYs[i]}`}
                style={{ d: `path("M${e.x + 10} ${e.y} L${LABEL_X - 6} ${labelYs[i]}")`, transition: 'd 500ms ease' } as React.CSSProperties}
                stroke={e.isMe ? T.user : T.border}
                strokeWidth="1"
                fill="none"
              />
            ))}
          </svg>

          {/* runners */}
          {entrants.map((e) => (
            <div
              key={e.u.id}
              className="lb-anim absolute left-0 top-0"
              style={{ transform: `translate(${e.x - 10}px, ${e.y - 17}px)`, transition: MOVE }}
            >
              <Runner progress={e.progress} size={20} color={colorFor(e)} />
            </div>
          ))}

          {/* labels */}
          {entrants.map((e, i) => (
            <div
              key={e.u.id}
              className="lb-anim absolute right-0 top-0"
              style={{ left: LABEL_X, transform: `translateY(${labelYs[i] - 13}px)`, transition: MOVE }}
            >
              <div
                className="flex items-center gap-2.5 h-[26px] px-2 rounded-md border text-xs"
                style={{
                  borderColor: e.isMe ? `${T.user}88` : 'transparent',
                  backgroundColor: e.isMe ? `${T.user}14` : 'transparent',
                }}
              >
                <span
                  className="w-7 shrink-0 text-center font-semibold tabular-nums rounded border text-[11px] leading-[18px]"
                  style={{
                    color: colorFor(e),
                    borderColor: e.isMe ? `${T.user}66` : e.rank === 1 ? `${T.gold}66` : T.border,
                  }}
                >
                  {e.rank}
                </span>
                <span className={`truncate ${e.isMe ? 'font-semibold' : 'font-medium'}`} style={{ color: e.isMe ? T.text : '#D2D8DA' }}>
                  {e.isMe ? 'You' : e.u.name || 'Trader'}
                </span>
                <span className="ml-auto shrink-0 tabular-nums font-medium text-[#A4AFB4]">
                  {formatUSD(e.u.portfolioValue, 0)}
                </span>
              </div>
            </div>
          ))}

          {entrants.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-[#A4AFB4]" style={{ left: LABEL_X }}>
              No participants yet
            </div>
          )}

          <div className="absolute left-0 text-[10px] font-semibold tracking-[0.14em] text-[#65737A]" style={{ top: START_Y + 3 }}>
            START
          </div>
        </div>
      </div>
    </Card>
  );
}
