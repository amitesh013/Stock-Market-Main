import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Newspaper, TrendingUp, TrendingDown, Sparkles, Filter } from 'lucide-react';
import { seedDefaultNews } from '../lib/stockData';
import { useAuth } from './AuthProvider';

interface NewsFeedProps {
  onSelectTicker?: (ticker: string) => void;
}

export default function NewsFeed({ onSelectTicker }: NewsFeedProps) {
  const { userData } = useAuth();
  const [news, setNews] = useState<any[]>([]);
  const [filterTicker, setFilterTicker] = useState<string>('ALL');
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'news'), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a: any, b: any) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });
      setNews(items);
    });

    return unsub;
  }, []);

  const handleSeedNews = async () => {
    setSeeding(true);
    try {
      await seedDefaultNews();
    } catch (e) {
      console.error('Seed news error:', e);
    } finally {
      setSeeding(false);
    }
  };

  const tickersList = Array.from(new Set(news.map(n => n.ticker))).filter(Boolean);

  const filteredNews = news.filter(n => {
    if (filterTicker === 'ALL') return true;
    return n.ticker === filterTicker;
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 bg-zinc-50/70 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Newspaper className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-sm">Financial News & Catalysts</h3>
            <span className="text-[11px] text-zinc-500">Live sentiment drivers impacting market prices</span>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          {tickersList.length > 1 && (
            <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs">
              <Filter className="w-3 h-3 text-zinc-400" />
              <select
                value={filterTicker}
                onChange={(e) => setFilterTicker(e.target.value)}
                className="bg-transparent text-xs text-zinc-700 font-medium outline-none cursor-pointer"
              >
                <option value="ALL">All Catalysts</option>
                {tickersList.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          {news.length === 0 && userData?.role === 'admin' && (
            <button
              onClick={handleSeedNews}
              disabled={seeding}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              {seeding ? 'Seeding...' : 'Seed News'}
            </button>
          )}
        </div>
      </div>

      {/* News List */}
      <div className="flex-1 min-h-[280px] max-h-[520px] overflow-y-auto p-4 space-y-3">
        {filteredNews.map(item => {
          const isBull = item.sentiment === 'BULLISH';
          const isBear = item.sentiment === 'BEARISH';

          return (
            <div
              key={item.id}
              className="p-3 bg-zinc-50/70 hover:bg-zinc-100/70 transition-all rounded-xl border border-zinc-200/80 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {item.ticker && (
                    <button
                      onClick={() => onSelectTicker && item.ticker !== 'ALL' && onSelectTicker(item.ticker)}
                      className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        item.ticker !== 'ALL' 
                          ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer' 
                          : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      {item.ticker}
                    </button>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                    isBull ? 'bg-emerald-100 text-emerald-700' :
                    isBear ? 'bg-rose-100 text-rose-700' :
                    'bg-zinc-200 text-zinc-700'
                  }`}>
                    {isBull && <TrendingUp className="w-3 h-3" />}
                    {isBear && <TrendingDown className="w-3 h-3" />}
                    {item.sentiment || 'MARKET'}
                  </span>
                </div>

                <span className="text-[10px] text-zinc-400">
                  {item.timestamp?.seconds 
                    ? new Date(item.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Just now'}
                </span>
              </div>

              <h4 className="font-bold text-xs text-zinc-900 leading-snug">
                {item.headline}
              </h4>
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                {item.summary}
              </p>
            </div>
          );
        })}

        {filteredNews.length === 0 && (
          <div className="text-center py-10 text-zinc-400 space-y-1">
            <Newspaper className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
            <p className="text-xs font-medium text-zinc-600">No market catalysts recorded yet</p>
            <p className="text-[11px] text-zinc-400">Market events and news bulletins will appear here in real time.</p>
          </div>
        )}
      </div>
    </div>
  );
}
