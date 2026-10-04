import React from 'react';
import { format } from 'date-fns';
import { ArrowRight, Check, X } from 'lucide-react';
import TickerBadge from '../market/TickerBadge';
import { formatPrice } from '../market/marketUtils';
import { Eyebrow, formatUSD } from '../dashboard/ui';
import { SideTag } from './LedgerRow';
import { LedgerTx, SIDE_COLOR, cashFlowLabel, formatShares } from './txUtils';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-[#26343C]/70 last:border-b-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">{label}</dt>
      <dd className="text-[13px] tabular-nums text-[#F3F5F4] text-right min-w-0 truncate">{children}</dd>
    </div>
  );
}

export default function TransactionDetailPanel({ tx, onClose, onOpenMarket }: {
  tx: LedgerTx;
  onClose: () => void;
  onOpenMarket: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Transaction Details</Eyebrow>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="p-1 -mr-1 rounded-md text-[#65737A] hover:text-[#F3F5F4] hover:bg-[#111A20] transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3 min-w-0">
        <TickerBadge ticker={tx.ticker} size={34} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-[#F3F5F4]">{tx.ticker}</span>
            <SideTag side={tx.side} />
          </div>
          <div className="text-xs text-[#65737A] truncate">{tx.name ?? 'Company name unavailable'}</div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[#26343C] bg-[#0C1112] px-3 py-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]">
          {tx.side === 'BUY' ? 'Cash spent' : 'Cash received'}
        </div>
        <div className="mt-0.5 text-xl font-semibold tabular-nums" style={{ color: SIDE_COLOR[tx.side] }}>
          {cashFlowLabel(tx)}
        </div>
      </div>

      <dl className="mt-3">
        <Field label="Shares">{formatShares(tx.quantity)}</Field>
        <Field label="Execution Price">${formatPrice(tx.price)}</Field>
        <Field label="Executed At">
          {tx.ms !== null ? (
            <>
              {format(tx.ms, 'HH:mm:ss')} <span className="text-[#65737A]">· {format(tx.ms, 'MMM d, yyyy')}</span>
            </>
          ) : 'Confirming…'}
        </Field>
        <Field label="Order Type">Market Order</Field>
        <Field label="Status">
          <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5 text-[#A4AFB4]" aria-hidden="true" /> Executed</span>
        </Field>
        {tx.cashAfter !== null && <Field label="Cash After Trade">{formatUSD(tx.cashAfter)}</Field>}
        <Field label="Reference"><span className="font-mono text-xs text-[#A4AFB4]" title={tx.id}>{tx.id.slice(0, 10)}</span></Field>
      </dl>

      <button
        onClick={onOpenMarket}
        className="group mt-4 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-[#26343C] text-xs font-semibold uppercase tracking-[0.1em] text-[#A4AFB4] hover:text-[#F3F5F4] hover:border-[#4A5A63] transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
      >
        Open in Market
        <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}
