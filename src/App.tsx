/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import Login from './pages/Login';
import ParticipantDashboard from './pages/ParticipantDashboard';
import AdminPanel from './pages/AdminPanel';
import SimulationEngine from './components/SimulationEngine';
import SimulationHeader from './components/SimulationHeader';
import TickerTape from './components/TickerTape';
import StockChartModal from './components/StockChartModal';
import WinnerPodiumModal from './components/WinnerPodiumModal';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

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
  const [simConfig, setSimConfig] = useState<any>({});
  const [selectedStockForChart, setSelectedStockForChart] = useState<any | null>(null);
  const [showPodium, setShowPodium] = useState(false);
  const [prevStatus, setPrevStatus] = useState<string>('NOT_STARTED');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'simulation', 'config'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSimConfig(data);

        // If newly transitioned to COMPLETED, open podium automatically
        if (data.status === 'COMPLETED' && prevStatus !== 'COMPLETED') {
          setShowPodium(true);
        }
        setPrevStatus(data.status || 'NOT_STARTED');
      }
    });
    return unsub;
  }, [prevStatus]);

  return (
    <div className="min-h-screen bg-zinc-100/70 text-zinc-900 font-sans flex flex-col">
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
          simulationStatus={simConfig.status || 'NOT_STARTED'}
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
          <Route 
            path="/" 
            element={
              <ProtectedRoute roleRequired="participant">
                <MainLayout>
                  <ParticipantDashboard />
                </MainLayout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute roleRequired="admin">
                <MainLayout>
                  <AdminPanel />
                </MainLayout>
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
