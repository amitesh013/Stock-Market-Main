import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { Trophy, Award, TrendingUp, CheckCircle, Download, X } from 'lucide-react';

interface WinnerPodiumModalProps {
  onClose: () => void;
}

export default function WinnerPodiumModal({ onClose }: WinnerPodiumModalProps) {
  const { user } = useAuth();
  const [rankedUsers, setRankedUsers] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => {
        const val = d.data();
        const start = Number(val.startingBalance || 100000);
        const portVal = Number(val.portfolioValue ?? val.currentCash ?? 100000);
        const pnl = portVal - start;
        const returnPct = start > 0 ? (pnl / start) * 100 : 0;
        return {
          id: d.id,
          ...val,
          portfolioValue: portVal,
          startingBalance: start,
          pnl,
          returnPct
        };
      });

      list.sort((a, b) => b.portfolioValue - a.portfolioValue);
      setRankedUsers(list);
    });

    return unsub;
  }, []);

  const firstPlace = rankedUsers[0];
  const secondPlace = rankedUsers[1];
  const thirdPlace = rankedUsers[2];

  const myIndex = rankedUsers.findIndex(u => u.id === user?.uid);
  const myData = myIndex >= 0 ? rankedUsers[myIndex] : null;

  const handleExportResults = () => {
    let csv = 'Final Rank,Trader Name,Email,Role,Starting Balance,Final Portfolio Value,Total P&L ($),Return (%)\n';
    rankedUsers.forEach((u, i) => {
      csv += `${i + 1},"${u.name || ''}","${u.email || ''}","${u.role || 'participant'}",${u.startingBalance},${u.portfolioValue.toFixed(2)},${u.pnl.toFixed(2)},${u.returnPct.toFixed(2)}%\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `final-simulation-standings-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-zinc-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/30 shadow-inner">
            <Trophy className="w-9 h-9 text-white drop-shadow-md" />
          </div>
          <h2 className="text-2xl font-black tracking-tight drop-shadow-sm">
            Simulation Completed!
          </h2>
          <p className="text-amber-100 text-xs font-medium mt-1">
            Trading is officially closed. Final portfolio valuations and rankings are locked.
          </p>
        </div>

        {/* Podium Section (Top 3) */}
        <div className="p-6 bg-zinc-50 border-b border-zinc-200">
          <div className="text-center mb-4">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Podium Champions
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 items-end max-w-lg mx-auto">
            {/* 2nd Place */}
            <div className="text-center space-y-1">
              {secondPlace ? (
                <>
                  <div className="w-10 h-10 bg-zinc-200 text-zinc-700 rounded-full flex items-center justify-center mx-auto text-sm font-bold border-2 border-white shadow-sm">
                    🥈
                  </div>
                  <div className="font-bold text-xs text-zinc-800 truncate">{secondPlace.name}</div>
                  <div className="text-[11px] font-semibold text-zinc-600">
                    ${secondPlace.portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className={`text-[10px] font-bold ${secondPlace.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {secondPlace.pnl >= 0 ? '+' : ''}{secondPlace.returnPct.toFixed(1)}%
                  </div>
                </>
              ) : (
                <div className="h-16 text-zinc-300 text-xs flex items-center justify-center">-</div>
              )}
              <div className="h-16 bg-zinc-200 rounded-t-xl flex items-center justify-center font-bold text-zinc-500 text-sm">
                2nd
              </div>
            </div>

            {/* 1st Place Champion */}
            <div className="text-center space-y-1">
              {firstPlace ? (
                <>
                  <div className="w-12 h-12 bg-amber-400 text-white rounded-full flex items-center justify-center mx-auto text-base font-bold border-2 border-white shadow-md">
                    🥇
                  </div>
                  <div className="font-black text-sm text-zinc-900 truncate">{firstPlace.name}</div>
                  <div className="text-xs font-extrabold text-amber-600">
                    ${firstPlace.portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className={`text-[11px] font-bold ${firstPlace.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {firstPlace.pnl >= 0 ? '+' : ''}{firstPlace.returnPct.toFixed(1)}%
                  </div>
                </>
              ) : (
                <div className="h-24 text-zinc-300 text-xs flex items-center justify-center">-</div>
              )}
              <div className="h-24 bg-gradient-to-t from-amber-400 to-amber-300 rounded-t-xl flex items-center justify-center font-extrabold text-amber-900 text-base shadow-xs">
                1st
              </div>
            </div>

            {/* 3rd Place */}
            <div className="text-center space-y-1">
              {thirdPlace ? (
                <>
                  <div className="w-10 h-10 bg-amber-700/30 text-amber-900 rounded-full flex items-center justify-center mx-auto text-sm font-bold border-2 border-white shadow-sm">
                    🥉
                  </div>
                  <div className="font-bold text-xs text-zinc-800 truncate">{thirdPlace.name}</div>
                  <div className="text-[11px] font-semibold text-zinc-600">
                    ${thirdPlace.portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className={`text-[10px] font-bold ${thirdPlace.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {thirdPlace.pnl >= 0 ? '+' : ''}{thirdPlace.returnPct.toFixed(1)}%
                  </div>
                </>
              ) : (
                <div className="h-12 text-zinc-300 text-xs flex items-center justify-center">-</div>
              )}
              <div className="h-12 bg-amber-100 rounded-t-xl flex items-center justify-center font-bold text-amber-800 text-xs">
                3rd
              </div>
            </div>
          </div>
        </div>

        {/* User's Personal Scorecard */}
        {myData && (
          <div className="p-5 border-b border-zinc-200">
            <div className="flex items-center justify-between p-4 bg-blue-50/70 border border-blue-200 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-xs">
                  #{myIndex + 1}
                </div>
                <div>
                  <div className="text-xs text-blue-700 font-semibold uppercase tracking-wider">Your Final Standing</div>
                  <div className="font-bold text-base text-zinc-900">{myData.name}</div>
                  <div className="text-xs text-zinc-500">
                    Rank {myIndex + 1} of {rankedUsers.length} total participants
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-zinc-500">Final Portfolio</div>
                <div className="text-xl font-bold text-zinc-900">
                  ${myData.portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className={`text-xs font-bold ${myData.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {myData.pnl >= 0 ? '+' : ''}${myData.pnl.toFixed(2)} ({myData.pnl >= 0 ? '+' : ''}{myData.returnPct.toFixed(2)}%)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-5 bg-zinc-50 flex items-center justify-between">
          <button
            onClick={handleExportResults}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            Download Standings (CSV)
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-colors shadow-2xs"
          >
            Review Standings
          </button>
        </div>
      </div>
    </div>
  );
}
