import { doc, runTransaction, serverTimestamp, collection, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { COLLECTIONS, SESSION_SUBCOLLECTIONS, SESSION_META_DOCS } from './shared-types';

export async function executeTrade(
  sessionId: string,
  stockId: string,
  type: 'BUY' | 'SELL',
  quantity: number
) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const uid = user.uid;

  if (!sessionId) throw new Error('No active session — cannot trade');
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive whole number');
  }

  return await runTransaction(db, async (transaction) => {
    // 1. Check SESSION status (not legacy simulation/config)
    const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
    const sessionDoc = await transaction.get(sessionRef);
    if (!sessionDoc.exists()) throw new Error('Session not found');

    const sessionData = sessionDoc.data();
    if (sessionData.status === 'LOBBY') {
      throw new Error('Market is not open yet — session has not started.');
    } else if (sessionData.status === 'PAUSED') {
      throw new Error('Trading is temporarily paused by the market administrator.');
    } else if (sessionData.status === 'ENDED') {
      throw new Error('Trading has ended! The session is complete and final rankings are frozen.');
    } else if (sessionData.status !== 'RUNNING') {
      throw new Error(`Trading is unavailable (status: ${sessionData.status})`);
    }

    const activeNewsEventId: string | null = sessionData.activeNewsEventId || null;

    // 2. Get stock from session subcollection
    const stockRef = doc(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.STOCKS, stockId);
    const stockDoc = await transaction.get(stockRef);
    if (!stockDoc.exists() || !stockDoc.data().isActive) {
      throw new Error('Stock is not currently available for trading');
    }
    const stockData = stockDoc.data();
    const stockPrice = Number(stockData.currentPrice);
    if (!stockPrice || stockPrice <= 0) throw new Error('Invalid stock market price');
    const totalCost = Math.round(stockPrice * quantity * 100) / 100;

    // 3. Get user portfolio from session subcollection
    const portfolioRef = doc(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.PORTFOLIOS, uid);
    const portfolioDoc = await transaction.get(portfolioRef);
    if (!portfolioDoc.exists()) {
      throw new Error('You have not joined this session yet. Please join via the session code first.');
    }
    const currentCash = Number(portfolioDoc.data().currentCash);

    // 4. Get holding
    const holdingId = `${uid}_${stockId}`;
    const holdingRef = doc(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.HOLDINGS, holdingId);
    const holdingDoc = await transaction.get(holdingRef);

    let holdingQty = 0;
    let avgBuyPrice = 0;
    if (holdingDoc.exists()) {
      holdingQty = Number(holdingDoc.data().quantity) || 0;
      avgBuyPrice = Number(holdingDoc.data().averageBuyPrice) || 0;
    }

    let newCash = currentCash;
    let newQty = holdingQty;
    let newAvgPrice = avgBuyPrice;

    if (type === 'BUY') {
      if (currentCash < totalCost) {
        throw new Error(
          `Insufficient funds: Order requires $${totalCost.toFixed(2)}, available cash is $${currentCash.toFixed(2)}`
        );
      }
      newCash = currentCash - totalCost;
      newQty = holdingQty + quantity;
      newAvgPrice = ((holdingQty * avgBuyPrice) + totalCost) / newQty;
    } else if (type === 'SELL') {
      if (holdingQty < quantity) {
        throw new Error(
          `Insufficient shares: You own ${holdingQty} shares of ${stockData.ticker}, but tried to sell ${quantity}`
        );
      }
      newCash = currentCash + totalCost;
      newQty = holdingQty - quantity;
      if (newQty === 0) newAvgPrice = 0;
    } else {
      throw new Error('Invalid order type');
    }

    newCash = Math.round(newCash * 100) / 100;
    newAvgPrice = Math.round(newAvgPrice * 100) / 100;

    // Update portfolio cash
    transaction.update(portfolioRef, { currentCash: newCash, lastUpdated: serverTimestamp() });

    // Update or delete holding
    if (newQty === 0) {
      transaction.delete(holdingRef);
    } else {
      transaction.set(holdingRef, {
        userId: uid,
        sessionId,
        stockId,
        ticker: stockData.ticker || '',
        name: stockData.name || '',
        quantity: newQty,
        averageBuyPrice: newAvgPrice,
      }, { merge: true });
    }

    // Record transaction in session subcollection
    const txRef = doc(collection(db, COLLECTIONS.SESSIONS, sessionId, SESSION_SUBCOLLECTIONS.TRANSACTIONS));
    transaction.set(txRef, {
      userId: uid,
      sessionId,
      stockId,
      ticker: stockData.ticker || '',
      type,
      quantity,
      priceAtExecution: stockPrice,
      totalAmount: totalCost,
      cashBefore: currentCash,
      cashAfter: newCash,
      activeNewsEventId,
      timestamp: serverTimestamp(),
    });

    return {
      success: true,
      ticker: stockData.ticker,
      type,
      quantity,
      price: stockPrice,
      totalCost,
      newCash,
    };
  });
}
