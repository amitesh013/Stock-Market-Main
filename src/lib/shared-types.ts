// ============================================================
// shared-types.ts — FinQuest Common Type Definitions
// ALL team members import from this file.
// DO NOT define stock/news/simulation types anywhere else.
// ============================================================

// ------------------------------------------------------------
// SESSION — top-level isolation unit
// ------------------------------------------------------------

export interface Session {
  id: string;                    // Firestore doc ID = sessionId
  sessionCode: string;           // 6-char uppercase code e.g. "FQ2024"
  name: string;                  // Display name e.g. "FinQuest Round 1"
  status: SessionStatus;
  startingCash: number;
  createdAt: any;
  startedAt: any | null;
  endedAt: any | null;
  activeNewsEventId: string | null;
  activeNewsEventExpiresAt: any | null;
  priceUpdateIntervalSeconds: number;
}

export type SessionStatus = 'LOBBY' | 'RUNNING' | 'PAUSED' | 'ENDED';

// ------------------------------------------------------------
// STOCKS (per session)
// ------------------------------------------------------------

export type StockId =
  | 'GOOGL'
  | 'MOON'
  | 'BADBURY'
  | 'FPMORGAN'
  | 'ABIBANK'
  | 'FLOPCART'
  | 'LPGREEN'
  | 'ZXDEFENCE';

export interface Stock {
  id: string;
  ticker: StockId;
  yahooSymbol: string;
  name: string;
  sector: string;
  currentPrice: number;
  initialPrice: number;
  dayOpenPrice: number;
  change: number;
  changePercent: number;
  volatility: number;
  newsSensitivity: number;
  isActive: boolean;
  source: string;
  referencePrice: number;
  lastYahooSync: any | null;
  lastUpdated: any;
}

export const FICTIONAL_STOCKS: Omit<Stock, 'id' | 'lastUpdated'>[] = [
  { ticker: 'GOOGL',    yahooSymbol: 'GOOGL', name: 'Googl Technologies', sector: 'Technology',       currentPrice: 250.00, initialPrice: 250.00, dayOpenPrice: 250.00, change: 0, changePercent: 0, volatility: 0.015, newsSensitivity: 1.2, isActive: true, source: 'Yahoo Finance', referencePrice: 250.00, lastYahooSync: null },
  { ticker: 'MOON',    yahooSymbol: 'PFE',   name: 'Moon Pharma',         sector: 'Pharmaceuticals',  currentPrice: 180.00, initialPrice: 180.00, dayOpenPrice: 180.00, change: 0, changePercent: 0, volatility: 0.018, newsSensitivity: 1.5, isActive: true, source: 'Yahoo Finance', referencePrice: 180.00, lastYahooSync: null },
  { ticker: 'BADBURY', yahooSymbol: 'KO',    name: 'Badbury Consumer',    sector: 'FMCG',             currentPrice: 120.00, initialPrice: 120.00, dayOpenPrice: 120.00, change: 0, changePercent: 0, volatility: 0.010, newsSensitivity: 0.9, isActive: true, source: 'Yahoo Finance', referencePrice: 120.00, lastYahooSync: null },
  { ticker: 'FPMORGAN',yahooSymbol: 'JPM',   name: 'FPMorgan Financial',  sector: 'Finance',          currentPrice: 200.00, initialPrice: 200.00, dayOpenPrice: 200.00, change: 0, changePercent: 0, volatility: 0.012, newsSensitivity: 1.1, isActive: true, source: 'Yahoo Finance', referencePrice: 200.00, lastYahooSync: null },
  { ticker: 'ABIBANK', yahooSymbol: 'BAC',   name: 'ABI Bank',            sector: 'Banking',          currentPrice: 150.00, initialPrice: 150.00, dayOpenPrice: 150.00, change: 0, changePercent: 0, volatility: 0.013, newsSensitivity: 1.1, isActive: true, source: 'Yahoo Finance', referencePrice: 150.00, lastYahooSync: null },
  { ticker: 'FLOPCART',yahooSymbol: 'AMZN',  name: 'Flopcart',            sector: 'E-commerce',       currentPrice: 300.00, initialPrice: 300.00, dayOpenPrice: 300.00, change: 0, changePercent: 0, volatility: 0.020, newsSensitivity: 1.3, isActive: true, source: 'Yahoo Finance', referencePrice: 300.00, lastYahooSync: null },
  { ticker: 'LPGREEN', yahooSymbol: 'ENPH',  name: 'LP Green Energy',     sector: 'Renewable Energy', currentPrice: 90.00,  initialPrice: 90.00,  dayOpenPrice: 90.00,  change: 0, changePercent: 0, volatility: 0.022, newsSensitivity: 1.4, isActive: true, source: 'Yahoo Finance', referencePrice: 90.00, lastYahooSync: null },
  { ticker: 'ZXDEFENCE',yahooSymbol: 'LMT',  name: 'ZX Defence',          sector: 'Defence',          currentPrice: 210.00, initialPrice: 210.00, dayOpenPrice: 210.00, change: 0, changePercent: 0, volatility: 0.011, newsSensitivity: 0.8, isActive: true, source: 'Yahoo Finance', referencePrice: 210.00, lastYahooSync: null },
];

// ------------------------------------------------------------
// NEWS EVENT CONFIG (scenario definitions)
// ------------------------------------------------------------

export type NewsEventType = 'POSITIVE' | 'NEGATIVE' | 'MIXED';
export type ImpactStrength = 'STRONG_UP' | 'MODERATE_UP' | 'SLIGHT_UP' | 'NO_IMPACT' | 'SLIGHT_DOWN' | 'MODERATE_DOWN' | 'SHARP_DOWN';

export interface StockImpact {
  ticker: string;
  strength: ImpactStrength;
  percentPerTick: number;   // Applied each price tick while event is active e.g. 0.003
}

export type NewsEventId =
  | 'tech-boom'
  | 'consumer-spending-surge'
  | 'energy-transition-boom'
  | 'banking-liquidity-crisis'
  | 'pharma-safety-scandal'
  | 'geopolitical-oil-shock'
  | 'global-recession';

export interface NewsEventConfig {
  id: NewsEventId;
  type: NewsEventType;
  headline: string;
  description: string;
  durationSeconds: number;
  affectedStocks: StockImpact[];
}

// Active event doc stored in Firestore under sessions/{sessionId}/meta/activeEvent
export interface ActiveNewsEvent {
  eventId: NewsEventId;
  headline: string;
  description: string;
  type: NewsEventType;
  durationSeconds: number;
  affectedStocks: StockImpact[];
  triggeredAt: any;
  expiresAt: any;
  isExpired: boolean;
}

// ------------------------------------------------------------
// USER PROFILE
// ------------------------------------------------------------

export type UserRole = 'admin' | 'participant';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  currentSessionId: string | null;   // Which session the participant is in
  createdAt: any;
}

// Per-session portfolio — stored under sessions/{sessionId}/portfolios/{uid}
export interface SessionPortfolio {
  uid: string;
  displayName: string;
  sessionId: string;
  currentCash: number;
  startingCash: number;
  portfolioValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  lastUpdated: any;
}

// ------------------------------------------------------------
// HOLDINGS
// ------------------------------------------------------------

export interface Holding {
  id: string;
  userId: string;
  sessionId: string;
  stockId: string;
  ticker: StockId;
  quantity: number;
  averageBuyPrice: number;
  currentValue: number;
  unrealizedPnL: number;
}

// ------------------------------------------------------------
// TRANSACTIONS
// ------------------------------------------------------------

export type TransactionType = 'BUY' | 'SELL';

export interface Transaction {
  id: string;
  userId: string;
  sessionId: string;
  stockId: string;
  ticker: StockId;
  type: TransactionType;
  quantity: number;
  price: number;
  totalAmount: number;
  cashBefore: number;
  cashAfter: number;
  activeNewsEventId: string | null;
  timestamp: any;
}

// ------------------------------------------------------------
// LEADERBOARD
// ------------------------------------------------------------

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  portfolioValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  cashRemaining: number;
  sessionId: string;
}

// ------------------------------------------------------------
// PRICE HISTORY
// ------------------------------------------------------------

export interface PriceHistoryEntry {
  stockId: string;
  ticker: StockId;
  price: number;
  timestamp: any;
  sessionId: string;
  activeNewsEventId?: string | null;
}

// ------------------------------------------------------------
// FIRESTORE PATHS
// sessions/{sessionId}/stocks/{stockId}
// sessions/{sessionId}/portfolios/{uid}
// sessions/{sessionId}/holdings/{holdingId}
// sessions/{sessionId}/transactions/{txId}
// sessions/{sessionId}/price_history/{entryId}
// sessions/{sessionId}/news/{newsId}
// sessions/{sessionId}/meta/activeEvent
// users/{uid}  (global — role, displayName, currentSessionId)
// ------------------------------------------------------------

export const COLLECTIONS = {
  SESSIONS: 'sessions',
  USERS: 'users',
} as const;

export const SESSION_SUBCOLLECTIONS = {
  STOCKS: 'stocks',
  PORTFOLIOS: 'portfolios',
  HOLDINGS: 'holdings',
  TRANSACTIONS: 'transactions',
  NEWS: 'news',
  PRICE_HISTORY: 'price_history',
  META: 'meta',
} as const;

export const SESSION_META_DOCS = {
  ACTIVE_EVENT: 'activeEvent',
} as const;

// Legacy aliases so existing imports don't break while team migrates
export const SIMULATION_DOCS = {
  CONFIG: 'config',
  HEARTBEAT: 'heartbeat',
  ACTIVE_EVENT: 'activeEvent',
} as const;

// Helper: build Firestore paths
export const sessionPath = (sessionId: string) =>
  `${COLLECTIONS.SESSIONS}/${sessionId}`;

export const sessionSubPath = (sessionId: string, sub: string) =>
  `${COLLECTIONS.SESSIONS}/${sessionId}/${sub}`;


// ── LEGACY ALIASES (keep until M2/M3 migrate to session subcollections) ──
export const LEGACY_COLLECTIONS = {
  STOCKS: 'stocks',
  HOLDINGS: 'holdings',
  TRANSACTIONS: 'transactions',
  NEWS: 'news',
  PRICE_HISTORY: 'price_history',
  SIMULATION: 'simulation',
  USERS: 'users',
} as const;
