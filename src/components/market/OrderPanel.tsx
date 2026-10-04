import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, CheckCircle2, AlertCircle, ArrowRight, Lock } from 'lucide-react';
import { executeTrade } from '../../lib/trade';
import { LiveStock } from '../../lib/liveData';
import { T, formatUSD } from '../dashboard/ui';
import { Side, formatPrice } from './marketUtils';

interface OrderPanelProps {
  stock: LiveStock | null;
  side: Side;
  onSide: (s: Side) => void;
  marketStatus: string;
  cash: number;
  sharesOwned: number;
  avgCost: number;
  rank: { position: number; total: number } | null;
}

const CLOSED_COPY: Record<string, string> = {
  NOT_STARTED: 'Trading will begin once the admin opens the market.',
  PAUSED: 'Trading is temporarily paused by the admin.',
  COMPLETED: 'The competition has ended. Trading is locked.',
};

export default function OrderPanel({ stock, side, onSide, marketStatus, cash, sharesOwned, avgCost, rank }: OrderPanelProps) {
  const [qtyText, setQtyText] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => { setResult(null); }, [stock?.id, side]);

  const isOpen = marketStatus === 'RUNNING';
  const isBuy = side === 'BUY';
  const price = stock?.currentPrice || 0;
  const qty = Number(qtyText);
  const validQty = Number.isInteger(qty) && qty > 0;
  const total = validQty ? Math.round(qty * price * 100) / 100 : 0;
  const maxBuy = price > 0 ? Math.floor(cash / price) : 0;
  const tone = isBuy ? T.positive : T.negative;

  let problem: string | null = null;
  if (!stock) problem = 'Select a stock to trade.';
  else if (!isOpen) problem = null; // shown as the closed notice instead
  else if (stock.isActive === false) problem = `${stock.ticker} is not currently tradable.`;
  else if (!validQty) problem = 'Enter a whole number of shares above zero.';
  else if (isBuy && total > cash) problem = `Insufficient cash. You can afford up to ${maxBuy} share${maxBuy === 1 ? '' : 's'}.`;
  else if (!isBuy && sharesOwned === 0) problem = `You don't own any ${stock.ticker} shares.`;
  else if (!isBuy && qty > sharesOwned) problem = `You only own ${sharesOwned} share${sharesOwned === 1 ? '' : 's'} of ${stock.ticker}.`;

  const canSubmit = !!stock && isOpen && !problem && !submitting;

  const step = (d: number) => {
    const next = Math.max(1, (validQty ? qty : 0) + d);
    setQtyText(String(next));
    setResult(null);
  };

  const setMax = () => {
    const m = isBuy ? maxBuy : sharesOwned;
    if (m > 0) setQtyText(String(m));
    setResult(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stock || !canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await executeTrade(stock.id, side, qty);
      setResult({ ok: true, msg: `${res.type === 'BUY' ? 'Bought' : 'Sold'} ${res.quantity} ${res.ticker} at $${formatPrice(res.price)}.` });
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message || 'Trade failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-md border border-[#26343C] bg-[#0D1419] p-4 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#06090B] border border-[#26343C]" role="tablist" aria-label="Order side">
        {(['BUY', 'SELL'] as Side[]).map((s) => {
          const active = side === s;
          const c = s === 'BUY' ? T.positive : T.negative;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSide(s)}
              className="h-8 rounded-md text-[13px] font-semibold transition-colors duration-200 cursor-pointer border"
              style={{
                color: active ? T.text : T.text2,
                backgroundColor: active ? `${c}2E` : 'transparent',
                borderColor: active ? `${c}88` : 'transparent',
              }}
            >
              {s === 'BUY' ? 'Buy' : 'Sell'}
            </button>
          );
        })}
      </div>

      <div>
        <label htmlFor="order-type" className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#65737A] mb-1.5">Order Type</label>
        <select
          id="order-type"
          defaultValue="MARKET"
          className="w-full h-9 px-3 rounded-lg bg-[#111A20] border border-[#26343C] text-sm text-[#F3F5F4] outline-none focus:border-[#3B82FF]/60 cursor-pointer"
        >
          <option value="MARKET">Market Order</option>
          <option value="LIMIT" disabled>Limit Order (not available)</option>
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="order-qty" className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">Shares</label>
          <button type="button" onClick={setMax} className="text-[11px] font-semibold text-[#A4AFB4] hover:text-[#F3F5F4] cursor-pointer">
            Max {isBuy ? maxBuy : sharesOwned}
          </button>
        </div>
        <div className="flex items-center h-10 rounded-lg bg-[#111A20] border border-[#26343C] focus-within:border-[#3B82FF]/60 transition-colors">
          <button type="button" onClick={() => step(-1)} aria-label="Decrease shares" className="w-10 h-full flex items-center justify-center text-[#A4AFB4] hover:text-[#F3F5F4] cursor-pointer">
            <Minus className="w-4 h-4" />
          </button>
          <input
            id="order-qty"
            inputMode="numeric"
            value={qtyText}
            onChange={(e) => { setQtyText(e.target.value.replace(/[^\d]/g, '')); setResult(null); }}
            className="flex-1 min-w-0 h-full bg-transparent text-center text-base font-semibold tabular-nums text-[#F3F5F4] outline-none"
          />
          <button type="button" onClick={() => step(1)} aria-label="Increase shares" className="w-10 h-full flex items-center justify-center text-[#A4AFB4] hover:text-[#F3F5F4] cursor-pointer">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <dl className="space-y-2 text-[13px]">
        <div className="flex justify-between">
          <dt className="text-[#A4AFB4]">Price</dt>
          <dd className="tabular-nums text-[#F3F5F4]">{stock ? `$${formatPrice(price)}` : '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#A4AFB4]">{isBuy ? 'Estimated Cost' : 'Estimated Proceeds'}</dt>
          <dd className="tabular-nums font-semibold text-[#F3F5F4]">{formatUSD(total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#A4AFB4]">Available Cash</dt>
          <dd className="tabular-nums text-[#F3F5F4]">{formatUSD(cash)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#A4AFB4]">Shares Owned</dt>
          <dd className="tabular-nums text-[#F3F5F4]">
            {sharesOwned}{avgCost > 0 && <span className="text-[#65737A]"> @ ${formatPrice(avgCost)}</span>}
          </dd>
        </div>
      </dl>

      {!isOpen ? (
        <div className="flex items-start gap-2 rounded-lg border border-[#26343C] bg-[#111A20] px-3 py-2.5 text-xs text-[#A4AFB4]">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#FF4D5A]" />
          <span>
            <span className="font-semibold text-[#F3F5F4]">{marketStatus === 'PAUSED' ? 'Market paused. ' : marketStatus === 'NOT_STARTED' ? 'Pre-market. ' : 'Market closed. '}</span>
            {CLOSED_COPY[marketStatus] || CLOSED_COPY.NOT_STARTED}
          </span>
        </div>
      ) : problem && (qtyText !== '' || !stock) ? (
        <p className="flex items-start gap-2 text-xs text-[#FF4D5A]" role="alert">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{problem}
        </p>
      ) : null}

      {result && (
        <p className={`flex items-start gap-2 text-xs ${result.ok ? 'text-[#20C978]' : 'text-[#FF4D5A]'}`} role="status">
          {result.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
          {result.msg}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="h-10 rounded-lg text-sm font-semibold transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1419]"
        style={canSubmit
          ? { backgroundColor: tone, color: T.text }
          : { backgroundColor: T.surface2, color: T.muted, border: `1px solid ${T.border}` }}
      >
        {submitting
          ? 'Submitting…'
          : !isOpen
          ? 'Market Closed'
          : `${isBuy ? 'Buy' : 'Sell'} ${stock?.ticker ?? ''}`}
      </button>

      <Link
        to="/leaderboard"
        className="group flex items-center justify-between rounded-lg border border-[#26343C] px-3 py-2 text-xs hover:border-[#4A5A63] transition-colors"
      >
        <span className="text-[#A4AFB4]">
          Your rank{' '}
          <span className="font-semibold tabular-nums" style={{ color: T.user }}>
            {rank ? `#${rank.position}` : '—'}
          </span>
          {rank && <span className="text-[#65737A] tabular-nums"> / {rank.total}</span>}
        </span>
        <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.1em] text-[10px] text-[#A4AFB4] group-hover:text-[#F3F5F4]">
          Leaderboard <ArrowRight className="w-3 h-3" />
        </span>
      </Link>
    </form>
  );
}
