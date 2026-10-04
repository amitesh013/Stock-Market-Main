import React, { useEffect, useRef } from 'react';
import {
  collection, doc, onSnapshot, getDocs,
  updateDoc, setDoc, getDoc, serverTimestamp, query, where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { useSession } from '../lib/SessionContext';
import {
  COLLECTIONS,
  SESSION_SUBCOLLECTIONS,
  SESSION_META_DOCS,
  SIMULATION_DOCS,
} from '../lib/shared-types';

export default function SimulationEngine() {
  const { user } = useAuth();
  const { sessionId } = useSession();
  const engineRef = useRef<any>(null);
  const isUpdatingRef = useRef(false);
  const configRef = useRef<any>(null);

  // Price tick loop — runs only when a session is RUNNING
  useEffect(() => {
    if (!user || !sessionId) {
      if (engineRef.current) clearInterval(engineRef.current);
      engineRef.current = null;
      return;
    }

    // Watch the session doc for status + config
    const unsubSession = onSnapshot(
      doc(db, COLLECTIONS.SESSIONS, sessionId),
      (docSnap) => {
        const config = docSnap.data();
        configRef.current = config;
        const isRunning = config?.status === 'RUNNING';
        const intervalSec = Math.max(5, config?.priceUpdateIntervalSeconds || 30);

        if (isRunning) {
          if (engineRef.current) clearInterval(engineRef.current);
          engineRef.current = setInterval(() => tickPrices(), intervalSec * 1000);
        } else {
          if (engineRef.current) {
            clearInterval(engineRef.current);
            engineRef.current = null;
          }
        }
      }
    );

    return () => {
      unsubSession();
      if (engineRef.current) {
        clearInterval(engineRef.current);
        engineRef.current = null;
      }
    };
  }, [user?.uid, sessionId]);

  const tickPrices = async () => {
    if (isUpdatingRef.current || !user || !sessionId) return;

    try {
      const now = Date.now();
      const config = configRef.current;
      if (config?.status !== 'RUNNING') return;

      // Heartbeat leader lock — only one browser tab writes at a time
      const heartbeatRef = doc(db, COLLECTIONS.SESSIONS, sessionId, 'meta', 'heartbeat');
      const hbSnap = await getDoc(heartbeatRef);
      const lastTick = hbSnap.exists() ? (hbSnap.data()?.lastTick || 0) : 0;
      const intervalSec = Math.max(5, config?.priceUpdateIntervalSeconds || 30);
      if (now - lastTick < (intervalSec * 1000 - 500)) return;

      isUpdatingRef.current = true;

      await setDoc(heartbeatRef, {
        lastTick: now,
        leaderUid: user.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Check if active news event has expired
      if (config?.activeNewsEventId && config?.activeNewsEventExpiresAt) {
        const expiresAt = config.activeNewsEventExpiresAt?.toMillis?.();
        if (expiresAt && now >= expiresAt) {
          await updateDoc(doc(db, COLLECTIONS.SESSIONS, sessionId), {
            activeNewsEventId: null,
            activeNewsEventExpiresAt: null,
          });
          await setDoc(
            doc(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.META, SESSION_META_DOCS.ACTIVE_EVENT),
            { isExpired: true },
            { merge: true }
          );
        }
      }

      // Fetch active event details if one is running
      let activeEvent: any = null;
      if (config?.activeNewsEventId) {
        const eventSnap = await getDoc(
          doc(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.META, SESSION_META_DOCS.ACTIVE_EVENT)
        );
        if (eventSnap.exists() && !eventSnap.data()?.isExpired) {
          activeEvent = eventSnap.data();
        }
      }

      // Get all active stocks in this session
      const stocksSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.STOCKS),
          where('isActive', '==', true)
        )
      );

      if (stocksSnap.empty) return;

      const batch = writeBatch(db);

      for (const stockDoc of stocksSnap.docs) {
        const stock = stockDoc.data();
        const currentPrice: number = stock.currentPrice || 100;
        const volatility: number = stock.volatility || 0.015;

        // Normal random walk
        const randomChange = (Math.random() - 0.5) * 2 * volatility;
        let newPrice = currentPrice * (1 + randomChange);

        // News event overlay
        if (activeEvent) {
          const impactMap: Record<string, number> = {
            STRONG_UP:     +0.012,
            MODERATE_UP:   +0.007,
            SLIGHT_UP:     +0.003,
            NO_IMPACT:      0.000,
            SLIGHT_DOWN:   -0.003,
            MODERATE_DOWN: -0.007,
            SHARP_DOWN:    -0.013,
          };
          const impact = (activeEvent.affectedStocks || []).find(
            (s: any) => s.ticker === stock.ticker
          );
          if (impact) {
            newPrice = newPrice * (1 + (impactMap[impact.strength] ?? 0));
          }
        }

        newPrice = Math.max(1, Math.round(newPrice * 100) / 100);
        const change = Math.round((newPrice - stock.dayOpenPrice) * 100) / 100;
        const changePercent = Math.round(((newPrice - stock.dayOpenPrice) / stock.dayOpenPrice) * 10000) / 100;

        batch.update(stockDoc.ref, {
          currentPrice: newPrice,
          change,
          changePercent,
          lastUpdated: serverTimestamp(),
        });

        // Write price history into session subcollection
        const historyRef = doc(
          collection(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.PRICE_HISTORY)
        );
        batch.set(historyRef, {
          stockId: stockDoc.id,
          ticker: stock.ticker,
          price: newPrice,
          timestamp: serverTimestamp(),
          sessionId,
          activeNewsEventId: config?.activeNewsEventId || null,
        });
      }

      await batch.commit();
    } catch (err) {
      console.warn('Price tick error:', err);
    } finally {
      isUpdatingRef.current = false;
    }
  };

  return null;
}
