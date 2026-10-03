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

interface SimulationHeaderProps {
  simulationConfig: any;
  onOpenPodium?: () => void;
}

export default function SimulationHeader({ simulationConfig, onOpenPodium }: SimulationHeaderProps) {
  const { userData, signOut } = useAuth();
  const location = useLocation();
  const status = simulationConfig?.status || 'NOT_STARTED';
  const isRunning = status === 'RUNNING';
  const isCompleted = status === 'COMPLETED';

  const isAdmin = userData?.role === 'admin';
  const currentCash = Number(userData?.currentCash || 0);
  const portfolioVal = Number(userData?.portfolioValue || currentCash);
  const startingBal = Number(userData?.startingBalance || 100000);
  const totalPnl = portfolioVal - startingBal;
  const isPositive = totalPnl >= 0;

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-4">
          {/* Logo & Status */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <span className="text-base font-extrabold text-zinc-900 tracking-tight block leading-none">
                  Stotra<span className="text-blue-600">Sim</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-semibold tracking-wider uppercase">
                  Live Trading Floor
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
          <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
              <Link
                to="/"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  location.pathname === '/' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
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
