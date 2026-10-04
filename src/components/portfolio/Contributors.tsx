import React from 'react';
import { PortfolioHolding } from '../../lib/portfolio';
import { Eyebrow, T, formatSignedUSD, formatPct } from '../dashboard/ui';
import TickerBadge from '../market/TickerBadge';

function Item({ label, holding, tone }: { label: string; holding: PortfolioHolding | null; tone: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-lg border border-[#26343C] bg-[#111A20]/50 px-3.5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">{label}</div>
      {holding ? (
        <div className="mt-2 flex items-center gap-2.5">
          <TickerBadge ticker={holding.stock.ticker} size={26} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[#F3F5F4]">{holding.stock.ticker}</div>
            <div className="text-xs font-semibold tabular-nums" style={{ color: tone }}>
              {formatSignedUSD(holding.pnl)} <span className="font-normal text-[#65737A]">{formatPct(holding.pnlPercent, 1)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm text-[#65737A]">—</div>
      )}
    </div>
  );
}

export default function Contributors({ holdings }: { holdings: PortfolioHolding[] }) {
  const gainers = holdings.filter((h) => h.pnl > 0).sort((a, b) => b.pnl - a.pnl);
  const draggers = holdings.filter((h) => h.pnl < 0).sort((a, b) => a.pnl - b.pnl);

  return (
    <section className="h-full rounded-md border border-[#26343C] bg-[#0D1419] p-5 flex flex-col">
      <Eyebrow>Portfolio Contributors</Eyebrow>
      <div className="mt-4 flex flex-col sm:flex-row lg:flex-col gap-2.5 flex-1">
        <Item label="Biggest Gain" holding={gainers[0] ?? null} tone={T.positive} />
        <Item label="Biggest Drag" holding={draggers[0] ?? null} tone={T.negative} />
      </div>
    </section>
  );
}
