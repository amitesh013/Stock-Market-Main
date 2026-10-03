import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { Briefcase, ArrowRightLeft, PieChart as PieIcon, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import TradeModal from './TradeModal';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface PortfolioProps {
  onOpenChart?: (stock: any) => void;
}

const ALLOCATION_COLORS = [
  '#2563eb', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#64748b', // slate
];

export default function Portfolio({ onOpenChart }: PortfolioProps) {
  const { user, userData } = useAuth();
  const [holdings, setHoldings] = useState<any[]>([]);
  const [stocks, setStocks] = useState<Record<string, any>>({});
  const [tradeStock, setTradeStock] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    
    // Listen to user's holdings
    const qH = query(collection(db, 'holdings'), where('userId', '==', user.uid));
    const unsubH = onSnapshot(qH, (snap) => {
      setHoldings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to all active stocks to get current prices
    const unsubS = onSnapshot(collection(db, 'stocks'), (snap) => {
      const stockMap: Record<string, any> = {};
      snap.forEach(d => {
        stockMap[d.id] = { id: d.id, ...d.data() };
      });
      setStocks(stockMap);
    });

    return () => {
      unsubH();
      unsubS();
    };
  }, [user]);

  const cash = userData?.currentCash ?? 100000;
  let totalHoldingsValue = 0;

  const enrichedHoldings = holdings.map(h => {
    const stock = stocks[h.stockId];
    if (!stock) return null;
    
    const stockPrice = Number(stock.currentPrice) || 0;
    const currentValue = h.quantity * stockPrice;
    totalHoldingsValue += currentValue;
    const costBasis = h.quantity * (Number(h.averageBuyPrice) || 0);
    const pnl = currentValue - costBasis;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    const isPositive = pnl >= 0;

    return {
      ...h,
      stock,
      stockPrice,
      currentValue,
      costBasis,
      pnl,
      pnlPercent,
      isPositive
    };
  }).filter(Boolean);

  const totalPortfolioValue = Math.round((cash + totalHoldingsValue) * 100) / 100;
  const startingBalance = userData?.startingBalance || 100000;
  const totalPnl = totalPortfolioValue - startingBalance;
  const totalPnlPercent = startingBalance > 0 ? (totalPnl / startingBalance) * 100 : 0;
  const isTotalPositive = totalPnl >= 0;

  // Auto-sync portfolio value in Firestore if it drifts
  useEffect(() => {
    if (!user || !userData) return;
    const currentStoredVal = userData.portfolioValue || 0;
    if (Math.abs(currentStoredVal - totalPortfolioValue) > 0.05) {
      updateDoc(doc(db, 'users', user.uid), {
        portfolioValue: totalPortfolioValue
      }).catch(err => console.error('Portfolio value sync error:', err));
    }
  }, [user, userData?.portfolioValue, totalPortfolioValue]);

  // Data for Allocation Donut Chart
  const allocationData = [
    { name: 'Cash', value: Math.max(0, cash), color: '#94a3b8' },
    ...enrichedHoldings.map((h, i) => ({
      name: h.stock.ticker,
      value: Math.round(h.currentValue * 100) / 100,
      color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]
    }))
  ].filter(d => d.value > 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 bg-zinc-50/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-sm">My Portfolio & Asset Allocation</h3>
            <span className="text-[11px] text-zinc-500">Live position balances and valuation metrics</span>
          </div>
        </div>
        <div className="text-xs text-zinc-500 font-medium">
          Starting Cash: <span className="font-bold text-zinc-700">${startingBalance.toLocaleString()}</span>
        </div>
      </div>
      
      {/* Top Stat Metrics */}
      <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-4 border-b border-zinc-100 bg-white">
        <div className="bg-zinc-50/80 p-3.5 rounded-xl border border-zinc-200/80">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Total Net Worth</div>
          <div className="text-2xl font-extrabold text-zinc-900 tracking-tight">
            ${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-zinc-50/80 p-3.5 rounded-xl border border-zinc-200/80">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Available Cash</div>
          <div className="text-2xl font-extrabold text-zinc-900 tracking-tight">
            ${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-zinc-50/80 p-3.5 rounded-xl border border-zinc-200/80">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Holdings Value</div>
          <div className="text-2xl font-extrabold text-zinc-900 tracking-tight">
            ${totalHoldingsValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-zinc-50/80 p-3.5 rounded-xl border border-zinc-200/80">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Total Return (P&L)</div>
          <div className={`text-2xl font-extrabold flex items-baseline gap-1.5 ${isTotalPositive ? 'text-green-600' : 'text-red-600'}`}>
            <span>{isTotalPositive ? '+' : ''}${totalPnl.toFixed(2)}</span>
            <span className="text-xs font-bold">({isTotalPositive ? '+' : ''}{totalPnlPercent.toFixed(2)}%)</span>
          </div>
        </div>
      </div>

      {/* Allocation Donut Chart & Breakdown */}
      {enrichedHoldings.length > 0 && (
        <div className="p-5 border-b border-zinc-100 bg-zinc-50/40 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      const pct = totalPortfolioValue > 0 ? ((Number(data.value) / totalPortfolioValue) * 100).toFixed(1) : '0';
                      return (
                        <div className="bg-zinc-900 text-white px-3 py-1.5 rounded-lg shadow-lg text-xs">
                          <span className="font-bold">{data.name}:</span> ${Number(data.value).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({pct}%)
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={68}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">
              <PieIcon className="w-3.5 h-3.5 text-blue-600" />
              Capital Distribution
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allocationData.map((item) => {
                const pct = totalPortfolioValue > 0 ? ((item.value / totalPortfolioValue) * 100).toFixed(1) : '0';
                return (
                  <div key={item.name} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-zinc-200/80 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <div className="truncate">
                      <div className="font-bold text-zinc-900">{item.name}</div>
                      <div className="text-[11px] text-zinc-500 font-medium">{pct}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Holdings Table */}
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0 z-10 text-xs uppercase font-semibold text-zinc-500 bg-zinc-50 border-b border-zinc-100">
            <tr>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3 text-right">Shares</th>
              <th className="px-4 py-3 text-right">Avg Cost</th>
              <th className="px-4 py-3 text-right">Current Price</th>
              <th className="px-4 py-3 text-right">Market Value</th>
              <th className="px-4 py-3 text-right">Unrealized P&L</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {enrichedHoldings.map((h: any) => (
              <tr key={h.id} className="hover:bg-zinc-50/70 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenChart && onOpenChart(h.stock)}
                      className="font-bold text-zinc-900 hover:text-blue-600 transition-colors"
                    >
                      {h.stock.ticker}
                    </button>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-medium">
                      {h.stock.sector || 'Stock'}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">{h.stock.name}</div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-zinc-800">{h.quantity}</td>
                <td className="px-4 py-3 text-right text-zinc-600">${Number(h.averageBuyPrice || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-zinc-800 font-medium">${h.stockPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-bold text-zinc-900">${h.currentValue.toFixed(2)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${h.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {h.isPositive ? '+' : ''}${h.pnl.toFixed(2)} <span className="text-xs font-normal">({h.pnlPercent.toFixed(1)}%)</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => setTradeStock(h.stock)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      Trade
                    </button>
                    {onOpenChart && (
                      <button
                        onClick={() => onOpenChart(h.stock)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Chart
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {enrichedHoldings.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                  <div className="max-w-xs mx-auto space-y-1">
                    <p className="font-semibold text-zinc-700">No open positions</p>
                    <p className="text-xs text-zinc-400">Click on any asset from the Market Watchlist or Ticker Tape to place a Buy order.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {tradeStock && (
        <TradeModal
          stock={tradeStock}
          onClose={() => setTradeStock(null)}
        />
      )}
    </div>
  );
}
