/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import Login from './pages/Login';
import ParticipantDashboard from './pages/ParticipantDashboard';
import JoinSession from './pages/JoinSession';
import AdminPanel from './pages/AdminPanel';
import SimulationEngine from './components/SimulationEngine';
import SimulationHeader from './components/SimulationHeader';
import TickerTape from './components/TickerTape';
import StockChartModal from './components/StockChartModal';
import WinnerPodiumModal from './components/WinnerPodiumModal';
import { SessionProvider, useSession } from './lib/SessionContext';

function ProtectedRoute({ children, roleRequired }: { children: React.ReactNode; roleRequired?: 'admin' | 'participant' }) {
  const { user, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-zinc-500">Connecting to trading engine...</p>
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

function MainLayout({ children }: { children: React.ReactNode }) {
  const { sessionId, sessionStatus } = useSession();
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

      {/* Ticker Tape */}
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

// Session-aware dashboard wrapper: wraps a route inside SessionProvider
function SessionDashboard({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ParticipantSessionGuard>
        <MainLayout>{children}</MainLayout>
      </ParticipantSessionGuard>
    </SessionProvider>
  );
}

function ParticipantSessionGuard({ children }: { children: React.ReactNode }) {
  const { sessionId, sessionResolved, sessionStatus } = useSession();
  const { sessionId: routeSessionId } = useParams<{ sessionId: string }>();

  if (sessionResolved && (!sessionId || sessionStatus === 'ENDED')) {
    return <Navigate to="/join" replace />;
  }
  if (sessionResolved && sessionId && routeSessionId !== sessionId) {
    return <Navigate to={`/session/${sessionId}`} replace />;
  }

  return <>{children}</>;
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

          {/* Session-scoped participant dashboard */}
          <Route
            path="/session/:sessionId"
            element={
              <ProtectedRoute roleRequired="participant">
                <SessionDashboard>
                  <ParticipantDashboard />
                </SessionDashboard>
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

          {/* Root: participants land here, redirected to join or their session */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RootRedirect />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

/** Redirect root visitors: admin → /admin, participant with session → /session/:id, else → /join */
function RootRedirect() {
  const { userData } = useAuth();

  if (!userData) return null;

  if (userData.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  const currentSessionId = (userData as any).currentSessionId;
  if (currentSessionId) {
    return <Navigate to={`/session/${currentSessionId}`} replace />;
  }

  return <Navigate to="/join" replace />;
}
