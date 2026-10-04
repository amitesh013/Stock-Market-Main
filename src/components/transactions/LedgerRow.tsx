import React from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import TickerBadge from '../market/TickerBadge';
import { formatPrice } from '../market/marketUtils';
import { LedgerTx, SIDE_COLOR, TxSide, cashFlowLabel, formatShares, timeLabel } from './txUtils';

/** Shared by the ledger column header and rows: tablet hides STATUS, desktop shows all columns. */
export const LEDGER_COLS =
  'grid-cols-[3.25rem_4.25rem_minmax(0,1fr)_3.75rem_5.5rem_6.75rem] @4xl:grid-cols-[3.75rem_4.75rem_minmax(0,1fr)_4.5rem_6.25rem_7.5rem_6.75rem]';

export function SideTag({ side, className = '' }: { side: TxSide; className?: string }) {
  const Icon = side === 'BUY' ? ArrowDownLeft : ArrowUpRight;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold tracking-[0.08em] ${className}`} style={{ color: SIDE_COLOR[side] }}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {side}
    </span>
  );
}

function LedgerRow({ tx, selected, fresh, onSelect, plain = false }: {
  tx: LedgerTx;
  selected: boolean;
  fresh: boolean;
  onSelect: (id: string) => void;
  plain?: boolean;
}) {
  const color = SIDE_COLOR[tx.side];

  return (
    <li className={`relative ${plain ? 'border-b border-[#26343C]/60 last:border-b-0' : 'pl-7'} ${fresh ? 'tx-enter' : ''}`}>
      {!plain && <span aria-hidden="true" className="absolute left-[13px] top-0 bottom-0 w-px bg-[#26343C]" />}
      {fresh && !plain && (
        <span
          aria-hidden="true"
          className="tx-trace absolute left-[13px] top-0 w-px h-[19px] @2xl:h-1/2"
          style={{ backgroundColor: color }}
        />
      )}
      {!plain && (
        <span
          aria-hidden="true"
          className={`absolute left-[10px] top-[19px] @2xl:top-1/2 -translate-y-1/2 w-[7px] h-[7px] rounded-full border ${fresh ? 'tx-marker-in' : ''}`}
          style={{ backgroundColor: `${color}CC`, borderColor: '#0D1419' }}
        />
      )}

      <div className="tx-clip min-h-0">
        <button
          type="button"
          onClick={() => onSelect(tx.id)}
          aria-pressed={selected}
          aria-label={`${tx.side} ${tx.quantity} ${tx.ticker} at $${formatPrice(tx.price)}, ${timeLabel(tx.ms)}. View details`}
          className={`group w-full text-left rounded-lg border transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50 ${
            selected
              ? 'bg-[#111A20] border-[#3B82FF]/45'
              : 'border-transparent hover:bg-[#111A20]/70 hover:border-[#34444D]'
          }`}
        >
          {/* Mobile activity card */}
          <div className="@2xl:hidden px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] tabular-nums">
                <SideTag side={tx.side} />
                <span className="text-[#65737A]">·</span>
                <span className="text-[#A4AFB4]">{timeLabel(tx.ms)}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]">
                <Check className="w-3 h-3" aria-hidden="true" /> Executed
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2 min-w-0">
              <span className="text-sm font-semibold text-[#F3F5F4]">{tx.ticker}</span>
              {tx.name && <span className="text-xs text-[#65737A] truncate">{tx.name}</span>}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2 text-xs tabular-nums">
              <span className="text-[#A4AFB4]">
                {formatShares(tx.quantity)} {tx.quantity === 1 ? 'share' : 'shares'} <span className="text-[#65737A]">·</span> ${formatPrice(tx.price)}
              </span>
              <span className="font-semibold" style={{ color }}>{cashFlowLabel(tx)}</span>
            </div>
          </div>

          {/* Tablet / desktop ledger row */}
          <div className={`hidden @2xl:grid ${LEDGER_COLS} items-center gap-x-3 px-3 h-12 text-[13px] tabular-nums`}>
            <span className="text-xs text-[#A4AFB4]">{timeLabel(tx.ms)}</span>
            <SideTag side={tx.side} />
            <span className="flex items-center gap-2 min-w-0">
              <TickerBadge ticker={tx.ticker} size={22} />
              <span className="font-semibold text-[#F3F5F4]">{tx.ticker}</span>
              {tx.name && <span className="text-xs text-[#65737A] truncate">{tx.name}</span>}
            </span>
            <span className="text-right text-[#F3F5F4]">{formatShares(tx.quantity)}</span>
            <span className="text-right text-[#A4AFB4]">${formatPrice(tx.price)}</span>
            <span className="text-right font-semibold" style={{ color }}>{cashFlowLabel(tx)}</span>
            <span className="hidden @4xl:grid justify-items-end text-[11px] font-semibold uppercase tracking-[0.1em]">
              <span className="col-start-1 row-start-1 inline-flex items-center gap-1 text-[#65737A] transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0">
                <Check className="w-3 h-3" aria-hidden="true" /> Executed
              </span>
              <span className="col-start-1 row-start-1 inline-flex items-center gap-1 text-[#F3F5F4] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 normal-case tracking-normal font-medium text-xs">
                View details <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </span>
            </span>
          </div>
        </button>
      </div>
    </li>
  );
}

export default React.memo(LedgerRow);
