// ============================================================
// shared-types.ts — FinQuest Common Type Definitions
// ALL team members import from this file.
// DO NOT define stock/news/simulation types anywhere else.
// ============================================================

// ------------------------------------------------------------
// STOCKS
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
  id: string;               // Firestore document ID
  ticker: StockId;
  name: string;
  sector: string;
  currentPrice: number;
  initialPrice: number;     // Price at simulation start — never changes
  dayOpenPrice: number;
  change: number;           // Absolute change from open
  changePercent: number;    // % change from open
  volatility: number;       // Base volatility: e.g. 0.02 = 2% per tick
  newsSensitivity: number;  // Multiplier for news impact: 1.0 = normal
  isActive: boolean;
  lastUpdated: any;         // Firestore Timestamp
}

// The 8 fixed fictional stocks — import this wherever you need defaults
export const FICTIONAL_STOCKS: Omit<Stock, 'id' | 'lastUpdated'>[] = [
  {
    ticker: 'GOOGL',
    name: 'Googl Technologies',
    sector: 'Technology',
    currentPrice: 250.00,
    initialPrice: 250.00,
    dayOpenPrice: 250.00,
    change: 0,
    changePercent: 0,
    volatility: 0.015,
    newsSensitivity: 1.2,
    isActive: true,
  },
  {
    ticker: 'MOON',
    name: 'Moon Pharma',
    sector: 'Pharmaceuticals',
    currentPrice: 180.00,
    initialPrice: 180.00,
    dayOpenPrice: 180.00,
    change: 0,
    changePercent: 0,
    volatility: 0.018,
    newsSensitivity: 1.5,
    isActive: true,
  },
  {
    ticker: 'BADBURY',
    name: 'Badbury Consumer',
    sector: 'FMCG',
    currentPrice: 120.00,
    initialPrice: 120.00,
    dayOpenPrice: 120.00,
    change: 0,
    changePercent: 0,
    volatility: 0.010,
    newsSensitivity: 0.9,
    isActive: true,
  },
  {
    ticker: 'FPMORGAN',
    name: 'FPMorgan',
    sector: 'Finance',
    currentPrice: 320.00,
    initialPrice: 320.00,
    dayOpenPrice: 320.00,
    change: 0,
    changePercent: 0,
    volatility: 0.014,
    newsSensitivity: 1.3,
    isActive: true,
  },
  {
    ticker: 'ABIBANK',
    name: 'ABI Bank',
    sector: 'Banking',
    currentPrice: 95.00,
    initialPrice: 95.00,
    dayOpenPrice: 95.00,
    change: 0,
    changePercent: 0,
    volatility: 0.013,
    newsSensitivity: 1.4,
    isActive: true,
  },
  {
    ticker: 'FLOPCART',
    name: 'Flopcart',
    sector: 'E-commerce',
    currentPrice: 210.00,
    initialPrice: 210.00,
    dayOpenPrice: 210.00,
    change: 0,
    changePercent: 0,
    volatility: 0.020,
    newsSensitivity: 1.1,
    isActive: true,
  },
  {
    ticker: 'LPGREEN',
    name: 'LP Green Energy',
    sector: 'Renewable Energy',
    currentPrice: 145.00,
    initialPrice: 145.00,
    dayOpenPrice: 145.00,
    change: 0,
    changePercent: 0,
    volatility: 0.022,
    newsSensitivity: 1.0,
    isActive: true,
  },
  {
    ticker: 'ZXDEFENCE',
    name: 'ZX Defence',
    sector: 'Defence',
    currentPrice: 390.00,
    initialPrice: 390.00,
    dayOpenPrice: 390.00,
    change: 0,
    changePercent: 0,
    volatility: 0.012,
    newsSensitivity: 0.8,
    isActive: true,
  },
];

// ------------------------------------------------------------
// SIMULATION CONFIG
// ------------------------------------------------------------

export type SimulationStatus = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'COMPLETED';

export interface SimulationConfig {
  status: SimulationStatus;
  startingBalanceAmount: number;   // e.g. 100000
  priceUpdateIntervalSeconds: number; // e.g. 5
  startTime?: any;                 // Firestore Timestamp
  endTime?: any;                   // Firestore Timestamp | null = unlimited
  durationMinutes?: number;
  pausedTime?: any;
  remainingMs?: number | null;     // Time left on clock when paused — used to resume correctly
  completedAt?: any;
  activeNewsEventId?: string | null; // ID of currently active news event, null if none
  activeNewsEventExpiresAt?: any;    // Firestore Timestamp when news effect ends
}

// ------------------------------------------------------------
// NEWS EVENTS
// ------------------------------------------------------------

export type NewsEventId =
  | 'tech-boom'
  | 'consumer-spending-surge'
  | 'energy-transition-boom'
  | 'banking-liquidity-crisis'
  | 'pharma-safety-scandal'
  | 'geopolitical-oil-shock'
  | 'global-recession';

export type NewsImpactStrength = 'STRONG_UP' | 'MODERATE_UP' | 'SLIGHT_UP' | 'NO_IMPACT' | 'SLIGHT_DOWN' | 'MODERATE_DOWN' | 'SHARP_DOWN';

// Maps impact strength to a numeric multiplier (applied to stock volatility)
export const IMPACT_MULTIPLIERS: Record<NewsImpactStrength, number> = {
  STRONG_UP:     +0.12,
  MODERATE_UP:   +0.07,
  SLIGHT_UP:     +0.03,
  NO_IMPACT:      0.00,
  SLIGHT_DOWN:   -0.03,
  MODERATE_DOWN: -0.07,
  SHARP_DOWN:    -0.13,
};

export interface StockImpact {
  ticker: StockId;
  strength: NewsImpactStrength;
}

export interface NewsEventConfig {
  id: NewsEventId;
  headline: string;
  description: string;
  type: 'POSITIVE' | 'NEGATIVE' | 'MIXED';
  durationSeconds: number;   // 900 = 15 minutes
  affectedStocks: StockImpact[];
}

// Active news event state — stored in Firestore at simulation/activeEvent
export interface ActiveNewsEvent {
  eventId: NewsEventId;
  headline: string;
  description: string;
  type: 'POSITIVE' | 'NEGATIVE' | 'MIXED';
  triggeredAt: any;          // Firestore Timestamp
  expiresAt: any;            // Firestore Timestamp
  durationSeconds: number;
  affectedStocks: StockImpact[];
  triggeredByAdminUid: string;
  isExpired: boolean;
}

// ------------------------------------------------------------
// USERS / PARTICIPANTS
// ------------------------------------------------------------

export type UserRole = 'admin' | 'participant';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  currentCash: number;
  startingCash: number;
  portfolioValue: number;   // currentCash + value of all holdings
  totalPnL: number;         // portfolioValue - startingCash
  totalPnLPercent: number;
  createdAt: any;
  lastActive?: any;
}

// ------------------------------------------------------------
// HOLDINGS
// ------------------------------------------------------------

export interface Holding {
  id: string;              // Firestore document ID
  userId: string;
  stockId: string;         // Firestore stock document ID
  ticker: StockId;
  quantity: number;
  averageBuyPrice: number;
  currentValue: number;    // quantity × current price
  unrealizedPnL: number;   // currentValue - (quantity × averageBuyPrice)
}

// ------------------------------------------------------------
// TRANSACTIONS
// ------------------------------------------------------------

export type TransactionType = 'BUY' | 'SELL';

export interface Transaction {
  id: string;
  userId: string;
  stockId: string;
  ticker: StockId;
  type: TransactionType;
  quantity: number;
  price: number;           // Price per share at time of trade
  totalAmount: number;     // quantity × price
  cashBefore: number;
  cashAfter: number;
  activeNewsEventId: string | null;  // Which news event was active during this trade (M3 requirement)
  timestamp: any;          // Firestore Timestamp
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
}

// ------------------------------------------------------------
// PRICE HISTORY
// ------------------------------------------------------------

export interface PriceHistoryEntry {
  stockId: string;
  ticker: StockId;
  price: number;
  timestamp: any;            // Firestore Timestamp
  activeNewsEventId?: string | null;
}

// ------------------------------------------------------------
// FIRESTORE COLLECTION PATHS — use these constants everywhere
// so no one hardcodes a different string by mistake
// ------------------------------------------------------------

export const COLLECTIONS = {
  USERS: 'users',
  STOCKS: 'stocks',
  HOLDINGS: 'holdings',
  TRANSACTIONS: 'transactions',
  NEWS: 'news',
  PRICE_HISTORY: 'price_history',
  SIMULATION: 'simulation',
} as const;

export const SIMULATION_DOCS = {
  CONFIG: 'config',
  HEARTBEAT: 'heartbeat',
  ACTIVE_EVENT: 'activeEvent',
} as const;
