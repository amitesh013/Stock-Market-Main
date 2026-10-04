import React from 'react';
import { Download } from 'lucide-react';
import { T } from '../dashboard/ui';

export default function TransactionsHeader({ total, buys, sells, onExport }: {
  total: number;
  buys: number;
  sells: number;
  onExport: () => void;
}) {
  const stats = [
    { label: 'Total Trades', value: total, color: T.text },
    { label: 'Buy', value: buys, color: T.text },
    { label: 'Sell', value: sells, color: T.text },
  ];

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[#F3F5F4]">Transactions</h1>
        <p className="text-[13px] text-[#A4AFB4] mt-0.5">Your complete trading activity.</p>
      </div>
      <div className="flex items-center gap-5">
        <dl className="flex items-stretch gap-4">
          {stats.map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <div className="w-px bg-[#26343C]" />}
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]">{s.label}</dt>
                <dd className="text-lg font-semibold tabular-nums" style={{ color: s.color }}>{s.value}</dd>
              </div>
            </React.Fragment>
          ))}
        </dl>
        <button
          onClick={onExport}
          disabled={total === 0}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#26343C] text-xs font-semibold text-[#A4AFB4] enabled:hover:text-[#F3F5F4] enabled:hover:border-[#4A5A63] transition-colors duration-200 cursor-pointer disabled:cursor-default disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>
    </div>
  );
}
