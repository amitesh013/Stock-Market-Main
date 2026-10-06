import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, SESSION_SUBCOLLECTIONS } from './shared-types';

export interface PortfolioMetrics {
  cashBalance: number;
  holdingsValue: number;
  portfolioValue: number;
  pnl: number;
  returnPct: number;
}

export function calculatePortfolioMetrics(
  portfolio: Record<string, unknown> | undefined,
  holdings: Record<string, unknown>[],
  stocks: Record<string, Record<string, unknown>>,
): PortfolioMetrics {
  const startingCash = Number(portfolio?.startingCash) || 100000;
  const cashBalance = Number(portfolio?.currentCash) || 0;
  const holdingsValue = holdings.reduce((total, holding) => {
    const stock = stocks[String(holding.stockId)];
    const quantity = Number(holding.quantity) || 0;
    const currentPrice = Number(stock?.currentPrice) || 0;
    return total + quantity * currentPrice;
  }, 0);
  const portfolioValue = Math.round((cashBalance + holdingsValue) * 100) / 100;
  const pnl = portfolioValue - startingCash;

  return {
    cashBalance,
    holdingsValue,
    portfolioValue,
    pnl,
    returnPct: startingCash > 0 ? (pnl / startingCash) * 100 : 0,
  };
}

interface LivePortfolioState {
  portfolio: Record<string, unknown> | undefined;
  holdings: Record<string, unknown>[];
  stocks: Record<string, Record<string, unknown>>;
}

export function subscribeToLivePortfolio(
  sessionId: string,
  uid: string,
  onChange: (state: LivePortfolioState) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  let state: LivePortfolioState = { portfolio: undefined, holdings: [], stocks: {} };
  const emit = () => onChange(state);
  const reportError = (error: Error) => onError?.(error);

  const unsubPortfolio = onSnapshot(
    doc(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.PORTFOLIOS, uid),
    (snapshot) => {
      state = { ...state, portfolio: snapshot.exists() ? snapshot.data() : undefined };
      emit();
    },
    reportError,
  );
  const unsubHoldings = onSnapshot(
    query(
      collection(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.HOLDINGS),
      where('userId', '==', uid),
    ),
    (snapshot) => {
      state = { ...state, holdings: snapshot.docs.map((item) => item.data()) };
      emit();
    },
    reportError,
  );
  const unsubStocks = onSnapshot(
    collection(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.STOCKS),
    (snapshot) => {
      const stocks: Record<string, Record<string, unknown>> = {};
      snapshot.forEach((item) => { stocks[item.id] = item.data(); });
      state = { ...state, stocks };
      emit();
    },
    reportError,
  );

  return () => {
    unsubPortfolio();
    unsubHoldings();
    unsubStocks();
  };
}
