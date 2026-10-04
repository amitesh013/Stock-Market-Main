/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import Login from './pages/Login';
import JoinSession from './pages/JoinSession';
import AdminPanel from './pages/AdminPanel';
import Dashboard from './pages/Dashboard';
import MarketTrading from './pages/MarketTrading';
import PortfolioPage from './pages/Portfolio';
import NewsEvents from './pages/NewsEvents';
import TransactionsPage from './pages/Transactions';
import LeaderboardPage from './pages/Leaderboard';
import Placements from './pages/Placements';
import SimulationEngine from './components/SimulationEngine';
import SimulationHeader from './components/SimulationHeader';
import TickerTape from './components/TickerTape';
import StockChartModal from './components/StockChartModal';
import WinnerPodiumModal from './components/WinnerPodiumModal';
import AppHeader from './components/layout/AppHeader';
import LiveTicker from './components/layout/LiveTicker';
import Sidebar from './components/layout/Sidebar';
import PageBackdrop from './components/layout/PageBackdrop';
import { SessionProvider, useSession } from './lib/SessionContext';
import { SessionDataProvider, useSession as useParticipantSession } from './lib/session';
import { LayoutContext } from './lib/layoutContext';

function FullScreenStatus({ text }: { text: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#06090B]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#3B82FF] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-[#A4AFB4]">{text}</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, roleRequired }: { children: React.ReactNode; roleRequired?: 'admin' | 'participant' }) {
  const { user, userData, loading } = useAuth();

  if (loading) return <FullScreenStatus text="Connecting to trading engine..." />;

  if (!user || !userData) return <Navigate to="/login" replace />;
  if (roleRequired && userData.role !== roleRequired && userData.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

/** Admin layout (light theme). */
function MainLayout({ children }: { children: React.ReactNode }) {
  const { sessionStatus } = useSession();
  const [selectedStockForChart, setSelectedStockForChart] = useState<any | null>(null);
  const [showPodium, setShowPodium] = useState(false);
  const [prevStatus, setPrevStatus] = useState<string>('LOBBY');

  // Watch for session ending to auto-open podium
  useEffect(() => {
    if (sessionStatus === 'ENDED' && prevStatus !== 'ENDED') {
      setShowPodium(true);
    }
    setPrevStatus(sessionStatus);
  }, [sessionStatus, prevStatus]);

  // Simulate config shape expected by SimulationHeader
  const simConfig = { status: sessionStatus };

  return (
    <div className="min-h-screen bg-zinc-100/70 text-zinc-900 font-sans flex flex-col">
      {/* Price tick engine — reads/writes session subcollections */}
      <SimulationEngine />

      {/* Stock prices */}
      <TickerTape onSelectStock={(stock) => setSelectedStockForChart(stock)} />

      {/* Main Header */}
      <SimulationHeader
        simulationConfig={simConfig}
        onOpenPodium={() => setShowPodium(true)}
      />

      {/* Page Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {children}
      </main>

      {/* Interactive Stock Chart & Terminal Modal */}
      {selectedStockForChart && (
        <StockChartModal
          stock={selectedStockForChart}
          simulationStatus={sessionStatus}
          onClose={() => setSelectedStockForChart(null)}
        />
      )}

      {/* End-of-Simulation Winner Ceremony Modal */}
      {showPodium && (
        <WinnerPodiumModal onClose={() => setShowPodium(false)} />
      )}
    </div>
  );
}

/** Participant guard: no session or an ended session goes back to /join; admins without a session go to /admin. */
function ParticipantSessionGuard({ children }: { children: React.ReactNode }) {
  const { userData } = useAuth();
  const { sessionId, sessionResolved, sessionStatus } = useSession();

  if (!sessionResolved) return <FullScreenStatus text="Loading session..." />;
  if (!sessionId) return <Navigate to={userData?.role === 'admin' ? '/admin' : '/join'} replace />;
  if (sessionStatus === 'ENDED') return <Navigate to="/join" replace />;

  return <>{children}</>;
}

function ParticipantLayout() {
  const { sessionId } = useSession();
  return (
    <SessionDataProvider>
      {/* Keyed by session: switching sessions unmounts every page, hook and listener of the previous one. */}
      <SessionLayout key={sessionId ?? 'no-session'} />
    </SessionDataProvider>
  );
}

/** Participant layout (dark theme): header, sidebar navigation and nested pages. */
function SessionLayout() {
  const { phase, config: simConfig, sessionStatus } = useParticipantSession();
  const { sessionStatus: rawStatus } = useSession();
  const [selectedStockForChart, setSelectedStockForChart] = useState<any | null>(null);
  const [showPodium, setShowPodium] = useState(false);
  const prevStatus = useRef<string>('NOT_STARTED');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (sessionStatus === 'COMPLETED' && prevStatus.current !== 'COMPLETED') setShowPodium(true);
    prevStatus.current = sessionStatus;
  }, [sessionStatus]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const layoutContext: LayoutContext = { openStockChart: setSelectedStockForChart };

  if (phase === 'loading') return <FullScreenStatus text="Loading session..." />;

  return (
    <div className="min-h-screen bg-[#06090B] text-[#F3F5F4] font-sans flex flex-col pb-8">
      <SimulationEngine />
      <LiveTicker onSelectStock={(stock) => setSelectedStockForChart(stock)} />

      <AppHeader
        simulationConfig={simConfig}
        onOpenPodium={() => setShowPodium(true)}
        onOpenMenu={() => setMenuOpen(true)}
      />

      <PageBackdrop />

      <div className="relative z-[1] w-full flex-1 flex">
        <Sidebar mobileOpen={menuOpen} onClose={closeMenu} />
        <main className="flex-1 min-w-0 relative isolate max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet context={layoutContext} />
        </main>
      </div>

      {/* Interactive Stock Chart & Terminal Modal */}
      {selectedStockForChart && (
        <StockChartModal
          stock={selectedStockForChart}
          simulationStatus={rawStatus}
          onClose={() => setSelectedStockForChart(null)}
        />
      )}

      {/* End-of-Simulation Winner Ceremony Modal */}
      {showPodium && (
        <WinnerPodiumModal onClose={() => setShowPodium(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Join flow — no session context yet */}
          <Route
            path="/join"
            element={
              <ProtectedRoute>
                <JoinSession />
              </ProtectedRoute>
            }
          />

          {/* Admin panel — session context still available for session-aware components */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roleRequired="admin">
                <SessionProvider>
                  <MainLayout>
                    <AdminPanel />
                  </MainLayout>
                </SessionProvider>
              </ProtectedRoute>
            }
          />

          {/* Participants are bound to users/{uid}.currentSessionId, so session URLs land on the dashboard. */}
          <Route path="/session/:sessionId" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />

          {/* Session-scoped participant pages */}
          <Route
            element={
              <ProtectedRoute>
                <AdminRedirect>
                  <SessionProvider>
                    <ParticipantSessionGuard>
                      <ParticipantLayout />
                    </ParticipantSessionGuard>
                  </SessionProvider>
                </AdminRedirect>
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="market" element={<MarketTrading />} />
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="news" element={<NewsEvents />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="placements" element={<Placements />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

/** Admins land on /admin unless they have joined a session as a player. */
function AdminRedirect({ children }: { children: React.ReactNode }) {
  const { userData } = useAuth();
  if (userData?.role === 'admin' && !userData.currentSessionId) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
