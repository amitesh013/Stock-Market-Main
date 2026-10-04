import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { useSession } from '../lib/SessionContext';
import { COLLECTIONS, SESSION_SUBCOLLECTIONS } from '../lib/shared-types';
import { Trophy, Search, TrendingUp, TrendingDown, Users } from 'lucide-react';

export default function Leaderboard() {
  const { user } = useAuth();
  const { sessionId } = useSession();
  const [users, setUsers] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'participants'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!sessionId) { setUsers([]); return; }
    const unsub = onSnapshot(
      collection(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.PORTFOLIOS),
      (snap) => {
        const data = snap.docs.map(d => {
          const val = d.data();
          const start = Number(val.startingCash || 100000);
          const portVal = Number(val.portfolioValue ?? val.currentCash ?? start);
          const pnl = portVal - start;
          const returnPct = start > 0 ? (pnl / start) * 100 : 0;
          return {
            id: d.id,
            ...val,
            name: val.displayName || val.name || 'Trader',
            portfolioValue: portVal,
            startingBalance: start,
            pnl,
            returnPct,
            role: val.role || 'participant',
          };
        });
        data.sort((a, b) => b.portfolioValue - a.portfolioValue);
        setUsers(data);
      },
      (err) => console.error('Leaderboard fetch error:', err)
    );
    return unsub;
  }, [sessionId]);

  const filteredUsers = users.filter(u => {
    if (filterMode === 'participants' && u.role === 'admin') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    }
    return true;
  });

  const top3 = users.slice(0, 3);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col h-full max-h-[520px] min-h-0">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 bg-zinc-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-yellow-50 text-yellow-600 flex items-center justify-center">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-sm">Live Leaderboard</h3>
            <span className="text-[11px] text-zinc-500">Rankings updated automatically by portfolio valuation</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="flex bg-zinc-200/80 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterMode === 'all' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode('participants')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterMode === 'participants' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Participants
            </button>
          </div>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      {top3.length > 0 && (
        <div className="p-3 bg-zinc-50/50 border-b border-zinc-100 grid grid-cols-3 gap-2 text-center">
          {top3.map((u, i) => {
            const medals = ['🥇 1st', '🥈 2nd', '🥉 3rd'];
            const bgGradients = [
              'bg-amber-50 border-amber-200/80 text-amber-900',
              'bg-slate-50 border-slate-200/80 text-slate-800',
              'bg-orange-50 border-orange-200/80 text-orange-900'
            ];
            return (
              <div key={u.id} className={`p-2 rounded-xl border ${bgGradients[i]} flex flex-col items-center justify-between`}>
                <span className="text-[11px] font-black uppercase tracking-wider">{medals[i]}</span>
                <span className="font-bold text-xs truncate max-w-full my-0.5 text-zinc-900">{u.name || 'Trader'}</span>
                <span className="text-[11px] font-extrabold text-zinc-800">
                  ${u.portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className={`text-[10px] font-bold ${u.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {u.pnl >= 0 ? '+' : ''}{u.returnPct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Search bar */}
      <div className="p-2.5 border-b border-zinc-100 bg-white">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search participant name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-400"
          />
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[11px] uppercase font-semibold text-zinc-500 bg-zinc-50/80 border-b border-zinc-100 sticky top-0">
            <tr>
              <th className="px-3.5 py-2">Rank</th>
              <th className="px-3.5 py-2">Trader</th>
              <th className="px-3.5 py-2 text-right">Net Worth</th>
              <th className="px-3.5 py-2 text-right">Return %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredUsers.map((u, i) => {
              const isPositive = u.pnl >= 0;
              const isMe = user?.uid === u.id;

              return (
                <tr key={u.id} className={`transition-colors ${isMe ? 'bg-blue-50/60 font-medium' : 'hover:bg-zinc-50/70'}`}>
                  <td className="px-3.5 py-2.5 font-bold text-xs">
                    {i === 0 ? '🥇 1' : i === 1 ? '🥈 2' : i === 2 ? '🥉 3' : `#${i + 1}`}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-900 text-xs font-semibold">{u.name || 'Trader'}</span>
                      {isMe && (
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded-full">
                          You
                        </span>
                      )}
                      {u.role === 'admin' && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 font-medium px-1.5 py-0.2 rounded-md">
                          Admin
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-bold text-zinc-900 text-xs">
                    ${u.portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-3.5 py-2.5 text-right text-xs font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : ''}{u.returnPct.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-zinc-400">
                  <Users className="w-6 h-6 mx-auto mb-1 text-zinc-300" />
                  <p className="text-xs font-medium text-zinc-600">No matching participants</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
