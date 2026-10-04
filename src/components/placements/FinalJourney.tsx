import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { useElementSize } from '../../lib/useElementSize';
import { Eyebrow, T, formatUSD } from '../dashboard/ui';

const H = 150;
const PAD = { top: 10, bottom: 18 };

/** Your portfolio value from the first trade to the close, from reconstructed trade history. */
export default function FinalJourney({ points, startingBalance }: { points: { t: number; value: number }[]; startingBalance: number }) {
  const { ref, w } = useElementSize<HTMLDivElement>();

  const geo = useMemo(() => {
    if (points.length < 3 || w <= 0) return null;
    const t0 = points[0].t, t1 = points[points.length - 1].t;
    const vals = points.map((p) => p.value).concat(startingBalance);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const span = hi - lo || 1;
    const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * w;
    const y = (v: number) => PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
    return { line, area: `${line} L${w} ${H - PAD.bottom} L0 ${H - PAD.bottom} Z`, baseY: y(startingBalance), t0, t1 };
  }, [points, startingBalance, w]);

  const final = points[points.length - 1]?.value ?? startingBalance;
  const stroke = final >= startingBalance ? T.positive : T.negative;

  return (
    <section className="rounded-md border border-[#26343C] bg-[#0D1419] p-5" aria-label="Your competition journey">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow color={T.text}>Your Journey</Eyebrow>
        <span className="text-[11px] text-[#65737A]">From first trade to close</span>
      </div>
      <div ref={ref} className="mt-3 w-full" style={{ height: H }}>
        {geo && (
          <svg width={w} height={H} role="img" aria-label={`Portfolio moved from ${formatUSD(startingBalance)} to ${formatUSD(final)}`}>
            <defs>
              <linearGradient id="journey-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={stroke} stopOpacity="0.14" />
                <stop offset="1" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" x2={w} y1={geo.baseY} y2={geo.baseY} stroke={T.border} strokeDasharray="3 4" />
            <path d={geo.area} fill="url(#journey-fill)" />
            <path d={geo.line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
            <text x="0" y={H - 3} fontSize="10" fill={T.muted}>{format(geo.t0, 'HH:mm')}</text>
            <text x={w} y={H - 3} fontSize="10" fill={T.muted} textAnchor="end">{format(geo.t1, 'HH:mm')} · Close</text>
          </svg>
        )}
      </div>
    </section>
  );
}
