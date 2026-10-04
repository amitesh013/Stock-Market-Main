import React from 'react';
import { format } from 'date-fns';
import { Card, ViewLink, Eyebrow, T, formatUSD } from './ui';

export default function RecentActivity({ transactions }: { transactions: any[] }) {
  const latest = transactions.slice(0, 2);

  return (
    <Card className="!py-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <Eyebrow>Recent</Eyebrow>
        <ul className="flex-1 min-w-0 flex flex-col sm:flex-row gap-1.5 sm:gap-6">
          {latest.length === 0 && <li className="text-sm text-[#A4AFB4]">No trades yet.</li>}
          {latest.map((tx) => {
            const isBuy = tx.type === 'BUY';
            const ts = tx.timestamp?.toDate ? tx.timestamp.toDate() : null;
            return (
              <li key={tx.id} className="flex items-center gap-2.5 text-xs tabular-nums min-w-0">
                <span className="text-[#65737A]">{ts ? format(ts, 'HH:mm') : '--:--'}</span>
                <span className="font-semibold w-8" style={{ color: isBuy ? T.positive : T.negative }}>{tx.type}</span>
                <span className="font-semibold text-[#F3F5F4]">{tx.ticker}</span>
                <span className="text-[#A4AFB4]">{isBuy ? '+' : '-'}{tx.quantity}</span>
                <span className="text-[#65737A] truncate">@ {formatUSD(Number(tx.priceAtExecution) || 0)}</span>
              </li>
            );
          })}
        </ul>
        <ViewLink to="/transactions">View All</ViewLink>
      </div>
    </Card>
  );
}
