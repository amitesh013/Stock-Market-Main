import React from 'react';
import { LiveStock } from '../../lib/liveData';
import { Card, CardTitle, ViewLink, MiniSparkline, formatPct, toneColor } from './ui';

export default function MarketMoversStrip({ stocks, onOpenStock }: { stocks: LiveStock[]; onOpenStock: (stock: LiveStock) => void }) {
  const movers = [...stocks]
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, 4);

  return (
    <Card className="!py-4 lg:flex-1 flex flex-col">
      <CardTitle right={<ViewLink to="/market">View Market</ViewLink>}>Market Movers</CardTitle>
      {movers.length === 0 ? (
        <p className="text-sm text-[#A4AFB4] lg:my-auto">Waiting for market data…</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:my-auto">
          {movers.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onOpenStock(s)}
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-[#26343C] bg-[#111A20] px-3 py-2 text-left transition-colors duration-200 hover:border-[#4A5A63] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#F3F5F4] truncate">{s.ticker}</div>
                  <div className="text-[11px] font-semibold tabular-nums" style={{ color: toneColor(s.changePercent) }}>
                    {formatPct(s.changePercent)}
                  </div>
                </div>
                <MiniSparkline values={s.history} width={52} height={22} positive={s.changePercent >= 0} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
