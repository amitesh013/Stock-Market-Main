import React, { memo, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Candle, ChartRange } from '../../lib/chartData';
import { useElementSize } from '../../lib/useElementSize';
import { T } from '../dashboard/ui';
import { formatPrice, formatVolume } from './marketUtils';

export type ChartType = 'CANDLE' | 'LINE' | 'AREA';

interface StockChartProps {
  candles: Candle[];
  hasVolume: boolean;
  type: ChartType;
  range: ChartRange;
  currentPrice: number;
  loading?: boolean;
}

const PAD = { top: 12, right: 60, bottom: 24, left: 8 };

function timeLabel(t: number, range: ChartRange) {
  if (range === '1D') return format(t, 'HH:mm');
  if (range === '1W') return format(t, 'EEE HH:mm');
  if (range === '1Y') return format(t, 'MMM yy');
  return format(t, 'MMM d');
}

function StockChart({ candles, hasVolume, type, range, currentPrice, loading }: StockChartProps) {
  const { ref, w, h } = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (w < 50 || h < 50 || candles.length === 0) return null;
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;
    const volH = hasVolume ? Math.round(plotH * 0.18) : 0;
    const priceH = plotH - volH - (hasVolume ? 6 : 0);

    let lo = Infinity, hi = -Infinity;
    for (const c of candles) { lo = Math.min(lo, c.low); hi = Math.max(hi, c.high); }
    if (currentPrice > 0) { lo = Math.min(lo, currentPrice); hi = Math.max(hi, currentPrice); }
    const padV = (hi - lo) * 0.08 || hi * 0.01 || 1;
    lo -= padV; hi += padV;

    const step = plotW / candles.length;
    const x = (i: number) => PAD.left + step * i + step / 2;
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * priceH;
    const maxVol = hasVolume ? Math.max(...candles.map((c) => c.volume || 0)) || 1 : 1;
    const volBase = PAD.top + plotH;

    const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 5);
    const nLabels = Math.max(2, Math.min(6, Math.floor(plotW / 110)));
    const timeIdx = Array.from({ length: nLabels }, (_, i) => Math.round((i * (candles.length - 1)) / (nLabels - 1)));

    const linePts = candles.map((c, i) => `${x(i).toFixed(1)},${y(c.close).toFixed(1)}`);
    const linePath = `M${linePts.join(' L')}`;
    const areaPath = `${linePath} L${x(candles.length - 1).toFixed(1)},${(PAD.top + priceH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.top + priceH).toFixed(1)} Z`;

    return { plotW, priceH, step, x, y, maxVol, volBase, volH, ticks, timeIdx, linePath, areaPath };
  }, [candles, hasVolume, w, h, currentPrice]);

  const first = candles[0]?.close ?? currentPrice;
  const up = currentPrice >= first;
  const lineColor = T.cyan;
  const dirColor = up ? T.positive : T.negative;
  const hovered = hover !== null ? candles[hover] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!geo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - PAD.left) / geo.step);
    setHover(i >= 0 && i < candles.length ? i : null);
  };

  return (
    <div ref={ref} className="relative w-full h-full select-none">
      {!geo && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-[#65737A]">
          {loading ? 'Loading chart…' : 'No price history yet for this range.'}
        </div>
      )}

      {geo && (
        <>
          <svg width={w} height={h} className="block" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Price chart">
            <defs>
              <linearGradient id="mk-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={lineColor} stopOpacity="0.22" />
                <stop offset="1" stopColor={lineColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* grid + price axis */}
            {geo.ticks.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={PAD.left + geo.plotW} y1={geo.y(v)} y2={geo.y(v)} stroke={T.border} strokeOpacity="0.6" strokeDasharray="2 4" />
                <text x={w - PAD.right + 8} y={geo.y(v) + 3.5} fontSize="10" fill={T.muted} className="tabular-nums">{formatPrice(v)}</text>
              </g>
            ))}
            {geo.timeIdx.map((i, k) => (
              <text
                key={k}
                x={geo.x(i)}
                y={h - 7}
                fontSize="10"
                fill={T.muted}
                textAnchor={k === 0 ? 'start' : k === geo.timeIdx.length - 1 ? 'end' : 'middle'}
              >
                {timeLabel(candles[i].t, range)}
              </text>
            ))}

            {/* volume */}
            {hasVolume && candles.map((c, i) => {
              const vh = ((c.volume || 0) / geo.maxVol) * geo.volH;
              return (
                <rect
                  key={`v${c.t}`}
                  x={geo.x(i) - Math.max(1, geo.step * 0.3)}
                  y={geo.volBase - vh}
                  width={Math.max(1, geo.step * 0.6)}
                  height={vh}
                  fill={c.close >= c.open ? T.positive : T.negative}
                  opacity="0.3"
                />
              );
            })}

            {/* price series */}
            {type === 'CANDLE' && candles.map((c, i) => {
              const bull = c.close >= c.open;
              const color = bull ? T.positive : T.negative;
              const bw = Math.max(1, Math.min(14, geo.step * 0.62));
              const yo = geo.y(c.open), yc = geo.y(c.close);
              return (
                <g key={c.t}>
                  <line x1={geo.x(i)} x2={geo.x(i)} y1={geo.y(c.high)} y2={geo.y(c.low)} stroke={color} strokeWidth="1" />
                  <rect x={geo.x(i) - bw / 2} y={Math.min(yo, yc)} width={bw} height={Math.max(1, Math.abs(yc - yo))} fill={color} />
                </g>
              );
            })}
            {type === 'AREA' && <path d={geo.areaPath} fill="url(#mk-area)" />}
            {type !== 'CANDLE' && <path d={geo.linePath} fill="none" stroke={lineColor} strokeWidth="1.6" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${T.cyan}66)` }} />}

            {/* current price line */}
            {currentPrice > 0 && (
              <g>
                <line x1={PAD.left} x2={PAD.left + geo.plotW} y1={geo.y(currentPrice)} y2={geo.y(currentPrice)} stroke={dirColor} strokeOpacity="0.7" strokeDasharray="3 3" />
                <rect x={w - PAD.right + 2} y={geo.y(currentPrice) - 9} width={PAD.right - 4} height="18" rx="3" fill={dirColor} />
                <text x={w - PAD.right + 8} y={geo.y(currentPrice) + 3.5} fontSize="10" fontWeight="600" fill={T.bg} className="tabular-nums">
                  {formatPrice(currentPrice)}
                </text>
              </g>
            )}

            {/* crosshair */}
            {hover !== null && (
              <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.top} y2={geo.volBase} stroke={T.text2} strokeOpacity="0.35" />
            )}
          </svg>

          {hovered && (
            <div className="absolute left-3 top-2 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-[#A4AFB4] pointer-events-none bg-[#0D1419]/85 rounded px-1.5 py-0.5">
              <span className="text-[#F3F5F4]">{format(hovered.t, range === '1D' ? 'HH:mm' : 'MMM d, HH:mm')}</span>
              <span>O <span className="text-[#F3F5F4]">{formatPrice(hovered.open)}</span></span>
              <span>H <span className="text-[#F3F5F4]">{formatPrice(hovered.high)}</span></span>
              <span>L <span className="text-[#F3F5F4]">{formatPrice(hovered.low)}</span></span>
              <span>C <span className="text-[#F3F5F4]">{formatPrice(hovered.close)}</span></span>
              {hasVolume && <span>Vol <span className="text-[#F3F5F4]">{formatVolume(hovered.volume || 0)}</span></span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default memo(StockChart);
