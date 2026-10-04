import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useAnimatedNumber } from '../../lib/portfolio';
import { Eyebrow, T, formatUSD, formatSignedUSD, formatPct, toneColor } from '../dashboard/ui';

interface PortfolioHeroProps {
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  startingBalance: number;
  invested: number;
  cash: number;
}

export default function PortfolioHero({ totalValue, totalPnl, totalPnlPercent, startingBalance, invested, cash }: PortfolioHeroProps) {
  const shownValue = useAnimatedNumber(totalValue);
  const shownPnl = useAnimatedNumber(totalPnl);
  const tone = toneColor(totalPnl);
  const Arrow = totalPnl >= 0 ? ArrowUpRight : ArrowDownRight;
  const total = Math.max(0, cash) + Math.max(0, invested);
  const cashPct = total > 0 ? (Math.max(0, cash) / total) * 100 : 100;
  const investedPct = 100 - cashPct;

  const stats = [
    { label: 'Starting Capital', value: formatUSD(startingBalance, 0) },
    { label: 'Invested', value: formatUSD(invested) },
    { label: 'Available Cash', value: formatUSD(cash) },
  ];

  return (
    <section className="h-full rounded-md border border-[#26343C] bg-[#0D1419] p-5 flex flex-col">
      <Eyebrow>Portfolio Value</Eyebrow>

      <div className="mt-3 text-[34px] leading-none font-semibold tabular-nums tracking-tight text-[#F3F5F4]">
        {formatUSD(shownValue)}
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm font-semibold tabular-nums" style={{ color: tone }}>
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded border transition-colors duration-300"
          style={{ borderColor: `${tone}55`, backgroundColor: `${tone}14` }}
        >
          <Arrow className="w-3.5 h-3.5" />
        </span>
        <span>{formatSignedUSD(shownPnl)}</span>
        <span className="text-[#65737A] font-normal">·</span>
        <span>{formatPct(totalPnlPercent)}</span>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-[#26343C] pt-4">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">{s.label}</dt>
            <dd className="mt-1 text-[13px] font-semibold tabular-nums text-[#F3F5F4] truncate">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between mb-2">
          <Eyebrow>Liquidity</Eyebrow>
          <span className="text-[11px] tabular-nums text-[#A4AFB4]">{cashPct.toFixed(0)}% cash</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-[#111A20]" role="img" aria-label={`${cashPct.toFixed(0)}% cash, ${investedPct.toFixed(0)}% invested`}>
          <div className="h-full transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${investedPct}%`, backgroundColor: T.user }} />
          <div className="h-full transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${cashPct}%`, backgroundColor: T.chart }} />
        </div>
        <div className="mt-2 flex justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-[#A4AFB4]">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: T.user }} /> Invested {investedPct.toFixed(0)}%
          </span>
          <span className="flex items-center gap-1.5 text-[#A4AFB4]">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: T.chart }} /> Cash {cashPct.toFixed(0)}%
          </span>
        </div>
      </div>
    </section>
  );
}
