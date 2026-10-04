import React, { useEffect, useRef, useState } from 'react';
import { Card, CardTitle, ViewLink, MiniSparkline, T, formatUSD, formatSignedUSD, formatPct, toneColor } from './ui';

interface PositionSummaryProps {
  netWorth: number;
  cash: number;
  invested: number;
  pnl: number;
  returnPct: number;
}

export default function PositionSummary({ netWorth, cash, invested, pnl, returnPct }: PositionSummaryProps) {
  // Net-worth trail for this session, built from realtime updates only.
  const trailRef = useRef<number[]>([]);
  const [trail, setTrail] = useState<number[]>([]);
  useEffect(() => {
    const last = trailRef.current[trailRef.current.length - 1];
    if (last !== undefined && Math.abs(last - netWorth) < 0.005) return;
    trailRef.current = [...trailRef.current, netWorth].slice(-40);
    setTrail(trailRef.current);
  }, [netWorth]);

  const stats = [
    { label: 'Available Cash', value: formatUSD(cash), color: T.text },
    { label: 'Invested', value: formatUSD(invested), color: T.text },
    { label: 'P&L', value: formatSignedUSD(pnl), color: toneColor(pnl) },
  ];

  return (
    <Card className="h-full flex flex-col">
      <CardTitle right={<ViewLink to="/portfolio">View Portfolio</ViewLink>}>My Position</CardTitle>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[28px] leading-none font-semibold tabular-nums tracking-tight text-[#F3F5F4] truncate">
            {formatUSD(netWorth)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-[#A4AFB4]">Net Worth</span>
            <span className="font-semibold tabular-nums" style={{ color: toneColor(returnPct) }}>{formatPct(returnPct)}</span>
          </div>
        </div>
        {trail.length >= 2 && <MiniSparkline values={trail} width={110} height={36} positive={pnl >= 0} />}
      </div>

      <div className="flex-1 min-h-5" />
      <dl className="grid grid-cols-3 gap-3 border-t border-[#26343C]">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 pt-4">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">{s.label}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums truncate" style={{ color: s.color }}>{s.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
