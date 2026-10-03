import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { TrendingUp, TrendingDown, Radio } from 'lucide-react';

interface TickerTapeProps {
  onSelectStock: (stock: any) => void;
}

function formatUSD(val: number): string {
  if (isNaN(val)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export default function TickerTape({ onSelectStock }: TickerTapeProps) {
  const [stocks, setStocks] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'stocks'), where('isActive', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      const rawList: any[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter((s: any) => !((s.sector || '').toLowerCase().includes('crypto')));

      // Deduplicate by uppercase ticker
      const tickerMap = new Map<string, any>();
      rawList.forEach((s) => {
        const norm = (s.ticker || '').trim().toUpperCase();
        if (!norm) return;
        const existing = tickerMap.get(norm);
        if (!existing) {
          tickerMap.set(norm, s);
        } else {
          const timeA = s.lastUpdated?.seconds || s.createdAt?.seconds || 0;
          const timeB = existing.lastUpdated?.seconds || existing.createdAt?.seconds || 0;
          if (timeA >= timeB) tickerMap.set(norm, s);
        }
      });

      setStocks(Array.from(tickerMap.values()));
    });
    return unsub;
  }, []);

  if (stocks.length === 0) return null;

  return (
    <div className="bg-zinc-950 text-white border-b border-zinc-850 py-1.5 px-4 shadow-inner overflow-hidden select-none">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider shrink-0">
          <Radio className="w-3 h-3 text-blue-400 animate-pulse" />
          <span>Live Ticker</span>
        </div>

        <div className="flex items-center gap-5 overflow-x-auto no-scrollbar py-0.5 text-xs whitespace-nowrap">
          {stocks.map((stock) => {
            const currentP = Number(stock.currentPrice) || 0;
            const dayOpen = Number(stock.dayOpenPrice || stock.basePrice || currentP);
            const changePercent =
              stock.changePercent !== undefined
                ? Number(stock.changePercent)
                : dayOpen > 0
                ? Math.round(((currentP - dayOpen) / dayOpen) * 10000) / 100
                : 0;
            const isUp = changePercent >= 0;

            return (
              <button
                key={stock.id}
                onClick={() => onSelectStock(stock)}
                className="flex items-center gap-2 hover:bg-zinc-800/80 px-2 py-1 rounded-lg transition-colors group cursor-pointer"
              >
                <span className="font-extrabold text-zinc-200 group-hover:text-blue-400 transition-colors tracking-tight">
                  {stock.ticker}
                </span>
                <span className="font-mono text-zinc-100 font-medium tabular-nums">
                  {formatUSD(currentP)}
                </span>
                <span
                  className={`flex items-center text-[11px] font-bold font-mono ${
                    isUp ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isUp ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                  {isUp ? '+' : ''}
                  {changePercent.toFixed(2)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
