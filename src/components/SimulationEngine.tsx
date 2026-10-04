import React, { useEffect, useRef } from 'react';
import { collection, doc, onSnapshot, getDocs, updateDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { purgeAllCrypto, seedDefaultStocks, syncLiveMarketPrices, createSessionMarket } from '../lib/stockData';

// M2: optional sessionId. Without it the engine runs on the global collections exactly as before.
export default function SimulationEngine({ sessionId }: { sessionId?: string } = {}) {
  const { user } = useAuth();
  const simDoc = (name: string) =>
    sessionId ? doc(db, 'sessions', sessionId, 'simulation', name) : doc(db, 'simulation', name);
  const engineRef = useRef<any>(null);
  const isUpdatingRef = useRef(false);
  const configRef = useRef<any>(null);
  const initializedCryptoPurge = useRef(false);

  // 1. One-time startup crypto purge & ensure authentic floor stocks exist
  useEffect(() => {
    if (!user || initializedCryptoPurge.current) return;
    initializedCryptoPurge.current = true;

    async function ensureMarketReady() {
      try {
        if (sessionId) {
          // Session mode: this session gets its own market; nothing global is touched.
          await createSessionMarket(sessionId);
          return;
        }
        await purgeAllCrypto();
        const stocksSnap = await getDocs(collection(db, 'stocks'));
        if (stocksSnap.empty) {
          console.log('Seeding authentic equities and fetching initial real-time market quotes...');
          await seedDefaultStocks();
        }

        // Trigger immediate live quote synchronization from real exchanges
        await syncLiveMarketPrices(sessionId).catch(err => console.warn('Initial live sync notice:', err.message));

        // Ensure config document is set up for Real-Time Exchange Mode
        const configDoc = await getDoc(simDoc('config'));
        if (!configDoc.exists() || !configDoc.data()?.status || configDoc.data()?.status === 'NOT_STARTED') {
          await setDoc(simDoc('config'), {
            status: 'RUNNING',
            isRealMarketFeed: true,
            feedStatus: 'LIVE_EXCHANGE_CONNECTED',
            marketSource: 'NYSE / NASDAQ Direct Feed',
            priceUpdateIntervalSeconds: 10,
            startingBalanceAmount: 100000,
            startedAt: serverTimestamp(),
            lastLiveSync: serverTimestamp(),
          }, { merge: true });
        }
      } catch (err) {
        console.error('Market initialization error:', err);
      }
    }

    ensureMarketReady();
  }, [user, sessionId]);

  // 2. Active Real-Time Market Feed Sync Loop
  useEffect(() => {
    if (!user) {
      if (engineRef.current) clearInterval(engineRef.current);
      engineRef.current = null;
      return;
    }

    const unsubSim = onSnapshot(simDoc('config'), (docSnap) => {
      const config = docSnap.data();
      configRef.current = config;
      const isRunning = config?.status === 'RUNNING';
      // Sync cadence: defaults to 10s for real-time exchange feeds
      const intervalSec = Math.max(5, config?.priceUpdateIntervalSeconds || 10);

      if (isRunning) {
        if (engineRef.current) {
          clearInterval(engineRef.current);
        }
        // Poll and sync real market prices
        engineRef.current = setInterval(() => {
          syncMarketPrices();
        }, intervalSec * 1000);
      } else {
        if (engineRef.current) {
          clearInterval(engineRef.current);
          engineRef.current = null;
        }
      }
    });

    return () => {
      unsubSim();
      if (engineRef.current) {
        clearInterval(engineRef.current);
        engineRef.current = null;
      }
    };
  }, [user?.uid, sessionId]);

  const syncMarketPrices = async () => {
    if (isUpdatingRef.current || !user) return;

    try {
      const now = Date.now();
      const config = configRef.current;
      const intervalSec = Math.max(5, config?.priceUpdateIntervalSeconds || 10);
      const minIntervalMs = intervalSec * 1000 - 500;

      // Heartbeat distributed leader lock so multi-tabs don't duplicate requests
      const heartbeatRef = simDoc('heartbeat');
      const hbSnap = await getDoc(heartbeatRef);
      const lastTick = hbSnap.exists() ? (hbSnap.data()?.lastTick || 0) : 0;

      if (now - lastTick < minIntervalMs) {
        return;
      }

      isUpdatingRef.current = true;

      // Claim heartbeat turn
      await setDoc(heartbeatRef, {
        lastTick: now,
        leaderUid: user.uid,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Check if simulation timer has expired
      if (config?.endTime?.toMillis && now >= config.endTime.toMillis() && config.status === 'RUNNING') {
        await updateDoc(simDoc('config'), {
          status: 'COMPLETED',
          completedAt: serverTimestamp(),
        });
        if (engineRef.current) {
          clearInterval(engineRef.current);
          engineRef.current = null;
        }
        isUpdatingRef.current = false;
        return;
      }

      // Fetch real-time market quotes and sync them directly to Firestore
      await syncLiveMarketPrices(sessionId);
    } catch (err) {
      console.warn('Real-Time Market Sync Notice:', err);
    } finally {
      isUpdatingRef.current = false;
    }
  };

  return null;
}
