import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { useMyTransactions, usePositionSummary } from '../lib/liveData';
import { useLeaderboardUsers } from '../lib/leaderboard';
import { useMarketState } from '../lib/marketState';
import { Eyebrow } from '../components/dashboard/ui';
import TransactionsHeader from '../components/transactions/TransactionsHeader';
import ActivityStrip, { ActivityStats } from '../components/transactions/ActivityStrip';
import ContextPanel from '../components/transactions/ContextPanel';
import LedgerFilters from '../components/transactions/LedgerFilters';
import TransactionLedger from '../components/transactions/TransactionLedger';
import TransactionDetailPanel from '../components/transactions/TransactionDetailPanel';
import EmptyLedger from '../components/transactions/EmptyLedger';
import {
  DateFilter, LedgerTx, SideFilter, TxSort, exportLedgerCsv, sortLedger, toLedgerTx,
} from '../components/transactions/txUtils';

const PAGE_SIZE = 50;
const FRESH_MS = 900;
/** Larger batches are treated as a (re)load rather than live arrivals. */
const MAX_ANIMATED_BATCH = 5;
const HOUR_MS = 60 * 60 * 1000;

function LiveIndicator({ status }: { status: string }) {
  const live = status === 'RUNNING';
  const [label, sub] =
    live ? ['Live Trading', 'New transactions appear automatically']
    : status === 'PAUSED' ? ['Market Paused', 'Transaction history remains available']
    : status === 'COMPLETED' ? ['Simulation Complete', 'Final trading record']
    : ['Market Closed', 'Transaction history remains available'];
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-[#65737A] min-w-0" role="status">
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: live ? '#20C978' : '#65737A' }} />
      <span className="font-semibold uppercase tracking-[0.12em]" style={{ color: live ? '#A4AFB4' : '#65737A' }}>{label}</span>
      <span aria-hidden="true">·</span>
      <span className="truncate">{sub}</span>
    </p>
  );
}

/** Ids that arrived after the initial load, kept briefly so their rows can play the entry animation. */
function useFreshIds(raw: any[]): Set<string> {
  const seenRef = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());

  // An empty first snapshot is indistinguishable from "not loaded yet", so seed after a grace period.
  useEffect(() => {
    const t = setTimeout(() => { if (!seenRef.current) seenRef.current = new Set(); }, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const ids: string[] = raw.map((t) => t.id);
    if (!seenRef.current) {
      if (ids.length) seenRef.current = new Set(ids);
      return;
    }
    const seen = seenRef.current;
    const added = ids.filter((id) => !seen.has(id));
    if (!added.length) return;
    added.forEach((id) => seen.add(id));
    if (added.length > MAX_ANIMATED_BATCH) return;
    setFresh((prev) => new Set([...prev, ...added]));
    setTimeout(() => {
      setFresh((prev) => {
        const next = new Set(prev);
        added.forEach((id) => next.delete(id));
        return next;
      });
    }, FRESH_MS);
  }, [raw]);

  return fresh;
}

export default function Transactions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const market = useMarketState();
  const rawTxs = useMyTransactions();
  const { netWorth, pnl, returnPct, stocks } = usePositionSummary();
  const ranked = useLeaderboardUsers().filter((u) => u.role !== 'admin');
  const freshIds = useFreshIds(rawTxs);

  const [side, setSide] = useState<SideFilter>('ALL');
  const [asset, setAsset] = useState('ALL');
  const [date, setDate] = useState<DateFilter>('ALL');
  const [sort, setSort] = useState<TxSort>('NEWEST');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'TIMELINE' | 'TABLE'>('TIMELINE');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Stocks tick on every price update; only rebuild the lookup when names/ids actually change.
  const stockKey = stocks.map((s) => `${s.ticker}:${s.id}:${s.name}`).sort().join('|');
  const lookup = useMemo(() => {
    const names: Record<string, string> = {};
    const ids: Record<string, string> = {};
    stocks.forEach((s) => {
      if (s.name) names[s.ticker] = s.name;
      ids[s.ticker] = s.id;
    });
    return { names, ids };
  }, [stockKey]);

  const ledger = useMemo(() => rawTxs.map((t) => toLedgerTx(t, lookup.names)), [rawTxs, lookup]);

  const stats = useMemo<ActivityStats>(() => {
    const s: ActivityStats = { total: ledger.length, buys: 0, sells: 0, bought: 0, sold: 0, traded: 0 };
    ledger.forEach((t) => {
      if (t.side === 'BUY') { s.buys++; s.bought += t.total; } else { s.sells++; s.sold += t.total; }
      s.traded += t.total;
    });
    return s;
  }, [ledger]);

  const assets = useMemo(() => Array.from(new Set(ledger.map((t) => t.ticker))).sort(), [ledger]);

  useEffect(() => {
    if (date === 'ALL') return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [date]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const startOfDay = new Date(now).setHours(0, 0, 0, 0);
    const list = ledger.filter((t) => {
      if (side !== 'ALL' && t.side !== side) return false;
      if (asset !== 'ALL' && t.ticker !== asset) return false;
      if (date !== 'ALL' && t.ms !== null) {
        if (date === 'TODAY' && t.ms < startOfDay) return false;
        if (date === 'HOUR' && t.ms < now - HOUR_MS) return false;
      }
      if (q && !t.ticker.toLowerCase().includes(q) && !(t.name ?? '').toLowerCase().includes(q) && !t.side.toLowerCase().includes(q)) return false;
      return true;
    });
    return sortLedger(list, sort);
  }, [ledger, side, asset, date, sort, search, now]);

  useEffect(() => { setVisible(PAGE_SIZE); }, [side, asset, date, sort, search]);

  const shown = useMemo(() => filtered.slice(0, visible), [filtered, visible]);
  const selectedTx: LedgerTx | null = useMemo(() => ledger.find((t) => t.id === selectedId) ?? null, [ledger, selectedId]);

  const onSelect = useCallback((id: string) => setSelectedId((cur) => (cur === id ? null : id)), []);
  const closeDetail = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const openInMarket = () => {
    if (!selectedTx) return;
    navigate('/market', { state: { stockId: lookup.ids[selectedTx.ticker] ?? selectedTx.stockId } });
  };

  const clearFilters = () => {
    setSide('ALL'); setAsset('ALL'); setDate('ALL'); setSearch('');
  };

  const isFiltered = side !== 'ALL' || asset !== 'ALL' || date !== 'ALL' || search.trim() !== '';
  const rankIndex = ranked.findIndex((u) => u.id === user?.uid);

  const detail = selectedTx && (
    <TransactionDetailPanel tx={selectedTx} onClose={closeDetail} onOpenMarket={openInMarket} />
  );

  return (
    <div>
      <TransactionsHeader
        total={stats.total}
        buys={stats.buys}
        sells={stats.sells}
        onExport={() => exportLedgerCsv(sortLedger(ledger, 'NEWEST'))}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        <div className="lg:col-span-7 xl:col-span-8">
          <ActivityStrip stats={stats} />
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <ContextPanel
            netWorth={netWorth}
            pnl={pnl}
            returnPct={returnPct}
            rankIndex={rankIndex}
            rankTotal={ranked.length}
            trades={stats.total}
          />
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 items-start ${selectedTx ? 'xl:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
        <section aria-label="Trade ledger" className="min-w-0 border-t border-[#26343C] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-1 pt-4 pb-3 border-b border-[#26343C]">
            <div className="flex items-center gap-3">
              <div className="flex rounded-sm border border-[#26343C] p-0.5" role="group" aria-label="Ledger view">
                {(['TIMELINE', 'TABLE'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={`h-6 px-2.5 rounded-sm text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors cursor-pointer ${
                      view === v ? 'bg-[#111A20] text-[#F3F5F4]' : 'text-[#65737A] hover:text-[#A4AFB4]'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <Eyebrow>Trade Ledger</Eyebrow>
              {ledger.length > 0 && (
                <span className="text-[11px] text-[#65737A] tabular-nums">
                  {isFiltered ? `${filtered.length} of ${ledger.length}` : ledger.length} {ledger.length === 1 ? 'trade' : 'trades'}
                </span>
              )}
            </div>
            <LiveIndicator status={market.status} />
          </div>

          {ledger.length === 0 ? (
            <EmptyLedger />
          ) : (
            <>
              <LedgerFilters
                side={side} onSide={setSide}
                asset={asset} onAsset={setAsset} assets={assets}
                date={date} onDate={setDate}
                sort={sort} onSort={setSort}
                search={search} onSearch={setSearch}
              />
              {filtered.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A4AFB4]">No transactions found</p>
                  <p className="mt-1 text-[13px] text-[#65737A]">Try a different side, asset, date range or search.</p>
                  {isFiltered && (
                    <button
                      onClick={clearFilters}
                      className="mt-4 h-8 px-3 rounded-lg border border-[#26343C] text-xs font-semibold text-[#A4AFB4] hover:text-[#F3F5F4] hover:border-[#4A5A63] transition-colors duration-200 cursor-pointer"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <TransactionLedger
                  rows={shown}
                  groupByDay={view === 'TIMELINE' && (sort === 'NEWEST' || sort === 'OLDEST')}
                  plain={view === 'TABLE'}
                  selectedId={selectedId}
                  freshIds={freshIds}
                  onSelect={onSelect}
                  hasMore={filtered.length > shown.length}
                  remaining={filtered.length - shown.length}
                  onShowMore={() => setVisible((v) => v + PAGE_SIZE)}
                />
              )}
            </>
          )}
        </section>

        {detail && (
          <aside aria-label="Transaction details" className="hidden xl:block sticky top-6 rounded-md border border-[#26343C] bg-[#0D1419] p-5">
            {detail}
          </aside>
        )}
      </div>

      {detail && (
        <div className="xl:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-[#06090B]/70" onClick={closeDetail} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Transaction details"
            className="tx-sheet relative w-full sm:max-w-sm max-h-[85vh] overflow-y-auto rounded-t-xl sm:rounded-md border border-[#26343C] bg-[#0D1419] p-5"
          >
            {detail}
          </div>
        </div>
      )}
    </div>
  );
}
