import React from 'react';
import { format } from 'date-fns';
import { Eyebrow, ViewLink, T, formatUSD } from '../dashboard/ui';

export default function RecentTrades({ transactions }: { transactions: any[] }) {
  const latest = transactions.slice(0, 3);

  return (
    <section className="rounded-md border border-[#26343C] bg-[#0D1419] p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <Eyebrow>Recent Transactions</Eyebrow>
        <ViewLink to="/transactions">View All Transactions</ViewLink>
      </div>
      {latest.length === 0 ? (
        <p className="text-sm text-[#65737A]">No trades yet.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {latest.map((tx) => {
            const isBuy = tx.type === 'BUY';
            const ts = tx.timestamp?.toDate ? tx.timestamp.toDate() : null;
            return (
              <li key={tx.id} className="flex items-center gap-3 rounded-lg border border-[#26343C] bg-[#111A20]/50 px-3 py-2.5 text-xs tabular-nums">
                <span className="text-[#65737A]">{ts ? format(ts, 'HH:mm') : '--:--'}</span>
                <span className="font-semibold w-8" style={{ color: isBuy ? T.positive : T.negative }}>{tx.type}</span>
                <span className="font-semibold text-[#F3F5F4]">{tx.ticker}</span>
                <span className="text-[#A4AFB4]">{tx.quantity} shares</span>
                <span className="ml-auto text-[#A4AFB4]">{formatUSD(Number(tx.totalAmount) || 0)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
