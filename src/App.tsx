/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MarketTrading from './pages/MarketTrading';
import PortfolioPage from './pages/Portfolio';
import NewsEvents from './pages/NewsEvents';
import TransactionsPage from './pages/Transactions';
import LeaderboardPage from './pages/Leaderboard';
import Placements from './pages/Placements';
import AdminPanel from './pages/AdminPanel';
import SimulationEngine from './components/SimulationEngine';
import SimulationHeader from './components/SimulationHeader';
import TickerTape from './components/TickerTape';
import StockChartModal from './components/StockChartModal';
import WinnerPodiumModal from './components/WinnerPodiumModal';
import Sidebar from './components/layout/Sidebar';
import PageBackdrop from './components/layout/PageBackdrop';
import JoinSession from './pages/JoinSession';
import { LayoutContext } from './lib/layoutContext';
import { ParticipantSessionProvider, useSession } from './lib/session';

function ProtectedRoute({ children, roleRequired }: { children: React.ReactNode; roleRequired?: 'admin' | 'participant' }) {
  const { user, userData, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#06090B]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#3B82FF] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-[#A4AFB4]">Connecting to trading engine...</p>
        </div>
      </div>
    );
  }
  
  if (!user || !userData) return <Navigate to="/login" replace />;
  if (roleRequired && userData.role !== roleRequired && userData.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

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

/** Session guard: participant pages render only for a validated session; admins may open /admin without one. */
function MainLayout() {
  const { phase, sessionId } = useSession();
  const { pathname } = useLocation();
  const isAdminRoute = pathname.startsWith('/admin');

  if (phase === 'loading') return <FullScreenStatus text="Loading session..." />;
  if (phase === 'none' && !isAdminRoute) return <Navigate to="/join" replace />;
  // Keyed by session: switching sessions unmounts every page, hook and listener of the previous one.
  return <SessionLayout key={sessionId ?? 'no-session'} />;
}

function SessionLayout() {
  const { config: simConfig, sessionStatus } = useSession();
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

  return (
    <div className="min-h-screen bg-[#06090B] text-[#F3F5F4] font-sans flex flex-col pb-8">
      <SimulationEngine />
      <TickerTape onSelectStock={(stock) => setSelectedStockForChart(stock)} />

      <SimulationHeader
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

export default function App() {
  return (
    <AuthProvider>
      <ParticipantSessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/join"
            element={
              <ProtectedRoute>
                <JoinSession />
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route
            element={
              <ProtectedRoute roleRequired="participant">
                <MainLayout />
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
            <Route
              path="admin"
              element={
                <ProtectedRoute roleRequired="admin">
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ParticipantSessionProvider>
    </AuthProvider>
  );
}
