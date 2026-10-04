import { format, isToday, isYesterday } from 'date-fns';

export type TxSide = 'BUY' | 'SELL';
export type SideFilter = 'ALL' | TxSide;
export type DateFilter = 'ALL' | 'TODAY' | 'HOUR';
export type TxSort = 'NEWEST' | 'OLDEST' | 'LARGEST' | 'SMALLEST';

export interface LedgerTx {
  id: string;
  stockId: string;
  ticker: string;
  name?: string;
  side: TxSide;
  quantity: number;
  price: number;
  total: number;
  cashAfter: number | null;
  /** null while the server timestamp has not resolved yet. */
  ms: number | null;
}

const tsMillis = (v: any): number | null =>
  v?.toMillis ? v.toMillis() : typeof v?.seconds === 'number' ? v.seconds * 1000 : null;

export function toLedgerTx(raw: any, nameByTicker: Record<string, string>): LedgerTx {
  const ticker = String(raw.ticker || raw.stockId?.slice(0, 5) || '—').toUpperCase();
  const quantity = Number(raw.quantity) || 0;
  const price = Number(raw.priceAtExecution) || 0;
  return {
    id: raw.id,
    stockId: raw.stockId || '',
    ticker,
    name: nameByTicker[ticker],
    side: raw.type === 'SELL' ? 'SELL' : 'BUY',
    quantity,
    price,
    total: raw.totalAmount !== undefined ? Number(raw.totalAmount) || 0 : Math.round(quantity * price * 100) / 100,
    cashAfter: raw.resultingCashBalance !== undefined ? Number(raw.resultingCashBalance) : null,
    ms: tsMillis(raw.timestamp),
  };
}

/** Pending (unresolved) timestamps sort as the newest. */
const sortMs = (t: LedgerTx) => t.ms ?? Number.MAX_SAFE_INTEGER;

export function sortLedger(list: LedgerTx[], sort: TxSort): LedgerTx[] {
  const byTime = (a: LedgerTx, b: LedgerTx) => sortMs(b) - sortMs(a) || (a.id < b.id ? 1 : -1);
  const copy = [...list];
  switch (sort) {
    case 'OLDEST': return copy.sort((a, b) => -byTime(a, b));
    case 'LARGEST': return copy.sort((a, b) => b.total - a.total || byTime(a, b));
    case 'SMALLEST': return copy.sort((a, b) => a.total - b.total || byTime(a, b));
    default: return copy.sort(byTime);
  }
}

export function dayKey(ms: number | null): string {
  return format(ms ?? Date.now(), 'yyyy-MM-dd');
}

export function dayLabel(ms: number | null): string {
  const d = new Date(ms ?? Date.now());
  if (isToday(d)) return `Today · ${format(d, 'MMM d')}`;
  if (isYesterday(d)) return `Yesterday · ${format(d, 'MMM d')}`;
  return format(d, 'EEE · MMM d, yyyy');
}

export function timeLabel(ms: number | null, withSeconds = false): string {
  if (ms === null) return 'Just now';
  return format(ms, withSeconds ? 'HH:mm:ss' : 'HH:mm');
}

export const SIDE_COLOR: Record<TxSide, string> = { BUY: '#20C978', SELL: '#FF4D5A' };

export function formatShares(q: number): string {
  return q.toLocaleString();
}

/** Signed cash flow: buys spend cash, sells return it. */
export function cashFlowLabel(tx: LedgerTx): string {
  const abs = tx.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${tx.side === 'BUY' ? '−' : '+'}$${abs}`;
}

export function exportLedgerCsv(list: LedgerTx[]) {
  const header = ['executed_at', 'side', 'ticker', 'company', 'shares', 'price', 'total', 'cash_after', 'order_type', 'status', 'reference'];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = list.map((t) => [
    t.ms !== null ? new Date(t.ms).toISOString() : '',
    t.side,
    t.ticker,
    t.name ?? '',
    t.quantity,
    t.price.toFixed(2),
    t.total.toFixed(2),
    t.cashAfter !== null ? t.cashAfter.toFixed(2) : '',
    'MARKET',
    'EXECUTED',
    t.id,
  ].map(esc).join(','));
  const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions-${format(Date.now(), 'yyyyMMdd-HHmm')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
