import React from 'react';
import { useAuth } from '../components/AuthProvider';
import { useMarketState } from '../lib/marketState';
import { usePositionSummary, useMyTransactions } from '../lib/liveData';
import { useLeaderboardUsers } from '../lib/leaderboard';
import { useLayout } from '../lib/layoutContext';
import MarketStatusHero from '../components/dashboard/MarketStatusHero';
import PositionSummary from '../components/dashboard/PositionSummary';
import ActiveEventCard from '../components/dashboard/ActiveEventCard';
import CompetitionSnapshot from '../components/dashboard/CompetitionSnapshot';
import MarketMoversStrip from '../components/dashboard/MarketMoversStrip';
import RecentActivity from '../components/dashboard/RecentActivity';

export default function Dashboard() {
  const { user } = useAuth();
  const market = useMarketState();
  const position = usePositionSummary();
  const transactions = useMyTransactions();
  const ranked = useLeaderboardUsers().filter((u) => u.role !== 'admin');
  const { openStockChart } = useLayout();

  return (
    <div className="flex flex-col gap-6">
      <MarketStatusHero market={market} stocks={position.stocks} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 order-2 min-w-0">
          <CompetitionSnapshot ranked={ranked} myId={user?.uid} />
        </div>
        <div className="lg:col-span-5 order-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6 min-w-0">
          <PositionSummary
            netWorth={position.netWorth}
            cash={position.cash}
            invested={position.invested}
            pnl={position.pnl}
            returnPct={position.returnPct}
          />
          <ActiveEventCard market={market} stocks={position.stocks} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 border-t border-[#26343C] pt-6">
        <div className="lg:col-span-7 min-w-0">
          <MarketMoversStrip stocks={position.stocks} onOpenStock={openStockChart} />
        </div>
        <div className="lg:col-span-5 min-w-0">
          <RecentActivity transactions={transactions} />
        </div>
      </div>
    </div>
  );
}
