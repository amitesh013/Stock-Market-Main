import React, { useEffect, useRef } from 'react';
import {
  collection, doc, onSnapshot, getDocs,
  updateDoc, setDoc, getDoc, serverTimestamp, query, where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { COLLECTIONS, SIMULATION_DOCS } from '../lib/shared-types';

export default function SimulationEngine() {
  const { user } = useAuth();
  const engineRef = useRef<any>(null);
  const isUpdatingRef = useRef(false);
  const configRef = useRef<any>(null);
  const initializedRef = useRef(false);

  // 1. One-time startup — only seed stocks if needed
  useEffect(() => {
    if (!user || initializedRef.current) return;
    initializedRef.current = true;

    async function ensureMarketReady() {
      try {
        const stocksSnap = await getDocs(collection(db, COLLECTIONS.STOCKS));
        if (stocksSnap.empty) {
          console.log('No stocks found. Please seed stocks from Admin Panel.');
        }

        // Only set config if it doesn't exist yet
        const configDoc = await getDoc(doc(db, COLLECTIONS.SIMULATION, SIMULATION_DOCS.CONFIG));
        if (!configDoc.exists()) {
          await setDoc(doc(db, COLLECTIONS.SIMULATION, SIMULATION_DOCS.CONFIG), {
            status: 'NOT_STARTED',
            priceUpdateIntervalSeconds: 5,
            startingBalanceAmount: 100000,
            activeNewsEventId: null,
          });
        }
      } catch (err) {
        console.error('Market initialization error:', err);
      }
    }

    ensureMarketReady();
  }, [user]);

  // 2. Price tick loop — ONLY runs when simulation is RUNNING
  useEffect(() => {
    if (!user) {
      if (engineRef.current) clearInterval(engineRef.current);
      engineRef.current = null;
      return;
    }

    const unsubSim = onSnapshot(
      doc(db, COLLECTIONS.SIMULATION, SIMULATION_DOCS.CONFIG),
      (docSnap) => {
        const config = docSnap.data();
        configRef.current = config;
        const isRunning = config?.status === 'RUNNING';
        const intervalSec = Math.max(5, config?.priceUpdateIntervalSeconds || 5);

        if (isRunning) {
          // Clear old interval and start fresh if interval changed
          if (engineRef.current) clearInterval(engineRef.current);
          engineRef.current = setInterval(() => {
            tickPrices();
          }, intervalSec * 1000);
        } else {
          // ✅ Simulation stopped/paused — kill the interval
          // Price history stops being written the moment status != RUNNING
          if (engineRef.current) {
            clearInterval(engineRef.current);
            engineRef.current = null;
          }
        }
      }
    );

    return () => {
      unsubSim();
      if (engineRef.current) {
        clearInterval(engineRef.current);
        engineRef.current = null;
      }
    };
  }, [user?.uid]);

  const tickPrices = async () => {
    if (isUpdatingRef.current || !user) return;

    try {
      const now = Date.now();
      const config = configRef.current;

      // Double-check simulation is still RUNNING before writing anything
      if (config?.status !== 'RUNNING') return;

      // Heartbeat leader lock — only one tab writes at a time
      const heartbeatRef = doc(db, COLLECTIONS.SIMULATION, SIMULATION_DOCS.HEARTBEAT);
      const hbSnap = await getDoc(heartbeatRef);
      const lastTick = hbSnap.exists() ? (hbSnap.data()?.lastTick || 0) : 0;
      const intervalSec = Math.max(5, config?.priceUpdateIntervalSeconds || 5);

      if (now - lastTick < (intervalSec * 1000 - 500)) return;

      isUpdatingRef.current = true;

      // Claim heartbeat
      await setDoc(heartbeatRef, {
        lastTick: now,
        leaderUid: user.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Simulation timer auto-expire removed.
      // Admin manually ends the simulation via "End & Finalize" button.

      // Check if active news event has expired
      if (config?.activeNewsEventId && config?.activeNewsEventExpiresAt) {
        const expiresAt = config.activeNewsEventExpiresAt?.toMillis?.();
        if (expiresAt && now >= expiresAt) {
          // News effect expired — clear it, price stays where it is
          await updateDoc(doc(db, COLLECTIONS.SIMULATION, SIMULATION_DOCS.CONFIG), {
            activeNewsEventId: null,
            activeNewsEventExpiresAt: null,
          });
          await setDoc(
            doc(db, COLLECTIONS.SIMULATION, SIMULATION_DOCS.ACTIVE_EVENT),
            { isExpired: true },
            { merge: true }
          );
          console.log('News event expired — normal market resumed.');
        }
      }

      // Get all active stocks
      const stocksSnap = await getDocs(
        query(collection(db, COLLECTIONS.STOCKS), where('isActive', '==', true))
      );

      if (stocksSnap.empty) return;

      const batch = writeBatch(db);

      for (const stockDoc of stocksSnap.docs) {
        const stock = stockDoc.data();
        const currentPrice: number = stock.currentPrice || 100;
        const volatility: number = stock.volatility || 0.015;

        // --- Normal Market: small random walk ---
        const randomChange = (Math.random() - 0.5) * 2 * volatility;
        let newPrice = currentPrice * (1 + randomChange);

        // --- News Event Mode: add extra impact on top ---
        if (config?.activeNewsEventId) {
          const activeEventSnap = await getDoc(
            doc(db, COLLECTIONS.SIMULATION, SIMULATION_DOCS.ACTIVE_EVENT)
          );
          if (activeEventSnap.exists() && !activeEventSnap.data()?.isExpired) {
            const activeEvent = activeEventSnap.data();
            const affectedStocks: { ticker: string; strength: string }[] =
              activeEvent.affectedStocks || [];

            const impact = affectedStocks.find(
              (s) => s.ticker === stock.ticker
            );

            if (impact) {
              const impactMap: Record<string, number> = {
                STRONG_UP:     +0.012,
                MODERATE_UP:   +0.007,
                SLIGHT_UP:     +0.003,
                NO_IMPACT:      0.000,
                SLIGHT_DOWN:   -0.003,
                MODERATE_DOWN: -0.007,
                SHARP_DOWN:    -0.013,
              };
              const newsMultiplier = impactMap[impact.strength] ?? 0;
              newPrice = newPrice * (1 + newsMultiplier);
            }
          }
        }

        // Floor: price never goes below $1
        newPrice = Math.max(1, Math.round(newPrice * 100) / 100);

        const change = Math.round((newPrice - stock.dayOpenPrice) * 100) / 100;
        const changePercent =
          Math.round(((newPrice - stock.dayOpenPrice) / stock.dayOpenPrice) * 10000) / 100;

        // Update stock price
        batch.update(stockDoc.ref, {
          currentPrice: newPrice,
          change,
          changePercent,
          lastUpdated: serverTimestamp(),
        });

        // ✅ Write price history ONLY while simulation is RUNNING
        // (this block is already inside the RUNNING guard above,
        //  but we double-check here for safety)
        if (config?.status === 'RUNNING') {
          const historyRef = doc(collection(db, COLLECTIONS.PRICE_HISTORY));
          batch.set(historyRef, {
            stockId: stockDoc.id,
            ticker: stock.ticker,
            price: newPrice,
            timestamp: serverTimestamp(),
            activeNewsEventId: config?.activeNewsEventId || null,
          });
        }
      }

      await batch.commit();
      // Price history is kept in full while the simulation is RUNNING — no deletion.
      // Writes automatically stop the moment status leaves RUNNING (see guard above).
    } catch (err) {
      console.warn('Price tick error:', err);
    } finally {
      isUpdatingRef.current = false;
    }
  };

  return null;
}
