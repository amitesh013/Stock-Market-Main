import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import Watchlist from '../components/Watchlist';
import Portfolio from '../components/Portfolio';
import Leaderboard from '../components/Leaderboard';
import Transactions from '../components/Transactions';
import NewsFeed from '../components/NewsFeed';
import StockChartModal from '../components/StockChartModal';
import NewsEventBanner from '../components/NewsEventBanner';
import { useSession } from '../lib/SessionContext';
import { BarChart3, BriefcaseBusiness, Newspaper, Trophy } from 'lucide-react';

interface ParticipantDashboardProps {
  onOpenStockChart?: (stock: any) => void;
}

export default function ParticipantDashboard({ onOpenStockChart }: ParticipantDashboardProps) {
  const { sessionId = '' } = useParams<{ sessionId: string }>();
  const [simStatus, setSimStatus] = useState<string>('NOT_STARTED');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PORTFOLIO' | 'NEWS' | 'LEADERBOARD'>('OVERVIEW');
  const [selectedStock, setSelectedStock] = useState<any | null>(null);

  const { sessionId: ctxSessionId, sessionStatus } = useSession();
  // Prefer sessionId from URL param (already provided by useParams), fall back to context
  const resolvedSessionId = sessionId || ctxSessionId || '';

  useEffect(() => {
    setSimStatus(sessionStatus);
  }, [sessionStatus]);

  const handleOpenStock = (stock: any) => {
    setSelectedStock(stock);
    if (onOpenStockChart) onOpenStockChart(stock);
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Floor Navigation Bar */}
      <div className="min-w-0 border-b border-zinc-200 pb-3">
        <div className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1 text-xs font-bold sm:gap-2">
          {[
            { id: 'OVERVIEW', label: 'Market & Trading', icon: BarChart3 },
            { id: 'PORTFOLIO', label: 'My Portfolio & Allocation', icon: BriefcaseBusiness },
            { id: 'NEWS', label: 'Catalysts & News', icon: Newspaper },
            { id: 'LEADERBOARD', label: 'Live Leaderboard', icon: Trophy },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Overview (Default) */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6 min-w-0">
          <NewsEventBanner sessionId={resolvedSessionId} />
          <Watchlist
            simulationStatus={simStatus}
            onOpenStockChart={handleOpenStock}
          />

          <Portfolio onOpenChart={handleOpenStock} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 min-h-0">
              <NewsFeed onSelectTicker={(ticker) => {
                // If ticker clicked in news, find and open that stock
              }} />
            </div>
            <div className="lg:col-span-1 min-h-0">
              <Transactions />
            </div>
            <div className="lg:col-span-1 min-h-0">
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 min-h-0 order-2 lg:order-1">
            <NewsFeed />
          </div>
          <div className="lg:col-span-3 min-h-0 order-1 lg:order-2">
            <Watchlist
              simulationStatus={simStatus}
              onOpenStockChart={handleOpenStock}
            />
          </div>
        </div>
      )}

      {/* Tab: Leaderboard */}
      {activeTab === 'LEADERBOARD' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 min-h-0">
            <Leaderboard />
          </div>
          <div className="lg:col-span-1 min-h-0">
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
