import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PortfolioHolding } from '../../lib/portfolio';
import { Eyebrow, MiniSparkline, T, formatUSD, formatSignedUSD, formatPct, toneColor } from '../dashboard/ui';
import TickerBadge from '../market/TickerBadge';
import { formatPrice } from '../market/marketUtils';

const GRID =
  'grid items-center gap-3 grid-cols-[minmax(0,1fr)_auto_56px] ' +
  'md:grid-cols-[minmax(0,1.4fr)_52px_80px_80px_96px_92px_60px] ' +
  'lg:grid-cols-[minmax(0,1.4fr)_52px_80px_80px_96px_92px_60px_96px]';

interface HoldingsTableProps {
  holdings: PortfolioHolding[];
  totalValue: number;
  filter: string | null;
  onClearFilter: () => void;
}

export default function HoldingsTable({ holdings, totalValue, filter, onClearFilter }: HoldingsTableProps) {
  const navigate = useNavigate();

  return (
    <section className="rounded-md border border-[#26343C] bg-[#0D1419] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <Eyebrow>Holdings</Eyebrow>
          <span className="text-[11px] tabular-nums text-[#65737A]">{holdings.length} position{holdings.length === 1 ? '' : 's'}</span>
        </div>
        {filter && (
          <button onClick={onClearFilter} className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A4AFB4] hover:text-[#F3F5F4] cursor-pointer">
            {filter} · Show all
          </button>
        )}
      </div>

      <div className={`${GRID} px-5 py-2 border-y border-[#26343C] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]`} aria-hidden="true">
        <span>Asset</span>
        <span className="hidden md:block text-right">Shares</span>
        <span className="hidden md:block text-right">Avg Price</span>
        <span className="hidden md:block text-right">Current</span>
        <span className="hidden md:block text-right">Mkt Value</span>
        <span className="hidden md:block text-right">P&amp;L</span>
        <span className="md:hidden text-right">Value</span>
        <span className="text-right">Return</span>
        <span className="hidden lg:block text-right">Allocation</span>
      </div>

      {holdings.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-[#F3F5F4]">{filter ? 'No holdings in this category' : 'No positions in this session'}</p>
          <p className="text-xs text-[#65737A] mt-1">{filter ? 'Clear the filter to see every position.' : 'Positions you open during this session will appear here.'}</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#26343C]/70">
          {holdings.map((h) => {
            const alloc = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
            const tone = toneColor(h.pnl);
            return (
              <li key={h.id}>
                <button
                  onClick={() => navigate('/market', { state: { stockId: h.stockId } })}
                  title={`Open ${h.stock.ticker} in Market & Trading`}
                  className={`${GRID} group w-full px-5 py-2.5 text-left border-l-2 border-transparent hover:border-[#3B82FF]/60 hover:bg-[#111A20]/70 transition-colors duration-200 cursor-pointer`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <TickerBadge ticker={h.stock.ticker} size={26} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-[#F3F5F4]">{h.stock.ticker}</span>
                      <span className="block text-[11px] text-[#65737A] truncate">
                        <span className="md:hidden">{h.quantity} @ ${formatPrice(h.averageBuyPrice)}</span>
                        <span className="hidden md:inline">{h.stock.name}</span>
                      </span>
                    </span>
                    <span className="hidden md:block ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <MiniSparkline values={h.history} width={52} height={18} positive={h.stockPrice >= (h.history[0] ?? h.stockPrice)} />
                    </span>
                  </span>
                  <span className="hidden md:block text-right text-[13px] tabular-nums text-[#F3F5F4]">{h.quantity}</span>
                  <span className="hidden md:block text-right text-xs tabular-nums text-[#A4AFB4]">${formatPrice(h.averageBuyPrice)}</span>
                  <span className="hidden md:block text-right text-xs tabular-nums text-[#F3F5F4]">${formatPrice(h.stockPrice)}</span>
                  <span className="hidden md:block text-right text-[13px] font-semibold tabular-nums text-[#F3F5F4]">{formatUSD(h.currentValue)}</span>
                  <span className="hidden md:block text-right text-xs font-semibold tabular-nums transition-colors duration-300" style={{ color: tone }}>{formatSignedUSD(h.pnl)}</span>
                  <span className="md:hidden text-right">
                    <span className="block text-[13px] font-semibold tabular-nums text-[#F3F5F4]">{formatUSD(h.currentValue)}</span>
                    <span className="block text-[11px] font-semibold tabular-nums" style={{ color: tone }}>{formatSignedUSD(h.pnl)}</span>
                  </span>
                  <span className="text-right text-xs font-semibold tabular-nums transition-colors duration-300" style={{ color: tone }}>{formatPct(h.pnlPercent, 1)}</span>
                  <span className="hidden lg:flex items-center justify-end gap-2">
                    <span className="w-10 h-1 rounded-full bg-[#111A20] overflow-hidden">
                      <span className="block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.min(100, alloc)}%`, backgroundColor: T.user }} />
                    </span>
                    <span className="text-xs tabular-nums text-[#A4AFB4] w-10 text-right">{alloc.toFixed(1)}%</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
