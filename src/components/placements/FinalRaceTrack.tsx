import React from 'react';
import { Flag } from 'lucide-react';
import { LeaderboardEntry, makeProgressScale } from '../../lib/leaderboard';
import Runner from '../race/Runner';
import { Eyebrow, T, formatUSD, formatPct, toneColor } from '../dashboard/ui';

export const PLACE_COLORS = [T.gold, '#B8C2C7', '#B98268'];

const LANE_H = 440;
const FINISH_Y = 44;
const START_Y = LANE_H - 22;
const TRACK_X = 40;
const LABEL_X = 92;
const MIN_LABEL_GAP = 40;

// Deterministic price path: choppy near the start, settling as it approaches the finish.
const TRACK_POINTS: [number, number][] = (() => {
  let h = 0x51ed27;
  const rand = () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const steps = 46;
  let walk = 0;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    walk = walk * 0.55 + (rand() - 0.5) * 2;
    const vol = Math.pow(Math.max(0, 1 - t / 0.85), 1.2);
    pts.push([Math.max(12, Math.min(68, TRACK_X + walk * 14 * vol)), START_Y - t * (START_Y - FINISH_Y)]);
  }
  return pts;
})();
const TRACK_PATH = TRACK_POINTS.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

const yFor = (p: number) => START_Y - p * (START_Y - FINISH_Y);
function xAtY(y: number) {
  for (let i = 1; i < TRACK_POINTS.length; i++) {
    const [x1, y1] = TRACK_POINTS[i];
    const [x0, y0] = TRACK_POINTS[i - 1];
    if (y >= y1) return x0 + ((y0 - y) / (y0 - y1 || 1)) * (x1 - x0);
  }
  return TRACK_POINTS[TRACK_POINTS.length - 1][0];
}
function spread(ys: number[]) {
  const min = FINISH_Y + 18, max = START_Y - 10;
  const out = ys.map((y) => Math.min(max, Math.max(min, y)));
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + MIN_LABEL_GAP);
  for (let i = out.length - 1; i >= 0; i--) out[i] = Math.min(out[i], i === out.length - 1 ? max : out[i + 1] - MIN_LABEL_GAP);
  return out;
}

interface FinalRaceTrackProps {
  standings: LeaderboardEntry[];
  myId?: string;
  step: number; // 1 finish marker, 2 line drawn, 3 positions placed
}

export default function FinalRaceTrack({ standings, myId, step }: FinalRaceTrackProps) {
  const myIndex = standings.findIndex((u) => u.id === myId);
  const progress = makeProgressScale(standings.map((u) => u.portfolioValue));

  const picks = new Set<number>([0, 1, 2, 3, 4, standings.length - 1]);
  if (myIndex >= 0) picks.add(myIndex);
  const entrants = Array.from(picks)
    .filter((i) => i >= 0 && i < standings.length)
    .sort((a, b) => a - b)
    .slice(0, 8)
    .map((i) => {
      const u = standings[i];
      const p = progress(u.portfolioValue);
      const y = yFor(p);
      return { u, rank: i + 1, p, y, x: xAtY(y), isMe: u.id === myId };
    });
  const labelYs = spread(entrants.map((e) => e.y));
  const colorFor = (e: { isMe: boolean; rank: number }) => (e.isMe ? T.user : PLACE_COLORS[e.rank - 1] ?? '#7D8A90');
  const placed = step >= 3;

  return (
    <section className="h-full rounded-md border border-[#26343C] bg-[#0D1419]/55 p-5 flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Eyebrow color={T.text}>The Market Race</Eyebrow>
          <p className="text-xs text-[#A4AFB4] mt-1">Final positions by portfolio value at the close.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A4AFB4] border border-[#26343C] rounded px-2 py-0.5">
          <Flag className="w-3 h-3" /> Final
        </span>
      </div>

      <div className="relative mt-4 w-full select-none" style={{ height: LANE_H }} role="img" aria-label={myIndex >= 0 ? `Final race: you finished ${myIndex + 1} of ${standings.length}` : 'Final race positions'}>
        <svg className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
          {/* distance ticks */}
          {Array.from({ length: 11 }, (_, i) => {
            const y = yFor(i / 10);
            return <line key={i} x1="2" x2={i % 5 === 0 ? 10 : 6} y1={y} y2={y} stroke={T.muted} strokeOpacity="0.6" />;
          })}
          <line x1="2" x2="2" y1={FINISH_Y} y2={START_Y} stroke={T.muted} strokeOpacity="0.4" />

          {/* finish line */}
          <g style={{ opacity: step >= 1 ? 1 : 0, transition: 'opacity 300ms ease' }}>
            <line x1="12" x2="100%" y1={FINISH_Y} y2={FINISH_Y} stroke={T.border} strokeDasharray="2 4" />
            {Array.from({ length: 8 }, (_, i) => (
              <g key={i}>
                <rect x={14 + i * 6} y={FINISH_Y - 10} width="6" height="4" fill={i % 2 === 0 ? T.text : 'transparent'} opacity="0.55" />
                <rect x={14 + i * 6} y={FINISH_Y - 6} width="6" height="4" fill={i % 2 === 1 ? T.text : 'transparent'} opacity="0.55" />
              </g>
            ))}
            <text x={LABEL_X} y={FINISH_Y - 6} fontSize="10" fontWeight="600" letterSpacing="1.6" fill={T.text2}>FINISH</text>
          </g>

          {/* price-line track drawing toward the finish */}
          <path
            d={TRACK_PATH}
            pathLength={1}
            fill="none"
            stroke={T.chart}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeDasharray="1"
            className="lb-anim"
            style={{ strokeDashoffset: step >= 2 ? 0 : 1, transition: 'stroke-dashoffset 700ms cubic-bezier(0.25, 0.1, 0.25, 1)' }}
          />

          {entrants.map((e, i) => (
            <path
              key={e.u.id}
              d={`M${e.x + 11} ${e.y} L${LABEL_X - 8} ${labelYs[i]}`}
              stroke={e.isMe ? T.user : T.border}
              fill="none"
              className="lb-anim"
              style={{ opacity: placed ? 1 : 0, transition: `opacity 300ms ease ${i * 40}ms` }}
            />
          ))}
        </svg>

        {entrants.map((e, i) => (
          <div
            key={e.u.id}
            className="lb-anim absolute left-0 top-0"
            style={{ transform: `translate(${e.x - 11}px, ${e.y - 19}px)`, opacity: placed ? 1 : 0, transition: `opacity 300ms ease ${i * 40}ms` }}
          >
            <Runner progress={e.p} size={22} color={colorFor(e)} />
          </div>
        ))}

        {entrants.map((e, i) => (
          <div
            key={e.u.id}
            className="lb-anim absolute right-0 top-0"
            style={{
              left: LABEL_X,
              transform: `translateY(${labelYs[i] - 15 + (placed ? 0 : 6)}px)`,
              opacity: placed ? 1 : 0,
              transition: `opacity 300ms ease ${i * 40}ms, transform 300ms ease ${i * 40}ms`,
            }}
          >
            <div
              className="flex items-center gap-3 h-[30px] px-2.5 rounded-md border text-xs"
              style={{ borderColor: e.isMe ? `${T.user}99` : 'transparent', backgroundColor: e.isMe ? `${T.user}14` : 'transparent' }}
            >
              <span
                className="w-8 shrink-0 text-center font-semibold tabular-nums rounded border text-[11px] leading-5"
                style={{ color: colorFor(e), borderColor: e.isMe ? `${T.user}66` : e.rank <= 3 ? `${colorFor(e)}66` : T.border }}
              >
                {String(e.rank).padStart(2, '0')}
              </span>
              <span className={`truncate ${e.isMe ? 'font-semibold text-[#F3F5F4]' : 'font-medium text-[#D2D8DA]'}`}>
                {e.isMe ? 'You' : e.u.name || 'Trader'}
              </span>
              <span className="ml-auto shrink-0 tabular-nums text-[#A4AFB4] hidden sm:inline">{formatUSD(e.u.portfolioValue, 0)}</span>
              <span className="shrink-0 w-14 text-right tabular-nums font-medium" style={{ color: toneColor(e.u.returnPct) }}>
                {formatPct(e.u.returnPct, 1)}
              </span>
            </div>
          </div>
        ))}

        <div className="absolute left-0 text-[10px] font-semibold tracking-[0.14em] text-[#65737A]" style={{ top: START_Y + 4 }}>START</div>
      </div>
    </section>
  );
}
