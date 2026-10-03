import { doc, runTransaction, serverTimestamp, collection, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { COLLECTIONS, SIMULATION_DOCS } from './shared-types';

export async function executeTrade(stockId: string, type: 'BUY' | 'SELL', quantity: number) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const uid = user.uid;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive whole number');
  }

  return await runTransaction(db, async (transaction) => {
    // 1. Check simulation status
    const simRef = doc(db, COLLECTIONS.SIMULATION, SIMULATION_DOCS.CONFIG);
    const simDoc = await transaction.get(simRef);
    if (!simDoc.exists()) throw new Error('Simulation configuration not found');

    const simData = simDoc.data();
    if (simData.status === 'NOT_STARTED') {
      throw new Error('Market is currently closed. Simulation has not started yet.');
    } else if (simData.status === 'PAUSED') {
      throw new Error('Trading is temporarily paused by the market administrator.');
    } else if (simData.status === 'COMPLETED') {
      throw new Error('Trading has ended! The simulation is complete and final rankings are frozen.');
    } else if (simData.status !== 'RUNNING') {
      throw new Error(`Trading is unavailable (status: ${simData.status})`);
    }

    if (simData.endTime?.toMillis && Date.now() >= simData.endTime.toMillis()) {
      throw new Error('Simulation time has expired. Trading is now locked.');
    }

    // Capture which news event was active during this trade (M3 requirement)
    const activeNewsEventId: string | null = simData.activeNewsEventId || null;

    // 2. Get stock
    const stockRef = doc(db, COLLECTIONS.STOCKS, stockId);
    const stockDoc = await transaction.get(stockRef);
    if (!stockDoc.exists() || !stockDoc.data().isActive) {
      throw new Error('Stock is not currently available for trading');
    }
    const stockData = stockDoc.data();
    const stockPrice = Number(stockData.currentPrice);
    if (!stockPrice || stockPrice <= 0) throw new Error('Invalid stock market price');
    const totalCost = Math.round(stockPrice * quantity * 100) / 100;

    // 3. Get user
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw new Error('User account not found');
    const currentCash = Number(userDoc.data().currentCash);

    // 4. Get holding
    const holdingId = `${uid}_${stockId}`;
    const holdingRef = doc(db, COLLECTIONS.HOLDINGS, holdingId);
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
        throw new Error(`Insufficient funds: Order requires $${totalCost.toFixed(2)}, available cash is $${currentCash.toFixed(2)}`);
      }
      newCash = currentCash - totalCost;
      newQty = holdingQty + quantity;
      newAvgPrice = ((holdingQty * avgBuyPrice) + totalCost) / newQty;
    } else if (type === 'SELL') {
      if (holdingQty < quantity) {
        throw new Error(`Insufficient shares: You own ${holdingQty} shares of ${stockData.ticker}, but tried to sell ${quantity}`);
      }
      newCash = currentCash + totalCost;
      newQty = holdingQty - quantity;
      if (newQty === 0) newAvgPrice = 0;
    } else {
      throw new Error('Invalid order type');
    }

    newCash = Math.round(newCash * 100) / 100;
    newAvgPrice = Math.round(newAvgPrice * 100) / 100;

    // Update user cash
    transaction.update(userRef, { currentCash: newCash });

    // Update or delete holding
    if (newQty === 0) {
      transaction.delete(holdingRef);
    } else {
      transaction.set(holdingRef, {
        userId: uid,
        stockId,
        ticker: stockData.ticker || '',
        name: stockData.name || '',
        quantity: newQty,
        averageBuyPrice: newAvgPrice,
      }, { merge: true });
    }

    // Record transaction — includes activeNewsEventId for audit trail
    const txRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
    transaction.set(txRef, {
      userId: uid,
      stockId,
      ticker: stockData.ticker || '',
      type,
      quantity,
      priceAtExecution: stockPrice,
      totalAmount: totalCost,
      cashBefore: currentCash,
      cashAfter: newCash,
      activeNewsEventId,   // Which news event was active during this trade
      timestamp: serverTimestamp(),
      resultingCashBalance: newCash,
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
