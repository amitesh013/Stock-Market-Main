import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  LogOut, 
  LayoutDashboard, 
  Sliders, 
  Activity, 
  Zap, 
  Award 
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../lib/SessionContext';
import { calculatePortfolioMetrics, subscribeToLivePortfolio } from '../lib/portfolio';

interface SimulationHeaderProps {
  simulationConfig: any;
  onOpenPodium?: () => void;
}

export default function SimulationHeader({ simulationConfig, onOpenPodium }: SimulationHeaderProps) {
  const { user, userData, signOut } = useAuth();
  const { sessionId } = useSession();
  const location = useLocation();
  const status = simulationConfig?.status || 'NOT_STARTED';
  const isRunning = status === 'RUNNING';
  const isCompleted = status === 'COMPLETED';

  const isAdmin = userData?.role === 'admin';
  const tradePath = isAdmin && sessionId ? `/session/${sessionId}` : '/';
  const [liveMetrics, setLiveMetrics] = useState(() => calculatePortfolioMetrics(
    userData ? { currentCash: userData.currentCash, startingCash: userData.startingBalance } : undefined,
    [],
    {},
  ));

  useEffect(() => {
    if (!user || !sessionId || isAdmin) {
      setLiveMetrics(calculatePortfolioMetrics(
        userData ? { currentCash: userData.currentCash, startingCash: userData.startingBalance } : undefined,
        [],
        {},
      ));
      return;
    }
    return subscribeToLivePortfolio(sessionId, user.uid, (state) => {
      setLiveMetrics(calculatePortfolioMetrics(state.portfolio, state.holdings, state.stocks));
    }, (error) => console.error('Header portfolio subscription error:', error));
  }, [isAdmin, sessionId, user, userData?.currentCash, userData?.startingBalance]);

  const currentCash = liveMetrics.cashBalance;
  const portfolioVal = liveMetrics.portfolioValue;
  const totalPnl = liveMetrics.pnl;
  const isPositive = totalPnl >= 0;

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 sm:h-16 sm:flex-nowrap sm:py-0">
          {/* Logo & Status */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link to="/" className="flex min-w-0 shrink items-center gap-2 group">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs transition-transform group-hover:scale-105">
                <Activity className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-base font-extrabold text-zinc-900 tracking-tight block leading-none">
                  FinQuest
                </span>
                <span className="block text-[9px] text-zinc-400 font-semibold tracking-wider uppercase sm:text-[10px]">
                  Stock Market Simulator
                </span>
              </div>
            </Link>

            {/* Simulation Status Tag */}
            <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-zinc-200">
              {isRunning ? (
                <span className="px-2.5 py-1 text-xs font-bold bg-green-50 text-green-700 border border-green-200/80 rounded-full flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Market Active
                </span>
              ) : isCompleted ? (
                <button
                  onClick={onOpenPodium}
                  className="px-2.5 py-1 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  Simulation Finished • View Standings
                </button>
              ) : (
                <span className="px-2.5 py-1 text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200 rounded-full">
                  Market Closed
                </span>
              )}

              {/* Real-Time Exchange Badge */}
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full shadow-2xs">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                Live Exchange: NYSE / NASDAQ
              </span>

              <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 rounded-md">
                Virtual Cash Sim
              </span>
            </div>
          </div>



          {/* User Portfolio Snapshot & Nav */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
            {/* Quick Balance Preview */}
            <div className="hidden md:block text-right pr-2">
              <div className="text-[11px] text-zinc-500 font-medium">Net Worth</div>
              <div className="text-sm font-extrabold text-zinc-900 flex items-center gap-1 justify-end">
                <span>${portfolioVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className={`text-[10px] font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  ({isPositive ? '+' : ''}${totalPnl.toFixed(0)})
                </span>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-1.5 rounded-xl bg-zinc-100 p-1">
              <Link
                to={tradePath}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  location.pathname.startsWith('/session/') || (!isAdmin && location.pathname === '/')
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Trade</span>
              </Link>

              {isAdmin && (
                <Link
                  to="/admin"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    location.pathname === '/admin' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-purple-600" />
                  <span>Admin</span>
                </Link>
              )}
            </div>

            {/* Logout */}
            <button
              onClick={() => signOut()}
              title="Sign Out"
              className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
