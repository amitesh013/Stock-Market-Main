import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Download, Flag } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { useMarketState, toMillis } from '../lib/marketState';
import { useMyTransactions, useStocks } from '../lib/liveData';
import { usePerformanceHistory } from '../lib/portfolio';
import { useFinalStandings, useTradeCounts, exportFinalStandingsCsv, useRevealSequence } from '../lib/finalResults';
import { ViewLink, T } from '../components/dashboard/ui';
import FinalRaceTrack from '../components/placements/FinalRaceTrack';
import FinalResultCard from '../components/placements/FinalResultCard';
import TopThree from '../components/placements/TopThree';
import FinalResultsTable from '../components/placements/FinalResultsTable';
import FinalJourney from '../components/placements/FinalJourney';
// Reveal order: title, finish marker, track line, positions, value count-up, results table.
const REVEAL_DELAYS = [0, 0, 0, 0, 0, 0];

const fade = (on: boolean): React.CSSProperties => ({ opacity: on ? 1 : 0 });

function StatusTag({ children, color = T.text2 }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded border border-[#26343C] text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>
      {children}
    </span>
  );
}

function InProgress() {
  return (
    <div className="rounded-md border border-[#26343C] bg-[#0D1419] px-6 py-14 text-center">
      <Flag className="w-6 h-6 mx-auto text-[#65737A]" aria-hidden="true" />
      <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3B82FF]">Competition In Progress</div>
      <h2 className="mt-2 text-lg font-semibold text-[#F3F5F4]">Final placements will appear once the simulation ends</h2>
      <p className="mt-1 text-sm text-[#A4AFB4] max-w-md mx-auto">
        Placements are decided by each participant's final portfolio value at the close.
      </p>
      <div className="mt-6 flex justify-center">
        <ViewLink to="/leaderboard">View Live Leaderboard</ViewLink>
      </div>
    </div>
  );
}

export default function Placements() {
  const { user } = useAuth();
  const market = useMarketState();
  const isComplete = market.status === 'COMPLETED';
  const standings = useFinalStandings(isComplete);
  const tradeCounts = useTradeCounts(isComplete);
  const transactions = useMyTransactions();
  const stocks = useStocks();
  const step = useRevealSequence(isComplete && standings.length > 0, REVEAL_DELAYS);

  const myIndex = standings.findIndex((u) => u.id === user?.uid);
  const me = myIndex >= 0 ? standings[myIndex] : null;
  const startedAt = toMillis(market.config?.startedAt) || undefined;
  const completedAt = toMillis(market.config?.completedAt) || 0;

  const history = usePerformanceHistory(transactions, me?.startingBalance ?? 0, me?.portfolioValue ?? 0, startedAt);
  const journey = useMemo(() => {
    if (!me || !transactions.length) return [];
    const end = completedAt || Date.now();
    const pts = history.points.filter((p) => p.t <= end);
    if (completedAt) pts.push({ t: completedAt, value: me.portfolioValue });
    return pts;
  }, [history.points, me, transactions.length, completedAt]);

  const summary = [
    { label: 'Participants', value: String(standings.length) },
    ...(stocks.length ? [{ label: 'Market Assets', value: String(stocks.filter((s) => s.isActive !== false).length) }] : []),
    ...(startedAt ? [{ label: 'Market Open', value: format(startedAt, 'MMM d, HH:mm') }] : []),
    ...(completedAt ? [{ label: 'Market Close', value: format(completedAt, 'MMM d, HH:mm') }] : []),
    ...(startedAt && completedAt > startedAt
      ? [{ label: 'Duration', value: `${Math.floor((completedAt - startedAt) / 3_600_000)}h ${Math.round(((completedAt - startedAt) % 3_600_000) / 60_000)}m` }]
      : []),
  ];

  return (
    <div className="space-y-5 min-w-0">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div style={isComplete ? fade(step >= 1) : undefined}>
          <h1 className="text-2xl sm:text-[28px] font-semibold tracking-[0.02em] text-[#F3F5F4]">FINAL PLACEMENTS</h1>
          <p className="text-sm text-[#A4AFB4] mt-1">{isComplete ? 'Simulation Complete' : 'Results are published when the market closes'}</p>
        </div>
        {isComplete && (
          <div className="flex flex-wrap items-center gap-2">
            <StatusTag>Market Closed</StatusTag>
            <StatusTag color={T.cyan}>Competition Complete</StatusTag>
            <StatusTag color={T.text}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: T.gold }} aria-hidden="true" /> Final Results
            </StatusTag>
            {standings.length > 0 && (
              <button
                type="button"
                onClick={() => exportFinalStandingsCsv(standings, tradeCounts)}
                className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded border border-[#26343C] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A4AFB4] hover:text-[#F3F5F4] hover:border-[#65737A] transition-colors"
              >
                <Download className="w-3 h-3" aria-hidden="true" /> Export CSV
              </button>
            )}
          </div>
        )}
      </header>

      {!isComplete ? (
        <InProgress />
      ) : !standings.length ? (
        <div className="rounded-md border border-[#26343C] bg-[#0D1419] px-6 py-12 text-center text-sm text-[#A4AFB4]">
          Loading final standings…
        </div>
      ) : (
        <>
          {step >= 1 && (
            <div className="text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-[#3B82FF]" style={fade(step >= 1)} aria-live="polite">
              Competition Complete
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-5 flex flex-col gap-5 min-w-0">
              {me ? (
                <FinalResultCard
                  me={me}
                  rank={myIndex + 1}
                  total={standings.length}
                  above={standings[myIndex - 1]}
                  below={standings[myIndex + 1]}
                  trades={tradeCounts ? tradeCounts[me.id] || 0 : null}
                  revealed={step >= 5}
                />
              ) : (
                <div className="rounded-md border border-[#26343C] bg-[#0D1419] p-5 text-sm text-[#A4AFB4]">
                  You were not ranked in this competition.
                </div>
              )}
              <div className="hidden lg:block" style={fade(step >= 4)}>
                <TopThree top={standings.slice(0, 3)} myId={user?.uid} />
              </div>
              {journey.length >= 3 && me && (
                <div className="hidden lg:block" style={fade(step >= 5)}>
                  <FinalJourney points={journey} startingBalance={me.startingBalance} />
                </div>
              )}
            </div>

            <div className="lg:col-span-7 min-w-0">
              <FinalRaceTrack standings={standings} myId={user?.uid} step={step} />
            </div>

            <div className="lg:hidden flex flex-col gap-5" style={fade(step >= 4)}>
              <TopThree top={standings.slice(0, 3)} myId={user?.uid} />
              {journey.length >= 3 && me && <FinalJourney points={journey} startingBalance={me.startingBalance} />}
            </div>
          </div>

          <div style={fade(step >= 6)} className="space-y-5">
            {summary.length > 1 && (
              <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 rounded-md border border-[#26343C] bg-[#0D1419] divide-[#26343C]">
                {summary.map((s) => (
                  <div key={s.label} className="px-5 py-3 min-w-0">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#65737A]">{s.label}</dt>
                    <dd className="mt-0.5 text-sm font-semibold tabular-nums text-[#F3F5F4] truncate">{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <FinalResultsTable standings={standings} myId={user?.uid} trades={tradeCounts} />
          </div>
        </>
      )}
    </div>
  );
}
