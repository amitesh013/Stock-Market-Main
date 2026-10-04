import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { useSession } from '../lib/SessionContext';
import { COLLECTIONS, SESSION_SUBCOLLECTIONS } from '../lib/shared-types';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function Transactions() {
  const { user } = useAuth();
  const { sessionId } = useSession();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stocks, setStocks] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user || !sessionId) return;

    const q = query(
      collection(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.TRANSACTIONS),
      where('userId', '==', user.uid)
    );

    const unsubT = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setTransactions(list);
    }, (err) => console.error('Transactions query error:', err));

    const unsubS = onSnapshot(
      collection(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.STOCKS),
      (snap) => {
        const stockMap: Record<string, any> = {};
        snap.forEach(d => { stockMap[d.id] = d.data(); });
        setStocks(stockMap);
      }
    );

    return () => { unsubT(); unsubS(); };
  }, [user, sessionId]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-zinc-200 bg-zinc-50/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-zinc-900">Trade History</h3>
        </div>
        <span className="text-xs text-zinc-500 font-medium">
          {transactions.length} total orders
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto min-h-[260px]">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase font-semibold text-zinc-500 bg-zinc-50/50 border-b border-zinc-100 sticky top-0">
            <tr>
              <th className="px-4 py-2.5">Time</th>
              <th className="px-4 py-2.5">Side</th>
              <th className="px-4 py-2.5">Asset</th>
              <th className="px-4 py-2.5 text-right">Shares</th>
              <th className="px-4 py-2.5 text-right">Price</th>
              <th className="px-4 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {transactions.map(tx => {
              const stock = stocks[tx.stockId];
              const isBuy = tx.type === 'BUY';
              const totalValue = (tx.quantity || 0) * (tx.priceAtExecution || 0);
              
              let dateStr = 'Just now';
              if (tx.timestamp?.toDate) {
                dateStr = format(tx.timestamp.toDate(), 'MMM d, HH:mm:ss');
              }

              return (
                <tr key={tx.id} className="hover:bg-zinc-50/70 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-zinc-500 whitespace-nowrap">
                    {dateStr}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${
                      isBuy ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-bold text-zinc-900">
                    {stock?.ticker || tx.stockId?.slice(0, 5)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-zinc-800">{tx.quantity}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-600">${Number(tx.priceAtExecution || 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-zinc-900">${totalValue.toFixed(2)}</td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-400">
                  <p className="text-sm font-medium text-zinc-600">No trading activity yet</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Your executed buy and sell orders will appear here.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
