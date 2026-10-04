import React, { useMemo } from 'react';
import LedgerRow, { LEDGER_COLS } from './LedgerRow';
import { LedgerTx, dayKey, dayLabel } from './txUtils';

const HEAD = 'text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]';

interface Group {
  key: string;
  label: string | null;
  items: LedgerTx[];
}

export default function TransactionLedger({ rows, groupByDay, plain = false, selectedId, freshIds, onSelect, hasMore, remaining, onShowMore }: {
  rows: LedgerTx[];
  groupByDay: boolean;
  plain?: boolean;
  selectedId: string | null;
  freshIds: Set<string>;
  onSelect: (id: string) => void;
  hasMore: boolean;
  remaining: number;
  onShowMore: () => void;
}) {
  const groups = useMemo<Group[]>(() => {
    if (!groupByDay) return [{ key: 'all', label: null, items: rows }];
    const out: Group[] = [];
    rows.forEach((tx) => {
      const key = dayKey(tx.ms);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(tx);
      else out.push({ key, label: dayLabel(tx.ms), items: [tx] });
    });
    return out;
  }, [rows, groupByDay]);

  return (
    <div className="@container">
      <div className={`hidden @2xl:grid ${LEDGER_COLS} gap-x-3 ${plain ? 'pl-[21px]' : 'pl-[49px]'} pr-[21px] py-2 border-b border-[#26343C]`}>
        <span className={HEAD}>Time</span>
        <span className={HEAD}>Side</span>
        <span className={HEAD}>Asset</span>
        <span className={`${HEAD} text-right`}>Shares</span>
        <span className={`${HEAD} text-right`}>Price</span>
        <span className={`${HEAD} text-right`}>Total</span>
        <span className={`${HEAD} text-right hidden @4xl:block`}>Status</span>
      </div>

      <div className="px-2 py-2">
        {groups.map((g, gi) => (
          <ul key={g.key} aria-label={g.label ?? 'Transactions'}>
            {g.label && !plain && (
              <li className={`relative pl-7 pb-1.5 ${gi === 0 ? 'pt-1' : 'pt-3'}`}>
                <span aria-hidden="true" className="absolute left-[13px] top-0 bottom-0 w-px bg-[#26343C]" />
                <span aria-hidden="true" className="absolute left-[11px] top-1/2 w-[5px] h-px bg-[#65737A]" />
                <div className="flex items-baseline justify-between gap-3 px-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A4AFB4]">{g.label}</span>
                  <span className="text-[11px] text-[#65737A] tabular-nums">
                    {g.items.length} {g.items.length === 1 ? 'trade' : 'trades'}
                  </span>
                </div>
              </li>
            )}
            {g.items.map((tx) => (
              <LedgerRow
                key={tx.id}
                tx={tx}
                selected={tx.id === selectedId}
                fresh={freshIds.has(tx.id)}
                onSelect={onSelect}
                plain={plain}
              />
            ))}
          </ul>
        ))}
      </div>

      {hasMore && (
        <div className="px-4 pb-4">
          <button
            onClick={onShowMore}
            className="w-full h-9 rounded-lg border border-[#26343C] text-xs font-semibold text-[#A4AFB4] hover:text-[#F3F5F4] hover:border-[#4A5A63] transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
          >
            Show more <span className="text-[#65737A] tabular-nums">· {remaining} remaining</span>
          </button>
        </div>
      )}
    </div>
  );
}
