import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { T, formatUSD } from '../dashboard/ui';

export interface ActivityStats {
  total: number;
  buys: number;
  sells: number;
  bought: number;
  sold: number;
  traded: number;
}

export default function ActivityStrip({ stats }: { stats: ActivityStats }) {
  const items = [
    { label: 'Total Trades', value: String(stats.total), sub: 'Executed orders' },
    { label: 'Buys', value: String(stats.buys), sub: `${formatUSD(stats.bought)} spent`, icon: <ArrowDownLeft className="w-3.5 h-3.5" style={{ color: T.positive }} /> },
    { label: 'Sells', value: String(stats.sells), sub: `${formatUSD(stats.sold)} received`, icon: <ArrowUpRight className="w-3.5 h-3.5" style={{ color: T.negative }} /> },
    { label: 'Total Traded', value: formatUSD(stats.traded), sub: 'Gross order value' },
  ];

  return (
    <section aria-label="Activity summary" className="h-full rounded-md border border-[#26343C] bg-[#0D1419] grid grid-cols-2 sm:grid-cols-4">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={`min-w-0 px-4 py-3.5 ${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t sm:border-t-0' : ''} ${i === 2 ? 'sm:border-l' : ''} border-[#26343C]`}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]">
            {it.icon}
            {it.label}
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-[#F3F5F4] truncate">{it.value}</div>
          <div className="text-[11px] text-[#65737A] tabular-nums truncate">{it.sub}</div>
        </div>
      ))}
    </section>
  );
}
