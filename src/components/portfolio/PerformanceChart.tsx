import React, { memo, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { PerformancePoint } from '../../lib/portfolio';
import { useElementSize } from '../../lib/useElementSize';
import { Eyebrow, T, formatUSD, formatSignedUSD } from '../dashboard/ui';

type Metric = 'VALUE' | 'PNL';
type Range = '1H' | '1D' | '1W' | 'EVENT' | 'ALL';

interface Marker { t: number; type: 'BUY' | 'SELL'; ticker: string; quantity: number }

interface PerformanceChartProps {
  points: PerformancePoint[];
  markers: Marker[];
  startingBalance: number;
  eventStart: number | null;
}

const RANGE_MS: Record<Exclude<Range, 'EVENT' | 'ALL'>, number> = { '1H': 3600e3, '1D': 24 * 3600e3, '1W': 7 * 24 * 3600e3 };
const PAD = { top: 14, right: 64, bottom: 24, left: 8 };

// Monotone cubic interpolation keeps the line smooth without overshooting real values.
function smoothPath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return '';
  if (n === 1) return `M${xs[0]} ${ys[0]}`;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i] || 1e-6);
    m.push((ys[i + 1] - ys[i]) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = xs[i] + dx[i] / 3, c1y = ys[i] + (t[i] * dx[i]) / 3;
    const c2x = xs[i + 1] - dx[i] / 3, c2y = ys[i + 1] - (t[i + 1] * dx[i]) / 3;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${xs[i + 1].toFixed(1)} ${ys[i + 1].toFixed(1)}`;
  }
  return d;
}

function PerformanceChart({ points, markers, startingBalance, eventStart }: PerformanceChartProps) {
  const [metric, setMetric] = useState<Metric>('VALUE');
  const [range, setRange] = useState<Range>('ALL');
  const [hover, setHover] = useState<number | null>(null);
  const { ref, w, h } = useElementSize<HTMLDivElement>();

  const windowed = useMemo(() => {
    if (range === 'ALL' || points.length === 0) return points;
    const cutoff = range === 'EVENT' ? eventStart ?? 0 : Date.now() - RANGE_MS[range];
    const inside = points.filter((p) => p.t >= cutoff);
    const before = [...points].reverse().find((p) => p.t < cutoff);
    return before ? [{ t: cutoff, value: before.value }, ...inside] : inside;
  }, [points, range, eventStart]);

  const series = useMemo(
    () => windowed.map((p) => ({ t: p.t, v: metric === 'VALUE' ? p.value : p.value - startingBalance, value: p.value })),
    [windowed, metric, startingBalance],
  );

  const geo = useMemo(() => {
    if (w < 60 || h < 60 || series.length < 2) return null;
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;
    const t0 = series[0].t, t1 = series[series.length - 1].t;
    const base = metric === 'VALUE' ? startingBalance : 0;
    let lo = Math.min(base, ...series.map((s) => s.v));
    let hi = Math.max(base, ...series.map((s) => s.v));
    const pad = (hi - lo) * 0.12 || Math.max(1, Math.abs(hi) * 0.002);
    lo -= pad; hi += pad;
    const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0 || 1)) * plotW;
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;
    const xs = series.map((s) => x(s.t));
    const ys = series.map((s) => y(s.v));
    const line = smoothPath(xs, ys);
    const area = `${line} L${xs[xs.length - 1].toFixed(1)} ${(PAD.top + plotH).toFixed(1)} L${xs[0].toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`;
    const ticks = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 4);
    return { plotW, plotH, t0, t1, x, y, xs, ys, line, area, ticks, base };
  }, [series, w, h, metric, startingBalance]);

  const last = series[series.length - 1];
  const up = last ? last.value >= startingBalance : true;
  const tone = up ? T.positive : T.negative;
  const hp = hover !== null ? series[hover] : null;
  const fmt = (v: number) => (metric === 'VALUE' ? formatUSD(v, 0) : formatSignedUSD(v, 0));
  const span = geo ? geo.t1 - geo.t0 : 0;
  const timeFmt = span > 2 * 24 * 3600e3 ? 'MMM d' : 'HH:mm';

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!geo) return;
    const mx = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    for (let i = 1; i < geo.xs.length; i++) if (Math.abs(geo.xs[i] - mx) < Math.abs(geo.xs[best] - mx)) best = i;
    setHover(best);
  };

  const pill = (active: boolean) =>
    `h-7 px-2.5 rounded-md text-xs font-semibold border transition-colors duration-200 cursor-pointer disabled:opacity-35 disabled:cursor-default ${
      active ? 'border-[#3B82FF]/60 bg-[#3B82FF]/10 text-[#F3F5F4]' : 'border-transparent text-[#A4AFB4] enabled:hover:text-[#F3F5F4]'
    }`;

  return (
    <section className="h-full rounded-md border border-[#26343C] bg-[#0D1419] p-5 flex flex-col min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Eyebrow>Performance</Eyebrow>
          <div className="flex rounded-lg border border-[#26343C] p-0.5" role="group" aria-label="Metric">
            {(['VALUE', 'PNL'] as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                aria-pressed={metric === m}
                className={`h-6 px-2.5 rounded-md text-[11px] font-semibold transition-colors duration-200 cursor-pointer ${metric === m ? 'bg-[#111A20] text-[#F3F5F4]' : 'text-[#A4AFB4] hover:text-[#F3F5F4]'}`}
              >
                {m === 'VALUE' ? 'Portfolio Value' : 'P&L'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1" role="group" aria-label="Time range">
          {(['1H', '1D', '1W', 'EVENT', 'ALL'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              disabled={r === 'EVENT' && !eventStart}
              title={r === 'EVENT' && !eventStart ? 'No live news event' : undefined}
              aria-pressed={range === r}
              className={pill(range === r)}
            >
              {r === 'EVENT' ? 'Event' : r}
            </button>
          ))}
        </div>
      </div>

      <div ref={ref} className="relative mt-4 flex-1 min-h-[220px]">
        {!geo && (
          <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-[#65737A] px-6">
            Your performance line starts with your first trade.
          </div>
        )}
        {geo && (
          <>
            <svg width={w} height={h} className="block" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Portfolio performance">
              <defs>
                <linearGradient id="pf-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={tone} stopOpacity="0.18" />
                  <stop offset="1" stopColor={tone} stopOpacity="0" />
                </linearGradient>
              </defs>

              {geo.ticks.map((v) => (
                <g key={v}>
                  <line x1={PAD.left} x2={PAD.left + geo.plotW} y1={geo.y(v)} y2={geo.y(v)} stroke={T.border} strokeOpacity="0.6" strokeDasharray="2 4" />
                  <text x={w - PAD.right + 8} y={geo.y(v) + 3.5} fontSize="10" fill={T.muted} className="tabular-nums">{fmt(v)}</text>
                </g>
              ))}

              {/* starting-capital / break-even baseline */}
              <line x1={PAD.left} x2={PAD.left + geo.plotW} y1={geo.y(geo.base)} y2={geo.y(geo.base)} stroke={T.text2} strokeOpacity="0.35" />

              {eventStart && eventStart > geo.t0 && eventStart < geo.t1 && (
                <g>
                  <line x1={geo.x(eventStart)} x2={geo.x(eventStart)} y1={PAD.top} y2={PAD.top + geo.plotH} stroke={T.cyan} strokeOpacity="0.6" strokeDasharray="3 3" />
                  <text x={geo.x(eventStart) + 4} y={PAD.top + 9} fontSize="9" fontWeight="600" letterSpacing="1" fill={T.cyan}>EVENT</text>
                </g>
              )}

              <path d={geo.area} fill="url(#pf-area)" className="lb-anim" style={{ transition: 'd 400ms ease' } as React.CSSProperties} />
              <path d={geo.line} fill="none" stroke={tone} strokeWidth="1.75" strokeLinejoin="round" className="lb-anim" style={{ transition: 'd 400ms ease, stroke 300ms' } as React.CSSProperties} />

              {/* trade markers */}
              {markers.filter((m) => m.t >= geo.t0 && m.t <= geo.t1).map((m, i) => {
                const mx = geo.x(m.t);
                const my = PAD.top + geo.plotH;
                const c = m.type === 'BUY' ? T.positive : T.negative;
                return (
                  <g key={`${m.t}-${i}`}>
                    <title>{`${m.type} ${m.quantity} ${m.ticker} · ${format(m.t, 'MMM d, HH:mm')}`}</title>
                    <path d={m.type === 'BUY' ? `M${mx} ${my - 8} l4 6 h-8 z` : `M${mx} ${my - 2} l4 -6 h-8 z`} fill={c} opacity="0.85" />
                  </g>
                );
              })}

              {[0, 0.5, 1].map((f, k) => {
                const t = geo.t0 + (geo.t1 - geo.t0) * f;
                return (
                  <text key={k} x={geo.x(t)} y={h - 7} fontSize="10" fill={T.muted} textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}>
                    {format(t, timeFmt)}
                  </text>
                );
              })}

              {hp && hover !== null && (
                <g>
                  <line x1={geo.xs[hover]} x2={geo.xs[hover]} y1={PAD.top} y2={PAD.top + geo.plotH} stroke={T.text2} strokeOpacity="0.35" />
                  <circle cx={geo.xs[hover]} cy={geo.ys[hover]} r="3.5" fill={T.bg} stroke={tone} strokeWidth="1.5" />
                </g>
              )}
            </svg>

            {hp && hover !== null && (
              <div
                className="absolute top-1 pointer-events-none rounded-md border border-[#26343C] bg-[#06090B]/95 px-2.5 py-1.5 text-[11px] tabular-nums shadow-sm"
                style={{ left: Math.min(Math.max(geo.xs[hover] - 70, 0), w - PAD.right - 140) }}
              >
                <div className="text-[#65737A]">{format(hp.t, 'MMM d, HH:mm:ss')}</div>
                <div className="text-[#F3F5F4] font-semibold">{formatUSD(hp.value)}</div>
                <div style={{ color: hp.value >= startingBalance ? T.positive : T.negative }}>{formatSignedUSD(hp.value - startingBalance)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default memo(PerformanceChart);
