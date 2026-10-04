import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { Search, Users, ChevronDown } from 'lucide-react';
import { useMarketState } from '../../lib/marketState';
import { useLeaderboardUsers, makeProgressScale } from '../../lib/leaderboard';
import Runner, { prefersReducedMotion } from './Runner';

const C = {
  bg: '#06090B',
  surface: '#0D1419',
  surface2: '#111A20',
  border: '#26343C',
  text: '#F3F5F4',
  text2: '#A4AFB4',
  muted: '#65737A',
  brass: '#D5A653',
  silver: '#B8C2C7',
  copper: '#B98268',
  positive: '#39FF88',
  negative: '#FF4D5A',
  me: '#3B82FF',
  track: '#2F6B78',
};

const RANK_COLORS: Record<number, string> = { 1: C.brass, 2: C.silver, 3: C.copper };

const EASE = 'cubic-bezier(0.25, 0.1, 0.25, 1)';
const MOVE_MS = 450;

type SortKey = 'value' | 'return' | 'name';
const SORT_LABELS: Record<SortKey, string> = {
  value: 'Portfolio Value',
  return: 'Return %',
  name: 'Name',
};

function formatMoney(val: number, digits = 2): string {
  return `$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function formatSigned(val: number, digits = 2): string {
  return `${val >= 0 ? '+' : '-'}${formatMoney(val, digits)}`;
}

function formatPct(val: number): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Market race track
// ---------------------------------------------------------------------------

const TRACK_W = 240;
const TRACK_H = 36;
const BASELINE_Y = 31;
const CHART_END = 0.58; // fraction of the track where the price chart settles into the race path

// Deterministic per-participant shape so each row keeps the same chart across re-renders.
function seededRandom(seedText: string) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface TrackShape {
  points: [number, number][];
  chartPath: string;
  racePath: string;
  fullPath: string;
  candles: { x: number; open: number; close: number; high: number; low: number; up: boolean }[];
}

function buildTrack(seed: string): TrackShape {
  const rand = seededRandom(seed);
  const steps = 30;
  const laneY = 19;
  let walk = 0;
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    walk = walk * 0.6 + (rand() - 0.5) * 2;
    // Volatility fades out along the track so the chart becomes a calm race path near the finish.
    const volatility = Math.pow(Math.max(0, 1 - t / (CHART_END + 0.25)), 1.3);
    const y = laneY + 3 * (1 - t) + walk * 6 * volatility;
    points.push([t * TRACK_W, Math.max(6, Math.min(BASELINE_Y - 3, y))]);
  }
  const toPath = (pts: [number, number][]) =>
    pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const split = Math.round(steps * CHART_END);

  const candles = Array.from({ length: 6 }, (_, i) => {
    const x = 10 + i * ((TRACK_W * CHART_END - 16) / 5);
    const mid = 12 + rand() * 12;
    const body = 2 + rand() * 4.5;
    const up = rand() > 0.45;
    return {
      x,
      open: up ? mid + body / 2 : mid - body / 2,
      close: up ? mid - body / 2 : mid + body / 2,
      high: mid - body / 2 - 1.5 - rand() * 2.5,
      low: mid + body / 2 + 1.5 + rand() * 2.5,
      up,
    };
  });

  return {
    points,
    chartPath: toPath(points.slice(0, split + 1)),
    racePath: toPath(points.slice(split)),
    fullPath: toPath(points),
    candles,
  };
}

function yAtProgress(points: [number, number][], progress: number): number {
  const x = progress * TRACK_W;
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x0, y0] = points[i - 1];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0 || 1)) * (y1 - y0);
  }
  return points[points.length - 1][1];
}

function FinishMarker({ leader }: { leader: boolean }) {
  const tone = leader ? C.brass : C.track;
  const opacity = leader ? 0.95 : 0.55;
  return (
    <svg viewBox="0 0 10 36" width="10" height="36" aria-hidden="true" className="lb-finish">
      <line x1="1.5" y1="4" x2="1.5" y2="33" stroke={tone} strokeWidth="1" opacity={opacity} />
      {[0, 1, 2].map((r) =>
        [0, 1].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={2 + c * 3}
            y={4 + r * 2.5}
            width="3"
            height="2.5"
            fill={(r + c) % 2 === 0 ? tone : 'transparent'}
            opacity={opacity}
          />
        ))
      )}
    </svg>
  );
}

function MarketRaceTrack({ seed, progress, isPositive, isMe, isLeader }: {
  seed: string;
  progress: number;
  isPositive: boolean;
  isMe: boolean;
  isLeader: boolean;
}) {
  const shape = useMemo(() => buildTrack(seed), [seed]);
  const clipId = `lb-clip-${seed.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const perf = isPositive ? C.positive : C.negative;
  const runnerColor = isMe ? C.me : isLeader ? C.brass : C.text;
  const runnerY = yAtProgress(shape.points, progress);
  const moveTransition = `transform ${MOVE_MS}ms ${EASE}`;

  return (
    <div className="relative h-9 w-full min-w-0" role="img" aria-label={`Race progress ${Math.round(progress * 100)} percent`}>
      <div className="absolute inset-y-0 left-0 right-3.5">
        <svg
          viewBox={`0 0 ${TRACK_W} ${TRACK_H}`}
          preserveAspectRatio="none"
          className="lb-track absolute inset-0 w-full h-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                x="0"
                y="0"
                width={TRACK_W}
                height={TRACK_H}
                className="lb-anim"
                style={{ transform: `scaleX(${progress})`, transformOrigin: '0 0', transition: moveTransition }}
              />
            </clipPath>
          </defs>

          {/* baseline + market ticks */}
          <line x1="0" x2={TRACK_W} y1={BASELINE_Y} y2={BASELINE_Y} stroke={C.track} strokeOpacity="0.28" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {Array.from({ length: 11 }, (_, i) => (
            <line
              key={i}
              x1={(i / 10) * TRACK_W}
              x2={(i / 10) * TRACK_W}
              y1={BASELINE_Y}
              y2={BASELINE_Y + (i % 5 === 0 ? 3 : 1.6)}
              stroke={C.track}
              strokeOpacity="0.35"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* candlesticks in the chart section */}
          <g className="lb-candles">
            {shape.candles.map((c, i) => (
              <g key={i}>
                <line x1={c.x} x2={c.x} y1={c.high} y2={c.low} stroke={C.track} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <rect
                  x={c.x - 1.6}
                  y={Math.min(c.open, c.close)}
                  width="3.2"
                  height={Math.abs(c.open - c.close)}
                  fill={c.up ? 'none' : C.track}
                  stroke={C.track}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
          </g>

          {/* price line that settles into the race path */}
          <path d={shape.chartPath} fill="none" stroke={C.track} className="lb-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={shape.racePath} fill="none" stroke={C.track} className="lb-line" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />

          {/* distance covered, tinted by performance */}
          <path
            d={shape.fullPath}
            fill="none"
            stroke={perf}
            strokeOpacity="0.9"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
            clipPath={`url(#${clipId})`}
          />
        </svg>

        <div
          className="lb-anim absolute inset-0 pointer-events-none"
          style={{ transform: `translateX(${progress * 100}%)`, transition: moveTransition }}
        >
          <div
            className="lb-anim lb-runner-wrap absolute left-0 top-0"
            style={{ transform: `translate(-50%, ${runnerY - 17}px)`, transition: moveTransition }}
          >
            <Runner progress={progress} color={runnerColor} />
          </div>
        </div>
      </div>

      <div className="absolute right-0 inset-y-0 flex items-center">
        <FinishMarker leader={isLeader} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function RankBadge({ rank }: { rank?: number }) {
  const color = rank ? RANK_COLORS[rank] : undefined;
  return (
    <span
      key={rank}
      className="lb-rank-in inline-flex items-center justify-center w-7 h-6 rounded-md text-[11px] font-semibold tabular-nums border"
      style={
        color
          ? { color, borderColor: `${color}66`, backgroundColor: `${color}14` }
          : { color: C.text2, borderColor: 'transparent' }
      }
    >
      {rank ? String(rank).padStart(2, '0') : '--'}
    </span>
  );
}

interface LeaderboardRowProps {
  u: any;
  rank?: number;
  isMe: boolean;
  progress: number;
  rowRef: (el: HTMLDivElement | null) => void;
}

function LeaderboardRow({ u, rank, isMe, progress, rowRef }: LeaderboardRowProps) {
  const isPositive = u.pnl >= 0;
  const perfColor = isPositive ? C.positive : C.negative;
  const rankColor = rank ? RANK_COLORS[rank] : undefined;
  const initial = (u.name || 'T').trim().charAt(0).toUpperCase();

  const border = isMe ? `${C.me}B3` : rank === 1 ? `${C.brass}40` : 'transparent';
  const borderHover = isMe ? C.me : rank === 1 ? `${C.brass}80` : '#3A4444';

  return (
    <div
      ref={rowRef}
      className="lb-row lb-grid group items-center px-2.5 py-1.5 rounded-lg border"
      style={{
        backgroundColor: isMe ? C.surface2 : `${C.surface}E6`,
        ['--lb-border' as any]: border,
        ['--lb-border-hover' as any]: borderHover,
      }}
    >
      <RankBadge rank={rank} />

      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-7 h-7 shrink-0 rounded-full border flex items-center justify-center text-[11px] font-semibold"
          style={{
            borderColor: isMe ? C.me : rankColor ? `${rankColor}80` : C.border,
            color: isMe ? C.me : rankColor || C.text2,
            backgroundColor: C.bg,
          }}
        >
          {initial}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-medium truncate" style={{ color: C.text }}>
              {u.name || 'Trader'}
            </span>
            {isMe && (
              <span
                className="shrink-0 text-[9px] font-semibold tracking-wider px-1 py-px rounded border"
                style={{ color: C.me, borderColor: `${C.me}80`, backgroundColor: `${C.me}1A` }}
              >
                YOU
              </span>
            )}
            {u.role === 'admin' && (
              <span className="shrink-0 text-[9px] font-medium tracking-wider uppercase" style={{ color: C.muted }}>
                Admin
              </span>
            )}
          </div>
          {/* Secondary line: mobile shows P&L and return, tablet shows P&L only */}
          <div className="@3xl:hidden text-[10px] tabular-nums leading-tight" style={{ color: perfColor }}>
            {formatSigned(u.pnl, 0)}
            <span className="@xl:hidden"> ┬╖ {formatPct(u.returnPct)}</span>
          </div>
        </div>
      </div>

      <span className="lb-value text-right text-[13px] font-medium tabular-nums px-1 -mx-1 rounded" style={{ color: C.text }}>
        {formatMoney(u.portfolioValue)}
      </span>

      <span className="hidden @3xl:block text-right text-xs font-medium tabular-nums" style={{ color: perfColor }}>
        {formatSigned(u.pnl)}
      </span>

      <span className="hidden @xl:block text-right text-xs font-medium tabular-nums" style={{ color: perfColor }}>
        {formatPct(u.returnPct)}
      </span>

      <div className="pl-1 min-w-0">
        <MarketRaceTrack seed={u.id} progress={progress} isPositive={isPositive} isMe={isMe} isLeader={rank === 1} />
      </div>
    </div>
  );
}

// Animates rows from their previous position to their new one (FLIP) using CSS transforms.
function useRowReorderAnimation() {
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const lastTops = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const reduce = prefersReducedMotion();
    const nextTops = new Map<string, number>();
    nodes.current.forEach((el, id) => {
      const top = el.offsetTop;
      nextTops.set(id, top);
      const prevTop = lastTops.current.get(id);
      if (reduce || prevTop === undefined || prevTop === top) return;
      el.style.transition = 'none';
      el.style.transform = `translateY(${prevTop - top}px)`;
      el.getBoundingClientRect();
      el.style.transition = `transform ${MOVE_MS}ms ${EASE}, background-color 300ms ${EASE}, border-color 300ms ${EASE}`;
      el.style.transform = '';
    });
    lastTops.current = nextTops;
  });

  return (id: string) => (el: HTMLDivElement | null) => {
    if (el) nodes.current.set(id, el);
    else nodes.current.delete(id);
  };
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

function MarketBackdrop() {
  return (
    <svg
      viewBox="0 0 600 400"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    >
      <g stroke={C.track} fill="none" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <polyline
          opacity="0.07"
          points="0,300 40,292 80,296 120,270 160,278 200,250 240,258 280,226 320,236 360,204 400,214 440,180 480,190 520,160 560,168 600,138"
        />
        {[80, 160, 240, 320].map((y) => (
          <line key={y} x1="0" x2="600" y1={y} y2={y} opacity="0.035" />
        ))}
      </g>
      <g fill={C.track} opacity="0.045">
        {[
          [30, 40], [62, 70], [90, 55], [130, 95], [160, 60], [205, 110], [240, 75], [290, 125],
          [330, 85], [370, 140], [410, 100], [450, 150], [495, 90], [530, 120], [570, 70],
        ].map(([x, h], i) => (
          <rect key={i} x={x} y={400 - h} width="26" height={h} />
        ))}
      </g>
    </svg>
  );
}

export default function Leaderboard() {
  const { user } = useAuth();
  const { status } = useMarketState();
  const isFinal = status === 'COMPLETED';
  const users = useLeaderboardUsers();
  const [filterMode, setFilterMode] = useState<'all' | 'participants'>('participants');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('value');

  const filteredUsers = users.filter(u => {
    if (filterMode === 'participants' && u.role === 'admin') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Rank is always by portfolio value; the sort menu only changes display order.
  const rankedUsers = filterMode === 'participants' ? users.filter(u => u.role !== 'admin') : users;
  const rankById = new Map(rankedUsers.map((u, i) => [u.id, i + 1]));

  const displayUsers = useMemo(() => {
    if (sortKey === 'value') return filteredUsers;
    const list = [...filteredUsers];
    if (sortKey === 'return') list.sort((a, b) => b.returnPct - a.returnPct);
    if (sortKey === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return list;
  }, [filteredUsers, sortKey]);

  const progressFor = makeProgressScale(rankedUsers.map(u => u.portfolioValue));

  const rowRefFor = useRowReorderAnimation();

  return (
    <div
      className="@container relative rounded-md overflow-hidden flex flex-col h-full border"
      style={{ backgroundColor: `${C.bg}A6`, borderColor: C.border, color: C.text }}
    >
      <MarketBackdrop />

      {/* Header */}
      <div className="relative px-4 pt-4 pb-3 border-b" style={{ borderColor: C.border }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="text-[15px] font-semibold tracking-[0.16em] uppercase" style={{ color: C.text }}>
                {isFinal ? 'Final Standings' : 'Leaderboard'}
              </h3>
              {isFinal ? (
                <span
                  className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded border"
                  style={{ color: C.brass, borderColor: `${C.brass}55` }}
                >
                  Final
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase" style={{ color: C.positive }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.positive }} />
                  Live
                </span>
              )}
          </div>
            <p className="text-[11px] mt-1" style={{ color: C.text2 }}>
              {isFinal ? 'Final rankings based on final portfolio value' : 'Live rankings based on current portfolio value'}
            </p>
        </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex p-0.5 rounded-lg border text-[11px]" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              {(['participants', 'all'] as const).map((mode) => (
            <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className="px-2.5 py-1 rounded-md font-medium transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-1"
                  style={filterMode === mode ? { backgroundColor: C.surface2, color: C.text } : { color: C.muted }}
                >
                  {mode === 'participants' ? 'Participants' : 'All'}
            </button>
              ))}
            </div>
            <label className="relative flex items-center">
              <span className="sr-only">Sort leaderboard</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="appearance-none pl-2.5 pr-7 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer outline-none transition-colors duration-200 focus-visible:border-[#7894A8]"
                style={{ borderColor: C.border, color: C.text, backgroundColor: C.bg }}
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <option key={k} value={k} style={{ backgroundColor: C.surface }}>
                    {SORT_LABELS[k]}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 pointer-events-none" style={{ color: C.text2 }} />
            </label>
        </div>
      </div>

        <div className="relative mt-3">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
          <input
            type="text"
            aria-label="Search participant"
            placeholder="Search participant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="lb-input w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-colors duration-200"
            style={{ backgroundColor: C.surface, borderColor: C.border, color: C.text }}
          />
        </div>
      </div>

      {/* Column headings */}
      <div
        className="relative lb-grid px-[1.375rem] py-2 text-[10px] font-medium uppercase tracking-wider border-b"
        style={{ color: C.muted, borderColor: C.border }}
      >
        <span>#</span>
        <span>Participant</span>
        <span className="text-right">Portfolio</span>
        <span className="hidden @3xl:block text-right">P&amp;L</span>
        <span className="hidden @xl:block text-right">Return</span>
        <span className="pl-1 flex items-center justify-between">
          <span>Market Race</span>
          <span className="normal-case tracking-normal" style={{ color: C.muted }}>Finish</span>
                        </span>
      </div>

      {/* Rows */}
      <div className="relative flex-1 overflow-y-auto overflow-x-hidden min-h-[260px] px-3 py-2">
        <div className="relative flex flex-col gap-1">
          {displayUsers.map((u) => (
            <LeaderboardRow
              key={u.id}
              u={u}
              rank={rankById.get(u.id)}
              isMe={user?.uid === u.id}
              progress={progressFor(u.portfolioValue)}
              rowRef={rowRefFor(u.id)}
            />
          ))}

          {displayUsers.length === 0 && (
            <div className="py-12 text-center">
              <Users className="w-6 h-6 mx-auto mb-1.5" style={{ color: C.muted }} />
              <p className="text-xs font-medium" style={{ color: C.text2 }}>No matching participants</p>
            </div>
                      )}
                    </div>
      </div>
    </div>
  );
}
