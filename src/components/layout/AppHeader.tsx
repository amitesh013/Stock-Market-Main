import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { Clock, LogOut, Activity, Award, Megaphone, Menu, BarChart2, Repeat } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useMarketState, formatCountdown } from '../../lib/marketState';
import { useMyStanding } from '../../lib/leaderboard';
import { useSession, useParticipantBalance } from '../../lib/session';

interface AppHeaderProps {
  simulationConfig: any;
  onOpenPodium?: () => void;
  onOpenMenu?: () => void;
}

export default function AppHeader({ simulationConfig, onOpenPodium, onOpenMenu }: AppHeaderProps) {
  const { userData, signOut } = useAuth();
  const navigate = useNavigate();
  const { activeEvent, status: marketStatus } = useMarketState();
  const { rank, total } = useMyStanding();
  const [nowMs, setNowMs] = useState(Date.now());
  const [timeLeftStr, setTimeLeftStr] = useState<string | null>(null);

  useEffect(() => {
    if (!activeEvent) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeEvent?.eventId]);

  const isRunning = marketStatus === 'RUNNING';
  const isPaused = marketStatus === 'PAUSED';
  const isCompleted = marketStatus === 'COMPLETED';

  // Overall simulation end time, if the admin configured one.
  useEffect(() => {
    if (!isRunning || !simulationConfig?.endTime?.toMillis) {
      setTimeLeftStr(null);
      return;
    }
    const interval = setInterval(() => {
      const diff = simulationConfig.endTime.toMillis() - Date.now();
      setTimeLeftStr(formatCountdown(Math.max(0, diff)));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, simulationConfig?.endTime]);

  const { portfolioValue: portfolioVal, startingBalance: startingBal } = useParticipantBalance();
  const { sessionCode, sessionName, sessionId, leave } = useSession();

  const switchSession = async () => {
    if (!window.confirm('Leave this session and join another? Your progress in this session is kept.')) return;
    try {
      await leave();
    } finally {
      navigate('/join', { replace: true });
    }
  };
  const totalPnl = portfolioVal - startingBal;
  const totalPct = startingBal > 0 ? (totalPnl / startingBal) * 100 : 0;
  const isPositive = totalPnl >= 0;
  const initial = (userData?.name || 'T').trim().charAt(0).toUpperCase();

  const status = isRunning
    ? { label: 'Live', dot: '#00D9FF' }
    : isPaused
    ? { label: 'Paused', dot: '#D5A653' }
    : marketStatus === 'NOT_STARTED'
    ? { label: 'Pre-Market', dot: '#3B82FF' }
    : { label: 'Closed', dot: '#D9364A' };

  return (
    <header className="bg-[#06090B]/95 backdrop-blur border-b border-[#26343C] sticky top-0 z-40">
      <div aria-hidden="true" className="hdr-line absolute left-0 right-0 -bottom-px h-px" />
      <div className="px-4 sm:px-6 lg:pl-4 lg:pr-8">
        <div className="flex justify-between items-center h-14 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onOpenMenu}
              aria-label="Open navigation"
              className="lg:hidden w-9 h-9 -ml-1 flex items-center justify-center rounded-lg text-[#A4AFB4] hover:bg-[#111A20] hover:text-[#F3F5F4] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link to="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50 lg:w-52 shrink-0">
              <Activity className="w-6 h-6 text-[#3B82FF]" strokeWidth={1.75} />
              <div className="hidden sm:block">
                <span className="text-[15px] font-semibold text-[#F3F5F4] tracking-tight block leading-none">FinQuest</span>
                <span className="text-[9px] text-[#65737A] font-semibold tracking-[0.2em] uppercase">Live Trading Floor</span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-2">
              {sessionId && (
                <span
                  title={sessionName || undefined}
                  className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] border border-[#3B82FF]/40 rounded-sm flex items-center gap-2"
                >
                  <span className="text-[#65737A]">Session</span>
                  <span className="text-[#F3F5F4] tabular-nums">{sessionCode || '—'}</span>
                </span>
              )}
              {isCompleted ? (
                <button
                  onClick={onOpenPodium}
                  className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#3B82FF] border border-[#3B82FF]/40 hover:bg-[#3B82FF]/10 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5" />
                  Competition Complete
                </button>
              ) : (
                <span className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#F3F5F4] border border-[#26343C] rounded-sm flex items-center gap-2">
                  <span className="text-[#65737A]">Market</span>
                  <span
                    className={`relative w-1.5 h-1.5 rounded-full ${isRunning ? 'live-ping' : ''}`}
                    style={{ backgroundColor: status.dot, boxShadow: `0 0 8px ${status.dot}`, color: status.dot }}
                  />
                  {status.label}
                </span>
              )}

              {isRunning && activeEvent && (
                <span
                  title={activeEvent.headline}
                  className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md border ${
                    activeEvent.sentiment === 'POSITIVE' ? 'text-[#20C978] border-[#20C978]/40' : 'text-[#FF4D5A] border-[#FF4D5A]/40'
                  }`}
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  Live Event
                  <span className="tabular-nums">{formatCountdown(activeEvent.expiresAtMs - nowMs)}</span>
                </span>
              )}

              {timeLeftStr && (
                <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md border border-[#26343C] text-[#A4AFB4]">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="tabular-nums">{timeLeftStr}</span> left
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {rank && (
              <Link to="/leaderboard" className="hidden sm:block text-right pr-4 border-r border-[#26343C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50 rounded-sm">
                <div className="text-[9px] text-[#65737A] font-semibold uppercase tracking-[0.16em]">Rank</div>
                <div className="text-sm font-semibold tabular-nums leading-tight text-[#3B82FF]">
                  #{rank}<span className="text-[11px] text-[#65737A] font-medium"> / {total}</span>
                </div>
              </Link>
            )}
            <div className="hidden sm:block text-right">
              <div className="text-[9px] text-[#65737A] font-semibold uppercase tracking-[0.16em]">Net Worth</div>
              <div className="text-sm font-semibold text-[#F3F5F4] tabular-nums leading-tight">
                ${portfolioVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="ml-1.5 text-[11px] font-semibold" style={{ color: isPositive ? '#20C978' : '#FF4D5A' }}>
                  {isPositive ? '+' : ''}{totalPct.toFixed(2)}%
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/market')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-semibold text-white bg-[#3B82FF] hover:bg-[#2563EB] transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06090B]"
            >
              <BarChart2 className="w-4 h-4" />
              <span>Trade</span>
            </button>

            <div
              className="w-8 h-8 rounded-full border border-[#26343C] bg-[#111A20] flex items-center justify-center text-[13px] font-semibold text-[#F3F5F4]"
              title={userData?.name || 'Trader'}
            >
              {initial}
            </div>

            {sessionId && (
              <button
                onClick={switchSession}
                title="Join another session"
                aria-label="Join another session"
                className="w-8 h-8 flex items-center justify-center text-[#65737A] hover:text-[#F3F5F4] hover:bg-[#111A20] rounded-lg transition-colors cursor-pointer"
              >
                <Repeat className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => signOut()}
              title="Sign Out"
              aria-label="Sign out"
              className="w-8 h-8 flex items-center justify-center text-[#65737A] hover:text-[#F3F5F4] hover:bg-[#111A20] rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
