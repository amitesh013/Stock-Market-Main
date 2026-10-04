import React, { useEffect, useState } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  writeBatch,
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Play,
  Pause,
  RotateCcw,
  Hash, 
  Download, 
  Plus, 
  Trash2, 
  Sparkles, 
  Sliders, 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Edit3,
  Radio,
  ChevronDown, 
  ChevronUp, 
  DollarSign,
  Award,
  RefreshCw,
  Zap,
  XCircle,
  Timer
} from 'lucide-react';
import { ALL_SCENARIOS, SCENARIO_MAP } from '../lib/scenarios';
import type { NewsEventId } from '../lib/shared-types';
import {
  COLLECTIONS, SESSION_SUBCOLLECTIONS, SESSION_META_DOCS, SIMULATION_DOCS,
  type Session, type SessionStatus
} from '../lib/shared-types';
import { createSession, seedSessionStocks } from '../lib/sessionManager';
import { useAuth } from '../components/AuthProvider';
import { 
  resetSimulationState,
  purgeAllCrypto,
} from '../lib/stockData';

export default function AdminPanel() {
  const [config, setConfig] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [allHoldings, setAllHoldings] = useState<any[]>([]);
  const [currentSessionPortfolios, setCurrentSessionPortfolios] = useState<any[]>([]);

  // Simulation Duration setup
  const [startingCashAmount, setStartingCashAmount] = useState<number>(100000);

  // New Stock Form
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [volatility, setVolatility] = useState('0.02');
  const [sector, setSector] = useState('Technology');

  // News Bulletin Form
  const [newsHeadline, setNewsHeadline] = useState('');
  const [newsSummary, setNewsSummary] = useState('');
  const [newsTicker, setNewsTicker] = useState('ALL');
  const [newsSentiment, setNewsSentiment] = useState<'BULLISH' | 'BEARISH'>('BULLISH');
  const [newsImpact, setNewsImpact] = useState('0.03');

  // Edit stock modal
  const [editingStock, setEditingStock] = useState<any | null>(null);
  const [editPrice, setEditPrice] = useState('');

  // Expand user details
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Session state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [newSessionName, setNewSessionName] = useState('FinQuest Round 1');
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [showCreateSessionForm, setShowCreateSessionForm] = useState(false);
  const { user } = useAuth();

  // News Event state
  const [activeNewsEvent, setActiveNewsEvent] = useState<any>(null);
  const [newsEventCountdown, setNewsEventCountdown] = useState<number>(0);
  const [isTriggeringEvent, setIsTriggeringEvent] = useState(false);



  useEffect(() => {
    const unsubSim = onSnapshot(doc(db, 'simulation', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        setConfig(docSnap.data());
      } else {
        setConfig({ status: 'NOT_STARTED', priceUpdateIntervalSeconds: 3, marketRegime: 'NORMAL' });
      }
    });
    
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.portfolioValue || 0) - (a.portfolioValue || 0));
      setUsers(list);
    });

    return () => { 
      unsubSim(); 
      unsubUsers(); 
    };
  }, []);

  // All market data shown and edited here belongs to the selected session.
  useEffect(() => {
    if (!activeSessionId) {
      setStocks([]);
      setNews([]);
      setAllHoldings([]);
      setCurrentSessionPortfolios([]);
      return;
    }

    const sessionPath = (subcollection: string) =>
      collection(db, COLLECTIONS.SESSIONS, activeSessionId, subcollection);
    const unsubStocks = onSnapshot(sessionPath(SESSION_SUBCOLLECTIONS.STOCKS), (snap) => {
      setStocks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubNews = onSnapshot(sessionPath(SESSION_SUBCOLLECTIONS.NEWS), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setNews(list);
    });
    const unsubHoldings = onSnapshot(sessionPath(SESSION_SUBCOLLECTIONS.HOLDINGS), (snap) => {
      setAllHoldings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPortfolios = onSnapshot(sessionPath(SESSION_SUBCOLLECTIONS.PORTFOLIOS), (snap) => {
      setCurrentSessionPortfolios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubStocks();
      unsubNews();
      unsubHoldings();
      unsubPortfolios();
    };
  }, [activeSessionId]);

  // Listen to all sessions
  useEffect(() => {
    const unsub = onSnapshot(collection(db, COLLECTIONS.SESSIONS), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Session));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setSessions(list);
      // Auto-select the latest non-ended session
      const live = list.find(s => s.status !== 'ENDED');
      if (live && !activeSessionId) {
        setActiveSessionId(live.id);
        setActiveSession(live);
      }
    });
    return unsub;
  }, []);

  // Listen to active session doc
  useEffect(() => {
    if (!activeSessionId) return;
    const unsub = onSnapshot(doc(db, COLLECTIONS.SESSIONS, activeSessionId), (snap) => {
      if (snap.exists()) setActiveSession({ id: snap.id, ...snap.data() } as Session);
    });
    return unsub;
  }, [activeSessionId]);

  useEffect(() => {
    if (user && activeSessionId) {
      void setDoc(doc(db, COLLECTIONS.USERS, user.uid), { currentSessionId: activeSessionId }, { merge: true });
    }
  }, [activeSessionId, user]);

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;
    setIsCreatingSession(true);
    try {
      const session = await createSession(newSessionName.trim(), startingCashAmount);
      await seedSessionStocks(session.id);
      setActiveSessionId(session.id);
      if (user) {
        await setDoc(doc(db, COLLECTIONS.USERS, user.uid), { currentSessionId: session.id }, { merge: true });
      }
      setShowCreateSessionForm(false);
      showNotification('success', `Session created! Code: ${session.sessionCode} — share this with participants.`);
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleStartSession = async () => {
    if (!activeSessionId) return;
    try {
      setActionLoading(true);
      if (activeSession?.status === 'LOBBY') {
        await seedSessionStocks(activeSessionId, true);
      } else if (activeSession?.status === 'PAUSED') {
        const eventRef = doc(db, COLLECTIONS.SESSIONS, activeSessionId, 'meta', SESSION_META_DOCS.ACTIVE_EVENT);
        const eventSnap = await getDoc(eventRef);
        const event = eventSnap.exists() ? eventSnap.data() : null;
        const pausedRemaining = Number(event?.pausedRemainingSeconds);
        if (event && !event.isExpired && Number.isFinite(pausedRemaining) && pausedRemaining >= 0) {
          const resumedExpiresAt = Timestamp.fromDate(new Date(Date.now() + pausedRemaining * 1000));
          await setDoc(eventRef, {
            expiresAt: resumedExpiresAt,
            pausedAt: null,
            pausedRemainingSeconds: null,
            isPaused: false,
          }, { merge: true });
          await setDoc(doc(db, COLLECTIONS.SESSIONS, activeSessionId), {
            activeNewsEventExpiresAt: resumedExpiresAt,
          }, { merge: true });
        }
      }
      await setDoc(doc(db, COLLECTIONS.SESSIONS, activeSessionId), {
        status: 'RUNNING',
      }, { merge: true });
      showNotification('success', activeSession?.status === 'PAUSED' ? 'Session resumed — market is live!' : 'Session started — market is live!');
    } catch (e: any) { showNotification('error', e.message); }
    finally { setActionLoading(false); }
  };

  const handlePauseSession = async () => {
    if (!activeSessionId) return;
    try {
      setActionLoading(true);
      const eventRef = doc(db, COLLECTIONS.SESSIONS, activeSessionId, 'meta', SESSION_META_DOCS.ACTIVE_EVENT);
      const eventSnap = await getDoc(eventRef);
      const event = eventSnap.exists() ? eventSnap.data() : null;
      const expiresAt = event?.expiresAt?.toMillis?.();
      const remainingSeconds = expiresAt
        ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
        : null;
      if (event && !event.isExpired) {
        await setDoc(eventRef, {
          isPaused: true,
          pausedAt: serverTimestamp(),
          pausedRemainingSeconds: remainingSeconds,
        }, { merge: true });
      }
      await setDoc(doc(db, COLLECTIONS.SESSIONS, activeSessionId), {
        status: 'PAUSED',
      }, { merge: true });
      showNotification('success', 'Session paused — all market state frozen.');
    } catch (e: any) { showNotification('error', e.message); }
    finally { setActionLoading(false); }
  };

  const handleEndSession = async () => {
    if (!activeSessionId) return;
    try {
      setActionLoading(true);
      await setDoc(doc(db, COLLECTIONS.SESSIONS, activeSessionId, 'meta', SESSION_META_DOCS.ACTIVE_EVENT), {
        isExpired: true,
      }, { merge: true });
      await setDoc(doc(db, COLLECTIONS.SESSIONS, activeSessionId), {
        status: 'ENDED',
        endedAt: serverTimestamp(),
        activeNewsEventId: null,
        activeNewsEventExpiresAt: null,
      }, { merge: true });
      showNotification('success', 'Session ended — final leaderboard is frozen.');
    } catch (e: any) { showNotification('error', e.message); }
    finally { setActionLoading(false); }
  };

  // Listen to activeEvent doc
  useEffect(() => {
    if (!activeSessionId) return;
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.SESSIONS, activeSessionId, 'meta', SESSION_META_DOCS.ACTIVE_EVENT),
      (snap) => setActiveNewsEvent(snap.exists() ? snap.data() : null)
    );
    return unsub;
  }, [activeSessionId]);

  // Countdown tick
  useEffect(() => {
    if (!activeNewsEvent || activeNewsEvent.isExpired) {
      setNewsEventCountdown(0);
      return;
    }
    const tick = () => {
      if (activeSession?.status === 'PAUSED' || activeNewsEvent.isPaused) {
        setNewsEventCountdown(Number(activeNewsEvent.pausedRemainingSeconds) || 0);
        return;
      }
      const expiresAt = activeNewsEvent.expiresAt?.toMillis?.();
      if (!expiresAt) return;
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setNewsEventCountdown(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeNewsEvent, activeSession?.status]);

  const handleTriggerNewsEvent = async (eventId: NewsEventId) => {
    const scenario = SCENARIO_MAP[eventId];
    if (!scenario) return;

    if (activeNewsEvent && !activeNewsEvent.isExpired) {
      showNotification('error', 'A news event is already active. End it first before triggering another.');
      return;
    }

    setIsTriggeringEvent(true);
    try {
      const now = Date.now();
      const expiresAt = new Date(now + scenario.durationSeconds * 1000);

      if (!activeSessionId) { showNotification('error', 'No active session.'); return; }
      await setDoc(doc(db, COLLECTIONS.SESSIONS, activeSessionId, 'meta', SESSION_META_DOCS.ACTIVE_EVENT), {
        eventId: scenario.id,
        headline: scenario.headline,
        description: scenario.description,
        type: scenario.type,
        durationSeconds: scenario.durationSeconds,
        affectedStocks: scenario.affectedStocks,
        triggeredAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        triggeredByAdminUid: '',
        isExpired: false,
      });

      await setDoc(doc(db, COLLECTIONS.SESSIONS, activeSessionId), {
        activeNewsEventId: scenario.id,
        activeNewsEventExpiresAt: Timestamp.fromDate(expiresAt),
      }, { merge: true });

      await addDoc(collection(db, COLLECTIONS.SESSIONS, activeSessionId, 'news'), {
        headline: scenario.headline,
        summary: scenario.description,
        ticker: 'ALL',
        sentiment: scenario.type === 'POSITIVE' ? 'BULLISH' : scenario.type === 'NEGATIVE' ? 'BEARISH' : 'NEUTRAL',
        impact: scenario.type === 'POSITIVE' ? 0.05 : -0.05,
        scenarioId: scenario.id,
        timestamp: serverTimestamp(),
      });

      showNotification('success', `Event triggered: "${scenario.headline.slice(0, 50)}..." — 15 min effect active.`);
    } catch (e: any) {
      showNotification('error', e.message || 'Failed to trigger event');
    } finally {
      setIsTriggeringEvent(false);
    }
  };

  const handleEndNewsEventEarly = async () => {
    try {
      if (!activeSessionId) return;
      await setDoc(doc(db, COLLECTIONS.SESSIONS, activeSessionId, 'meta', SESSION_META_DOCS.ACTIVE_EVENT), {
        isExpired: true,
      }, { merge: true });
      await setDoc(doc(db, COLLECTIONS.SESSIONS, activeSessionId), {
        activeNewsEventId: null,
        activeNewsEventExpiresAt: null,
      }, { merge: true });
      showNotification('success', 'News event ended early — normal market resumed.');
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const handleSeedFictionalStocks = async () => {
    try {
      setActionLoading(true);
      if (!activeSessionId) throw new Error('Create or select a session before seeding stocks.');
      const added = await seedSessionStocks(activeSessionId);
      showNotification('success', added > 0 ? `Seeded ${added} fictional stocks onto the market floor.` : 'All 8 fictional stocks already exist.');
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const showNotification = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  // Start Simulation with Countdown Timer
  // Handles THREE cases correctly:
  //   1. Fresh start (status NOT_STARTED / COMPLETED / undefined) → new full-duration timer
  //   2. Resume from pause (status PAUSED) → continues from remaining time, does NOT reset
  //   3. Already RUNNING → no-op guard (button should be disabled anyway)
  const handleStartSimulation = async () => {
    try {
      setActionLoading(true);
      const isResuming = config?.status === 'PAUSED';

      if (isResuming) {
        await setDoc(doc(db, 'simulation', 'config'), {
          status: 'RUNNING',
          endTime: null,
          remainingMs: null,
          pausedTime: null,
          resumedAt: serverTimestamp(),
        }, { merge: true });
        showNotification('success', 'Simulation resumed — market is live.');
      } else {
        await setDoc(doc(db, 'simulation', 'config'), {
          status: 'RUNNING',
          startTime: serverTimestamp(),
          endTime: null,
          remainingMs: null,
          pausedTime: null,
          startingBalanceAmount: config.startingBalanceAmount || startingCashAmount,
          priceUpdateIntervalSeconds: config.priceUpdateIntervalSeconds || 5,
          activeNewsEventId: null,
          activeNewsEventExpiresAt: null,
        }, { merge: true });
        showNotification('success', 'Simulation started — market is live. Trigger a news event when ready.');
      }
    } catch (e: any) {
      showNotification('error', e.message || 'Failed to start simulation');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseSimulation = async () => {
    try {
      setActionLoading(true);
      // Also expire any active news event when pausing
      await setDoc(doc(db, 'simulation', 'activeEvent'), {
        isExpired: true,
      }, { merge: true });
      await setDoc(doc(db, 'simulation', 'config'), {
        status: 'PAUSED',
        pausedTime: serverTimestamp(),
        activeNewsEventId: null,
        activeNewsEventExpiresAt: null,
      }, { merge: true });
      showNotification('success', 'Simulation paused — active news event cleared.');
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndSimulation = async () => {
    try {
      setActionLoading(true);
      await setDoc(doc(db, 'simulation', 'activeEvent'), {
        isExpired: true,
      }, { merge: true });
      await setDoc(doc(db, 'simulation', 'config'), {
        status: 'COMPLETED',
        completedAt: serverTimestamp(),
        activeNewsEventId: null,
        activeNewsEventExpiresAt: null,
      }, { merge: true });
      showNotification('success', 'Simulation ended — final leaderboard is now live.');
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetSimulation = async () => {
    try {
      setActionLoading(true);
      await resetSimulationState(startingCashAmount);
      showNotification('success', `Simulation reset: All trader balances initialized to $${startingCashAmount.toLocaleString()}.`);
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setActionLoading(false);
    }
  };


  const handleUpdateInterval = async (sec: number) => {
    try {
      if (activeSessionId) {
        await setDoc(doc(db, COLLECTIONS.SESSIONS, activeSessionId), { priceUpdateIntervalSeconds: sec }, { merge: true });
      }
      await setDoc(doc(db, 'simulation', 'config'), { priceUpdateIntervalSeconds: sec }, { merge: true });
      showNotification('success', `Price tick cadence set to ${sec}s`);
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };



  const handlePurgeCrypto = async () => {
    try {
      setActionLoading(true);
      const res = await purgeAllCrypto();
      showNotification('success', res.purgedCount > 0 ? `Successfully removed ${res.purgedCount} crypto assets and refunded holdings.` : 'No cryptocurrency assets detected on the trading floor.');
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Broadcast News Bulletin
  const handleBroadcastNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsHeadline.trim()) return;
    setLoading(true);
    try {
      const imp = parseFloat(newsImpact) || 0.03;
      if (!activeSessionId) throw new Error('Create or select a session before broadcasting news.');
      await addDoc(collection(db, COLLECTIONS.SESSIONS, activeSessionId, SESSION_SUBCOLLECTIONS.NEWS), {
        headline: newsHeadline.trim(),
        summary: newsSummary.trim() || newsHeadline.trim(),
        ticker: newsTicker,
        sentiment: newsSentiment,
        impact: newsSentiment === 'BULLISH' ? Math.abs(imp) : -Math.abs(imp),
        timestamp: serverTimestamp(),
      });

      setNewsHeadline('');
      setNewsSummary('');
      showNotification('success', `Breaking news catalyst broadcasted for ${newsTicker}!`);
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Quick Catalysts
  const handleQuickCatalyst = async (preset: { headline: string; summary: string; ticker: string; sentiment: string; impact: number }) => {
    try {
      if (!activeSessionId) throw new Error('Create or select a session before deploying a catalyst.');
      await addDoc(collection(db, COLLECTIONS.SESSIONS, activeSessionId, SESSION_SUBCOLLECTIONS.NEWS), {
        ...preset,
        timestamp: serverTimestamp(),
      });
      showNotification('success', `Catalyst deployed: "${preset.headline.slice(0, 30)}..."`);
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  // Add Custom Stock
  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker || !name || !price) return;

    // Prevent duplicates
    const alreadyExists = stocks.some(s => (s.ticker || '').trim().toUpperCase() === cleanTicker);
    if (alreadyExists) {
      showNotification('error', `Asset "${cleanTicker}" already exists! Remove or edit the existing asset.`);
      return;
    }

    setLoading(true);
    try {
      const p = parseFloat(price);
      const v = parseFloat(volatility) || 0.02;
      if (!activeSessionId) throw new Error('Create or select a session before adding a stock.');
      const newRef = await addDoc(collection(db, COLLECTIONS.SESSIONS, activeSessionId, SESSION_SUBCOLLECTIONS.STOCKS), {
        ticker: cleanTicker,
        name: name.trim(),
        sector,
        currentPrice: p,
        dayOpenPrice: p,
        dayHigh: p,
        dayLow: p,
        change: 0,
        changePercent: 0,
        volatility: v,
        trend: 0,
        isActive: true,
        createdAt: serverTimestamp(),
      });

      // Generate history points
      await addDoc(collection(db, COLLECTIONS.SESSIONS, activeSessionId, SESSION_SUBCOLLECTIONS.PRICE_HISTORY), {
        stockId: newRef.id,
        price: p,
        timestamp: serverTimestamp(),
        sessionId: activeSessionId,
      });

      setTicker('');
      setName('');
      setPrice('');
      showNotification('success', `Listed ${cleanTicker} on the market!`);
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // Clean duplicate stocks from Firestore
  const handleCleanDuplicates = async () => {
    try {
      if (!activeSessionId) throw new Error('Create or select a session before cleaning stocks.');
      setActionLoading(true);
      const byTicker = new Map<string, any[]>();
      stocks.forEach((stock) => {
        const normalizedTicker = (stock.ticker || '').trim().toUpperCase();
        if (!normalizedTicker) return;
        const entries = byTicker.get(normalizedTicker) || [];
        entries.push(stock);
        byTicker.set(normalizedTicker, entries);
      });

      let removed = 0;
      for (const entries of byTicker.values()) {
        for (const duplicate of entries.slice(1)) {
          await deleteDoc(doc(
            db,
            COLLECTIONS.SESSIONS,
            activeSessionId,
            SESSION_SUBCOLLECTIONS.STOCKS,
            duplicate.id
          ));
          removed++;
        }
      }
      showNotification('success', removed > 0 ? `Purged ${removed} duplicate stock records from the database!` : 'No duplicate stock records found.');
    } catch (e: any) {
      showNotification('error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Edit stock price directly
  const handleSaveStockPrice = async (stockId: string) => {
    const p = parseFloat(editPrice);
    if (!p || p <= 0) return;
    try {
      if (!activeSessionId) throw new Error('No active session selected.');
      await updateDoc(doc(db, COLLECTIONS.SESSIONS, activeSessionId, SESSION_SUBCOLLECTIONS.STOCKS, stockId), {
        currentPrice: p,
        lastUpdated: serverTimestamp(),
      });
      await addDoc(collection(db, COLLECTIONS.SESSIONS, activeSessionId, SESSION_SUBCOLLECTIONS.PRICE_HISTORY), {
        stockId,
        price: p,
        timestamp: serverTimestamp(),
        sessionId: activeSessionId,
      });
      setEditingStock(null);
      showNotification('success', 'Stock price updated directly.');
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const handleToggleStock = async (stock: any) => {
    try {
      if (!activeSessionId) throw new Error('No active session selected.');
      await updateDoc(doc(db, COLLECTIONS.SESSIONS, activeSessionId, SESSION_SUBCOLLECTIONS.STOCKS, stock.id), { isActive: !stock.isActive });
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const handleDeleteStock = async (stockId: string, tickerSymbol: string) => {
    try {
      if (!activeSessionId) throw new Error('No active session selected.');
      await deleteDoc(doc(db, COLLECTIONS.SESSIONS, activeSessionId, SESSION_SUBCOLLECTIONS.STOCKS, stockId));
      showNotification('success', `Removed ${tickerSymbol}`);
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  // Adjust User Cash (+ / -)
  const handleAdjustUserCash = async (userId: string, currentCash: number, delta: number) => {
    try {
      if (!activeSessionId) throw new Error('No active session selected.');
      const newCash = Math.max(0, currentCash + delta);
      await updateDoc(doc(
        db,
        COLLECTIONS.SESSIONS,
        activeSessionId,
        SESSION_SUBCOLLECTIONS.PORTFOLIOS,
        userId
      ), {
        currentCash: newCash,
        lastUpdated: serverTimestamp(),
      });
      showNotification('success', `Adjusted cash balance by ${delta >= 0 ? '+' : ''}$${delta.toLocaleString()}`);
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const handleToggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'participant' : 'admin';
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      showNotification('success', `User role set to ${newRole}`);
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  // Export Full CSV
  const handleExportCSV = () => {
    let csv = 'Rank,Trader Name,Email,Role,Starting Balance,Cash Balance,Portfolio Net Worth,Total Return ($),Return (%)\n';
    users.forEach((u, i) => {
      const start = Number(u.startingBalance || 100000);
      const portVal = Number(u.portfolioValue ?? u.currentCash ?? 100000);
      const pnl = portVal - start;
      const returnPct = start > 0 ? (pnl / start) * 100 : 0;

      csv += `${i + 1},"${u.name || ''}","${u.email || ''}","${u.role || 'participant'}",${start},${(u.currentCash || 0).toFixed(2)},${portVal.toFixed(2)},${pnl.toFixed(2)},${returnPct.toFixed(2)}%\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stotra-simulation-results-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Derive all status flags from the SESSION, not legacy config
  const sessionStatus: string = activeSession?.status || 'NO_SESSION';
  const isRunning = sessionStatus === 'RUNNING';
  const isSessionLobby = sessionStatus === 'LOBBY';
  const isSessionEnded = sessionStatus === 'ENDED';
  const isCompleted = sessionStatus === 'ENDED';
  const status = sessionStatus; // used in status badge
  const regime = config.marketRegime || 'NORMAL';
  const intervalSec = activeSession?.priceUpdateIntervalSeconds || config.priceUpdateIntervalSeconds || 30;
  const inspectorUsers = currentSessionPortfolios.map((portfolio) => {
    const profile = users.find((candidate) => candidate.id === portfolio.uid);
    return {
      ...profile,
      ...portfolio,
      id: portfolio.uid,
      name: profile?.name || profile?.displayName || portfolio.displayName || 'Anonymous',
      email: profile?.email || '',
      role: profile?.role || 'participant',
      startingBalance: portfolio.startingCash,
      portfolioValue: portfolio.portfolioValue,
    };
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {msg && (
        <div className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between shadow-md ${
          msg.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {msg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-xs opacity-60 hover:opacity-100 cursor-pointer">✕</button>
        </div>
      )}

      {/* Primary Market Controller Banner */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-200 space-y-6">
        <div className="flex flex-wrap gap-4 justify-between items-center pb-5 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Market Administrator Suite</h1>
              <span className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1.5 border ${
                isRunning ? 'bg-green-50 text-green-700 border-green-200' :
                isCompleted ? 'bg-amber-50 text-amber-800 border-amber-200' :
                'bg-zinc-100 text-zinc-700 border-zinc-200'
              }`}>
                {isRunning && <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />}
                {status}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Control simulation lifecycle, trigger news events, monitor all participant activity and market prices.
            </p>
          </div>

          {/* Core Session State Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Session selection remains available while preserving all historical sessions. */}
            {sessions.length > 1 && (
              <select
                value={activeSessionId || ''}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setActiveSessionId(nextId || null);
                  const nextSession = sessions.find((session) => session.id === nextId) || null;
                  setActiveSession(nextSession);
                }}
                className="px-3 py-2 border border-zinc-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Select session"
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} ({session.status})
                  </option>
                ))}
              </select>
            )}

            {/* Ended sessions remain selected so final standings stay available. */}
            {(!activeSession || showCreateSessionForm) && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="Session name..."
                  className="px-3 py-2 border border-zinc-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                />
                <button
                  onClick={handleCreateSession}
                  disabled={isCreatingSession || !newSessionName.trim()}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {isCreatingSession ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            )}

            {activeSession?.status === 'ENDED' && !showCreateSessionForm && (
              <button
                onClick={() => setShowCreateSessionForm(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create New Session
              </button>
            )}

            {/* Session controls — only shown when a session exists */}
            {activeSession && (
              <>
                {isSessionLobby && (
                  <button
                    onClick={handleStartSession}
                    disabled={actionLoading}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Start Session
                  </button>
                )}

                {isRunning && (
                  <button
                    onClick={handlePauseSession}
                    disabled={actionLoading}
                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                )}

                {sessionStatus === 'PAUSED' && (
                  <button
                    onClick={handleStartSession}
                    disabled={actionLoading}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Resume
                  </button>
                )}

                {isRunning && (
                  <button
                    onClick={handleEndSession}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    <Award className="w-4 h-4" />
                    End & Finalize
                  </button>
                )}

                {/* Session Code Display */}
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs">
                  <Hash className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-blue-700 font-semibold">Code:</span>
                  <span className="font-mono font-extrabold text-blue-900 tracking-widest">
                    {activeSession.sessionCode}
                  </span>
                </div>
              </>
            )}

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Standings CSV
            </button>
          </div>
        </div>

        {/* Configuration Row: Duration, Starting Balance, Market Regime, Speed */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Simulation runs until admin manually ends it — no auto-timer */}

          {/* Configurable Starting Cash */}
          <div className="bg-zinc-50/80 p-3.5 rounded-2xl border border-zinc-200/80 space-y-2">
            <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider block flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              Starting Capital
            </label>
            <div className="flex flex-wrap gap-1">
              {[10000, 50000, 100000, 250000].map(amt => (
                <button
                  key={amt}
                  onClick={() => setStartingCashAmount(amt)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    startingCashAmount === amt
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  ${amt >= 1000 ? `${amt / 1000}k` : amt}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-zinc-400 block">Applies to resets and new traders</span>
          </div>

          {/* Simulation Status */}
          <div className="bg-zinc-50/80 p-3.5 rounded-2xl border border-zinc-200/80 space-y-2">
            <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-purple-600" />
              Market Status
            </label>
            <div className="bg-white p-2.5 rounded-xl border border-zinc-200/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Simulation:</span>
                <span className={`font-extrabold ${isRunning ? 'text-green-600' : isCompleted ? 'text-amber-700' : 'text-zinc-500'}`}>
                  {status}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">News Event:</span>
                <span className={`font-bold ${activeNewsEvent && !activeNewsEvent.isExpired ? 'text-purple-700' : 'text-zinc-400'}`}>
                  {activeNewsEvent && !activeNewsEvent.isExpired ? 'ACTIVE' : 'NONE'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Participants:</span>
                <span className="font-bold text-zinc-800">{users.filter(u => u.role === 'participant').length}</span>
              </div>
            </div>
          </div>
          {/* Price Update Cadence */}
          <div className="bg-zinc-50/80 p-3.5 rounded-2xl border border-zinc-200/80 space-y-2">
            <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider block flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              Price Update Speed
            </label>
            <div className="flex gap-1.5">
              {[5, 10, 15, 30, 60].map(s => (
                <button
                  key={s}
                  onClick={() => handleUpdateInterval(s)}
                  className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    intervalSec === s
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {s}s
                </button>
              ))}
            </div>
            <span className="text-[10px] text-zinc-400 block">Seconds between each price tick</span>
          </div>
        </div>
      </div>

      {/* Secondary Layout: News Dispatcher & Stocks Administration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: News Events & Seed Controls */}
        <div className="space-y-6">
          {/* ─── NEWS EVENT TRIGGER PANEL (TL2) ─── */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">News Event Trigger</h3>
                  <p className="text-[11px] text-zinc-500">Fire a 15-min scenario — affects prices globally</p>
                </div>
              </div>
            </div>

            {/* Active Event Status */}
            {activeNewsEvent && !activeNewsEvent.isExpired ? (
              <div className={`p-3 rounded-2xl border text-xs space-y-2 ${
                activeNewsEvent.type === 'POSITIVE'
                  ? 'bg-emerald-50 border-emerald-200'
                  : activeNewsEvent.type === 'NEGATIVE'
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`font-extrabold text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    activeNewsEvent.type === 'POSITIVE'
                      ? 'bg-emerald-200 text-emerald-800'
                      : activeNewsEvent.type === 'NEGATIVE'
                      ? 'bg-rose-200 text-rose-800'
                      : 'bg-amber-200 text-amber-800'
                  }`}>
                    {activeNewsEvent.type === 'POSITIVE'
                      ? 'Positive Event Active'
                      : activeNewsEvent.type === 'NEGATIVE'
                      ? 'Negative Event Active'
                      : 'Mixed Event Active'}
                  </span>
                  <span className="font-mono font-extrabold text-base tracking-widest flex items-center gap-1">
                    <Timer className="w-4 h-4 opacity-60" />
                    {formatCountdown(newsEventCountdown)}
                  </span>
                </div>
                <p className="font-semibold text-zinc-800 leading-snug">{activeNewsEvent.headline}</p>
                <button
                  onClick={handleEndNewsEventEarly}
                  className="w-full py-1.5 bg-zinc-700 hover:bg-zinc-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-1"
                >
                  <XCircle className="w-3.5 h-3.5" /> End Event Early
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-zinc-400 bg-zinc-50 rounded-xl p-2.5 border border-zinc-200 text-center">
                No active news event — select a scenario below to trigger
              </div>
            )}

            {/* Scenario Trigger Buttons */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Positive Scenarios (3)
              </span>
              {ALL_SCENARIOS.filter(s => s.type === 'POSITIVE').map(scenario => (
                <button
                  key={scenario.id}
                  disabled={isTriggeringEvent || (activeNewsEvent && !activeNewsEvent.isExpired) || !isRunning}
                  onClick={() => handleTriggerNewsEvent(scenario.id as NewsEventId)}
                  className="w-full text-left p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[11px] transition-colors flex items-center justify-between cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="font-semibold text-emerald-900 pr-2 leading-snug">{scenario.headline}</span>
                  <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">▶</span>
                </button>
              ))}
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pt-1">
                Negative Scenarios (3)
              </span>
              {ALL_SCENARIOS.filter(s => s.type === 'NEGATIVE').map(scenario => (
                <button
                  key={scenario.id}
                  disabled={isTriggeringEvent || (activeNewsEvent && !activeNewsEvent.isExpired) || !isRunning}
                  onClick={() => handleTriggerNewsEvent(scenario.id as NewsEventId)}
                  className="w-full text-left p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[11px] transition-colors flex items-center justify-between cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="font-semibold text-rose-900 pr-2 leading-snug">{scenario.headline}</span>
                  <span className="text-[10px] font-bold bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded shrink-0">▶</span>
                </button>
              ))}
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pt-1">
                Mixed Scenarios (1)
              </span>
              {ALL_SCENARIOS.filter(s => s.type === 'MIXED').map(scenario => (
                <button
                  key={scenario.id}
                  disabled={isTriggeringEvent || (activeNewsEvent && !activeNewsEvent.isExpired) || !isRunning}
                  onClick={() => handleTriggerNewsEvent(scenario.id as NewsEventId)}
                  className="w-full text-left p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[11px] transition-colors flex items-center justify-between cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="font-semibold text-amber-900 pr-2 leading-snug">{scenario.headline}</span>
                  <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded shrink-0">▶</span>
                </button>
              ))}
            </div>
            {!isRunning && (
              <p className="text-[10px] text-amber-600 font-semibold text-center">Start the simulation first to trigger events</p>
            )}
          </div>

          {/* Seed Fictional Stocks Card */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-zinc-200 space-y-3">
            <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              FinQuest Fictional Stocks
            </h3>
            <p className="text-[11px] text-zinc-500">Seeds the 8 fixed fictional companies used for this event</p>
            <button
              onClick={handleSeedFictionalStocks}
              disabled={actionLoading}
              className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold text-purple-800 flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50"
            >
              <span>🏢 Seed 8 Fictional Companies</span>
              <span className="text-[10px] bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded">GOOGL · MOON · BADBURY · FPMORGAN · ABIBANK · FLOPCART · LPGREEN · ZXDEFENCE</span>
            </button>
          </div>

          {/* Real-market seed presets removed — this is a fictional stocks event */}
        </div>

        {/* Middle & Right Column: Stock Management & Participant Inspector (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Custom Stock Creator & Active Stock Listings */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-zinc-200 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">Stock Listings & Pricing ({stocks.length})</h3>
                  <p className="text-[11px] text-zinc-500">Live prices, volatilities, and individual asset controls</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePurgeCrypto}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-rose-200/80 inline-flex items-center gap-1.5"
                  title="Purge all crypto assets from floor"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Purge Crypto</span>
                </button>
                <button
                  type="button"
                  onClick={handleCleanDuplicates}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-zinc-300/80 inline-flex items-center gap-1.5"
                  title="Detect and remove duplicate asset records with matching tickers"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Clean Duplicates</span>
                </button>
              </div>
            </div>

            {/* Quick Add Custom Stock Inline */}
            <form onSubmit={handleAddStock} className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200/80 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Ticker</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AMD"
                  maxLength={6}
                  value={ticker}
                  onChange={e => setTicker(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs uppercase font-bold border border-zinc-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Company</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AMD Inc"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded-lg bg-white font-medium"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Sector</label>
                <input
                  type="text"
                  placeholder="Technology"
                  value={sector}
                  onChange={e => setSector(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="145.00"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-bold border border-zinc-300 rounded-lg bg-white"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                >
                  {loading ? 'Adding...' : '+ Add Stock'}
                </button>
              </div>
            </form>

            {/* Stocks Table */}
            <div className="overflow-x-auto max-h-[320px]">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] uppercase font-semibold text-zinc-500 bg-zinc-50/70 border-b border-zinc-100 sticky top-0">
                  <tr>
                    <th className="px-3.5 py-2">Asset</th>
                    <th className="px-3.5 py-2">Sector</th>
                    <th className="px-3.5 py-2 text-right">Price</th>
                    <th className="px-3.5 py-2 text-right">Volatility</th>
                    <th className="px-3.5 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {stocks.map(s => {
                    const isEditing = editingStock?.id === s.id;
                    return (
                      <tr key={s.id} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="px-3.5 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-zinc-900 text-xs">{s.ticker}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              s.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-200 text-zinc-600'
                            }`}>
                              {s.isActive ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-500">{s.name}</div>
                        </td>
                        <td className="px-3.5 py-2 text-xs text-zinc-600 font-medium">
                          {s.sector || 'Stock'}
                        </td>
                        <td className="px-3.5 py-2 text-right font-bold text-zinc-900 text-xs">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={editPrice}
                                onChange={e => setEditPrice(e.target.value)}
                                className="w-16 px-1.5 py-0.5 text-xs border border-blue-500 rounded bg-white"
                              />
                              <button
                                onClick={() => handleSaveStockPrice(s.id)}
                                className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <span>${Number(s.currentPrice || 0).toFixed(2)}</span>
                              <button
                                onClick={() => { setEditingStock(s); setEditPrice(String(s.currentPrice || '')); }}
                                className="text-zinc-400 hover:text-zinc-700"
                                title="Edit Price"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2 text-right text-xs font-semibold text-blue-600">
                          {((s.volatility || 0.02) * 100).toFixed(1)}%
                        </td>
                        <td className="px-3.5 py-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleStock(s)}
                              className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${
                                s.isActive ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-green-200 text-green-700 hover:bg-green-50'
                              }`}
                            >
                              {s.isActive ? 'Halt' : 'Resume'}
                            </button>
                            <button
                              onClick={() => handleDeleteStock(s.id, s.ticker)}
                              className="p-1 text-zinc-400 hover:text-red-600 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {stocks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-400 text-xs">
                        No stocks currently listed. Use the seed bundles or form above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Participant Portfolio Inspector */}
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden space-y-2">
            <div className="p-4 border-b border-zinc-200 bg-zinc-50/70 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">Participant Portfolio Inspector ({inspectorUsers.length})</h3>
                  <p className="text-[11px] text-zinc-500">Live positions, balances, and manual account adjustments</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] uppercase font-semibold text-zinc-500 bg-zinc-50/50 border-b border-zinc-100">
                  <tr>
                    <th className="px-4 py-2.5">Trader</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5 text-right">Cash Balance</th>
                    <th className="px-4 py-2.5 text-right">Portfolio Value</th>
                    <th className="px-4 py-2.5 text-right">Return P&L</th>
                    <th className="px-4 py-2.5 text-right">Adjust Cash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {inspectorUsers.map(u => {
                    const start = Number(u.startingBalance || 100000);
                    const portVal = Number(u.portfolioValue ?? u.currentCash ?? 100000);
                    const pnl = portVal - start;
                    const isPositive = pnl >= 0;
                    const isExpanded = expandedUserId === u.id;

                    const userHoldings = allHoldings.filter(h => h.userId === u.id);

                    return (
                      <React.Fragment key={u.id}>
                        <tr className="hover:bg-zinc-50/70 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                                className="text-zinc-400 hover:text-zinc-700"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              <div>
                                <div className="font-bold text-zinc-900 text-xs">{u.name || 'Anonymous'}</div>
                                <div className="text-[11px] text-zinc-400">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleToggleUserRole(u.id, u.role)}
                              className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-colors ${
                                u.role === 'admin'
                                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                              }`}
                            >
                              {u.role === 'admin' ? 'Admin' : 'Participant'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-700 font-semibold text-xs">
                            ${Number(u.currentCash ?? 100000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-zinc-900 text-xs">
                            ${Number(portVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? '+' : ''}${pnl.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleAdjustUserCash(u.id, Number(u.currentCash || 0), 10000)}
                                className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded text-[11px] font-bold transition-colors"
                                title="Add $10,000 cash"
                              >
                                +$10k
                              </button>
                              <button
                                onClick={() => handleAdjustUserCash(u.id, Number(u.currentCash || 0), -10000)}
                                className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded text-[11px] font-bold transition-colors"
                                title="Deduct $10,000 cash"
                              >
                                -$10k
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Holdings View for this User */}
                        {isExpanded && (
                          <tr className="bg-zinc-50/90">
                            <td colSpan={6} className="px-6 py-3 text-xs">
                              <div className="space-y-1.5">
                                <span className="font-bold text-zinc-700 uppercase tracking-wider text-[10px]">
                                  Current Open Positions ({userHoldings.length}):
                                </span>
                                {userHoldings.length > 0 ? (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {userHoldings.map(h => (
                                      <div key={h.id} className="p-2 bg-white rounded-lg border border-zinc-200 text-xs">
                                        <div className="font-bold text-zinc-900">{h.ticker || h.stockId}</div>
                                        <div className="text-zinc-500 text-[11px]">
                                          {h.quantity} shares @ avg ${Number(h.averageBuyPrice || 0).toFixed(2)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-zinc-400 italic text-[11px]">No active stock positions held (100% Cash).</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
