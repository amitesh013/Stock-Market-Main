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

  const items = stocks.map((stock) => {
    const currentP = Number(stock.currentPrice) || 0;
    const dayOpen = Number(stock.dayOpenPrice || stock.basePrice || currentP);
    const changePercent =
      stock.changePercent !== undefined
        ? Number(stock.changePercent)
        : dayOpen > 0
        ? Math.round(((currentP - dayOpen) / dayOpen) * 10000) / 100
        : 0;
    return { stock, currentP, changePercent, isUp: changePercent >= 0 };
  });

  const renderItems = (copy: number) =>
    items.map(({ stock, currentP, changePercent, isUp }) => (
      <button
        key={`${copy}-${stock.id}`}
        onClick={() => onSelectStock(stock)}
        tabIndex={copy === 0 ? 0 : -1}
        aria-hidden={copy === 0 ? undefined : true}
        className="flex items-center gap-2 px-3 h-full hover:bg-[#162129] transition-colors group cursor-pointer"
      >
        <span className="font-bold text-[#F3F5F4] group-hover:text-[#3B82FF] transition-colors tracking-tight">{stock.ticker}</span>
        <span className="text-[#A4AFB4] tabular-nums">{formatUSD(currentP)}</span>
        <span className="flex items-center text-[11px] font-semibold tabular-nums" style={{ color: isUp ? '#39FF88' : '#FF4D5A' }}>
          {isUp ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
          {isUp ? '+' : ''}
          {changePercent.toFixed(2)}%
        </span>
        <span className="ml-1 w-px h-3 bg-[#26343C]" aria-hidden="true" />
      </button>
    ));

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 h-8 bg-[#06090B]/95 backdrop-blur border-t border-[#26343C] select-none flex items-stretch text-xs">
      <div aria-hidden="true" className="hdr-line absolute left-0 right-0 -top-px h-px" />
      <div className="flex items-center gap-1.5 px-3 shrink-0 border-r border-[#26343C] text-[10px] font-bold uppercase tracking-[0.14em] text-[#00D9FF]">
        <Radio className="w-3 h-3 animate-pulse" />
        <span className="hidden sm:inline">Live Ticker</span>
      </div>
      <div className="ticker-viewport relative flex-1 min-w-0 overflow-hidden">
        <div className="ticker-track flex items-stretch h-full w-max whitespace-nowrap">
          {renderItems(0)}
          {renderItems(1)}
        </div>
      </div>
    </div>
  );
}
