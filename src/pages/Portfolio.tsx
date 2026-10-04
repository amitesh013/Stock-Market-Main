import React, { useMemo, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useMarketState } from '../lib/marketState';
import { useMyTransactions } from '../lib/liveData';
import { useLeaderboardUsers } from '../lib/leaderboard';
import { usePortfolio, usePerformanceHistory, useAnimatedNumber } from '../lib/portfolio';
import { formatUSD, T } from '../components/dashboard/ui';
import { categoryOf } from '../components/market/marketUtils';
import PortfolioHero from '../components/portfolio/PortfolioHero';
import PerformanceChart from '../components/portfolio/PerformanceChart';
import AllocationPanel, { AllocationSlice, CATEGORY_COLORS } from '../components/portfolio/AllocationPanel';
import Contributors from '../components/portfolio/Contributors';
import CompetitionMini from '../components/portfolio/CompetitionMini';
import HoldingsTable from '../components/portfolio/HoldingsTable';
import RecentTrades from '../components/portfolio/RecentTrades';

const tsMillis = (v: any): number | undefined =>
  v?.toMillis ? v.toMillis() : typeof v?.seconds === 'number' ? v.seconds * 1000 : undefined;

export default function Portfolio() {
  const { user } = useAuth();
  const market = useMarketState();
  const portfolio = usePortfolio();
  const transactions = useMyTransactions();
  const ranked = useLeaderboardUsers().filter((u) => u.role !== 'admin');
  const [category, setCategory] = useState<string | null>(null);

  const { points, markers } = usePerformanceHistory(
    transactions,
    portfolio.startingBalance,
    portfolio.totalValue,
    tsMillis(market.config?.startedAt),
  );

  const categoryFor = (stock: any) => categoryOf(stock) ?? 'Other';

  const slices: AllocationSlice[] = useMemo(() => {
    const totals = new Map<string, number>();
    portfolio.holdings.forEach((h) => {
      const c = categoryFor(h.stock);
      totals.set(c, (totals.get(c) || 0) + h.currentValue);
    });
    const sum = portfolio.invested || 1;
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value, pct: (value / sum) * 100, color: CATEGORY_COLORS[name] || CATEGORY_COLORS.Other }))
      .sort((a, b) => b.value - a.value);
  }, [portfolio.holdings, portfolio.invested]);

  const visibleHoldings = category ? portfolio.holdings.filter((h) => categoryFor(h.stock) === category) : portfolio.holdings;

  const myIndex = ranked.findIndex((u) => u.id === user?.uid);
  const headerValue = useAnimatedNumber(portfolio.totalValue);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#F3F5F4]">My Portfolio</h1>
          <p className="text-[13px] text-[#A4AFB4] mt-0.5">Track your capital, holdings and performance.</p>
        </div>
        <dl className="flex items-stretch gap-5">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]">Current Rank</dt>
            <dd className="text-lg font-semibold tabular-nums" style={{ color: T.user }}>
              {myIndex >= 0 ? `#${String(myIndex + 1).padStart(2, '0')}` : '—'}
              <span className="text-sm font-normal text-[#65737A]"> / {ranked.length}</span>
            </dd>
          </div>
          <div className="w-px bg-[#26343C]" />
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]">Portfolio Value</dt>
            <dd className="text-lg font-semibold tabular-nums text-[#F3F5F4]">{formatUSD(headerValue)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="order-1 lg:order-none lg:col-span-4">
          <PortfolioHero
            totalValue={portfolio.totalValue}
            totalPnl={portfolio.totalPnl}
            totalPnlPercent={portfolio.totalPnlPercent}
            startingBalance={portfolio.startingBalance}
            invested={portfolio.invested}
            cash={portfolio.cash}
          />
        </div>
        <div className="order-2 lg:order-none lg:col-span-8 min-h-[320px]">
          <PerformanceChart
            points={points}
            markers={markers}
            startingBalance={portfolio.startingBalance}
            eventStart={market.status === 'RUNNING' ? market.activeEvent?.triggeredAtMs ?? null : null}
          />
        </div>

        <div className="order-3 lg:order-none lg:col-span-5">
          <AllocationPanel slices={slices} active={category} onSelect={setCategory} />
        </div>
        <div className="order-5 lg:order-none lg:col-span-3">
          <Contributors holdings={portfolio.holdings} />
        </div>
        <div className="order-6 lg:order-none lg:col-span-4">
          <CompetitionMini ranked={ranked} myId={user?.uid} myValue={portfolio.totalValue} />
        </div>

        <div className="order-4 lg:order-none lg:col-span-12">
          <HoldingsTable
            holdings={visibleHoldings}
            totalValue={portfolio.totalValue}
            filter={category}
            onClearFilter={() => setCategory(null)}
          />
        </div>

        <div className="order-7 lg:order-none lg:col-span-12">
          <RecentTrades transactions={transactions} />
        </div>
      </div>
    </div>
  );
}
