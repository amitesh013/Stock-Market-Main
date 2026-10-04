import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, BarChart2, Briefcase, Newspaper, ArrowLeftRight, Flag, Trophy, Sliders, X } from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { useMarketState } from '../../lib/marketState';
import { useMyStanding } from '../../lib/leaderboard';
import { useSession, useParticipantBalance } from '../../lib/session';
import { formatUSD, formatPct, toneColor } from '../dashboard/ui';
const GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/market', label: 'Market', icon: BarChart2 },
      { to: '/portfolio', label: 'Portfolio', icon: Briefcase },
    ],
  },
  {
    label: 'Competition',
    items: [
      { to: '/news', label: 'Events', icon: Newspaper },
      { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { to: '/leaderboard', label: 'Leaderboard', icon: Flag },
      { to: '/placements', label: 'Placements', icon: Trophy },
    ],
  },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { userData } = useAuth();
  const { activeEvent, status } = useMarketState();
  const groups = userData?.role === 'admin'
    ? [...GROUPS, { label: 'Organiser', items: [{ to: '/admin', label: 'Admin', icon: Sliders }] }]
    : GROUPS;

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#65737A]">{group.label}</div>
          <div className="flex flex-col">
            {group.items.map(({ to, label, icon: Icon, end }: any) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group relative overflow-hidden flex items-center gap-3 pl-3 pr-2 py-2 text-[13px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50 rounded-sm ${
                    isActive ? 'text-[#F3F5F4] font-semibold bg-[#3B82FF]/10' : 'text-[#A4AFB4] font-medium hover:text-[#F3F5F4]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1.5 bottom-1.5 w-px transition-colors duration-200"
                      style={{ backgroundColor: isActive ? '#3B82FF' : 'transparent', boxShadow: isActive ? '0 0 8px #3B82FF99' : 'none' }}
                    />
                    <Icon
                      strokeWidth={1.75}
                      className={`w-4 h-4 shrink-0 transition-colors duration-200 ${isActive ? 'text-[#3B82FF]' : 'text-[#65737A] group-hover:text-[#A4AFB4]'}`}
                    />
                    <span className="truncate">{label}</span>
                    {to === '/news' && activeEvent && (
                      <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.1em] text-[#00D9FF]">Live</span>
                    )}
                    {to === '/leaderboard' && status === 'RUNNING' && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00D9FF] shadow-[0_0_6px_#00D9FF]" aria-label="Live ranking" />
                    )}
                    {to === '/placements' && status === 'COMPLETED' && (
                      <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.1em] text-[#D5A653]">Final</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function YouBlock() {
  const { userData } = useAuth();
  const { rank, total, entry } = useMyStanding();
  const { sessionCode } = useSession();
  const balance = useParticipantBalance();
  const value = entry?.portfolioValue ?? balance.portfolioValue;
  const ret = entry?.returnPct ?? 0;

  return (
    <div className="border-t border-[#26343C] pt-4 px-3">
      {sessionCode && (
        <div className="mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em]">
          <span className="text-[#65737A]">Session</span>
          <span className="text-[#F3F5F4] tabular-nums tracking-[0.1em]">{sessionCode}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#3B82FF]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3B82FF]" aria-hidden="true" />
          You
        </span>
        <span className="text-[11px] tabular-nums text-[#65737A]">
          {rank ? <><span className="text-[#F3F5F4] font-semibold">#{rank}</span> / {total}</> : 'Unranked'}
        </span>
      </div>
      <div className="mt-1 text-[13px] text-[#A4AFB4] truncate">{userData?.name || 'Trader'}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-base font-semibold tabular-nums text-[#F3F5F4]">{formatUSD(value, 0)}</span>
        {entry && <span className="text-[11px] tabular-nums" style={{ color: toneColor(ret) }}>{formatPct(ret, 2)}</span>}
      </div>
    </div>
  );
}

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const location = useLocation();

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <>
      <aside className="hidden lg:block w-52 shrink-0">
        <div className="sticky top-14 h-[calc(100vh-5.5rem)] border-r border-[#26343C] bg-[#06090B]/90 overflow-hidden">
          <div className="relative h-full flex flex-col justify-between overflow-y-auto py-4 pr-2">
            <NavItems />
            <YouBlock />
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#06090B] border-r border-[#26343C] p-4 flex flex-col gap-5 overflow-hidden">
            <div className="relative flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A4AFB4]">StotraSim</span>
              <button
                onClick={onClose}
                aria-label="Close navigation"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#A4AFB4] hover:bg-[#111A20] hover:text-[#F3F5F4] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative"><NavItems onNavigate={onClose} /></div>
            <div className="relative mt-auto"><YouBlock /></div>
          </div>
        </div>
      )}
    </>
  );
}
