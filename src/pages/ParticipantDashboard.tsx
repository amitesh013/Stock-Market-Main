import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import Watchlist from '../components/Watchlist';
import Portfolio from '../components/Portfolio';
import Leaderboard from '../components/Leaderboard';
import Transactions from '../components/Transactions';
import NewsFeed from '../components/NewsFeed';
import StockChartModal from '../components/StockChartModal';
import NewsEventBanner from '../components/NewsEventBanner';

interface ParticipantDashboardProps {
  onOpenStockChart?: (stock: any) => void;
}

export default function ParticipantDashboard({ onOpenStockChart }: ParticipantDashboardProps) {
  const [simStatus, setSimStatus] = useState<string>('NOT_STARTED');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PORTFOLIO' | 'NEWS' | 'LEADERBOARD'>('OVERVIEW');
  const [selectedStock, setSelectedStock] = useState<any | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'simulation', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        setSimStatus(docSnap.data().status || 'NOT_STARTED');
      }
    });
    return unsub;
  }, []);

  const handleOpenStock = (stock: any) => {
    setSelectedStock(stock);
    if (onOpenStockChart) onOpenStockChart(stock);
  };

  return (
    <div className="space-y-6">
      {/* Floor Navigation Bar */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
        <div className="flex items-center gap-1 sm:gap-2 bg-zinc-100 p-1 rounded-xl text-xs font-bold overflow-x-auto">
          {[
            { id: 'OVERVIEW', label: '📊 Market & Trading' },
            { id: 'PORTFOLIO', label: '💼 My Portfolio & Allocation' },
            { id: 'NEWS', label: '📰 Catalysts & News' },
            { id: 'LEADERBOARD', label: '🏆 Live Leaderboard' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Overview (Default) */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <NewsEventBanner />
          <Watchlist
            simulationStatus={simStatus}
            onOpenStockChart={handleOpenStock}
          />

          <Portfolio onOpenChart={handleOpenStock} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <NewsFeed onSelectTicker={(ticker) => {
                // If ticker clicked in news, find and open that stock
              }} />
            </div>
            <div className="lg:col-span-1">
              <Transactions />
            </div>
            <div className="lg:col-span-1">
              <Leaderboard />
            </div>
          </div>
        </div>
      )}

      {/* Tab: Portfolio & Allocation */}
      {activeTab === 'PORTFOLIO' && (
        <div className="space-y-6">
          <Portfolio onOpenChart={handleOpenStock} />
          <Transactions />
        </div>
      )}

      {/* Tab: News & Catalysts */}
      {activeTab === 'NEWS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <NewsFeed />
          </div>
          <div className="lg:col-span-1">
            <Watchlist
              simulationStatus={simStatus}
              onOpenStockChart={handleOpenStock}
            />
          </div>
        </div>
      )}

      {/* Tab: Leaderboard */}
      {activeTab === 'LEADERBOARD' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Leaderboard />
          </div>
          <div className="lg:col-span-1">
            <Transactions />
          </div>
        </div>
      )}

      {/* Interactive Stock Terminal / Chart Modal */}
      {selectedStock && (
        <StockChartModal
          stock={selectedStock}
          simulationStatus={simStatus}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}
