import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { executeTrade } from '../lib/trade';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface TradeModalProps {
  stock: any;
  initialType?: 'BUY' | 'SELL';
  onClose: () => void;
}

export default function TradeModal({ stock, initialType = 'BUY', onClose }: TradeModalProps) {
  const { user, userData } = useAuth();
  const [type, setType] = useState<'BUY' | 'SELL'>(initialType);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [holding, setHolding] = useState<{ quantity: number; averageBuyPrice: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    const holdingRef = doc(db, 'holdings', `${user.uid}_${stock.id}`);
    const unsub = onSnapshot(holdingRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHolding({
          quantity: Number(data.quantity) || 0,
          averageBuyPrice: Number(data.averageBuyPrice) || 0,
        });
      } else {
        setHolding(null);
      }
    });
    return unsub;
  }, [user, stock.id]);

  const numQty = Number(quantity) || 0;
  const currentPrice = Number(stock.currentPrice) || 0;
  const estimatedTotal = numQty * currentPrice;
  const currentCash = Number(userData?.currentCash) || 0;
  const sharesOwned = holding?.quantity || 0;
  const avgCost = holding?.averageBuyPrice || 0;

  const maxAffordable = currentPrice > 0 ? Math.floor(currentCash / currentPrice) : 0;

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numQty <= 0) return;

    if (type === 'BUY' && estimatedTotal > currentCash) {
      setError(`Insufficient cash balance ($${currentCash.toFixed(2)} available)`);
      return;
    }

    if (type === 'SELL' && numQty > sharesOwned) {
      setError(`You only own ${sharesOwned} shares of ${stock.ticker}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await executeTrade(stock.id, type, numQty);
      setSuccessMsg(`Successfully ${type === 'BUY' ? 'bought' : 'sold'} ${numQty} shares of ${stock.ticker}!`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Trade failed to execute');
    } finally {
      setLoading(false);
    }
  };

  const handleMaxClick = () => {
    if (type === 'BUY') {
      setQuantity(maxAffordable > 0 ? maxAffordable : '');
    } else {
      setQuantity(sharesOwned > 0 ? sharesOwned : '');
    }
    setError('');
  };

  const isBuy = type === 'BUY';
  const cannotAfford = isBuy && estimatedTotal > currentCash;
  const cannotSell = !isBuy && (sharesOwned <= 0 || numQty > sharesOwned);
  const isValidQty = numQty > 0;
  const canSubmit = isValidQty && !cannotAfford && !cannotSell && !loading && !successMsg;

  // Potential PnL on sell
  const sellPnL = !isBuy && avgCost > 0 && numQty > 0 
    ? (currentPrice - avgCost) * numQty 
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-zinc-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-zinc-900 tracking-tight">{stock.ticker}</h2>
              <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-zinc-200 text-zinc-700">
                ${currentPrice.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">{stock.name}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {successMsg ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto animate-bounce" />
            <h3 className="text-lg font-bold text-zinc-900">Order Executed</h3>
            <p className="text-sm text-zinc-600">{successMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleTrade} className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Order Type Toggle */}
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => { setType('BUY'); setError(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  isBuy ? 'bg-white text-blue-600 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => { setType('SELL'); setError(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  !isBuy ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Sell
              </button>
            </div>

            {/* Position Summary Card */}
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 text-xs space-y-1.5">
              <div className="flex justify-between text-zinc-600">
                <span>Available Cash:</span>
                <span className="font-semibold text-zinc-900">${currentCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Shares Owned:</span>
                <span className="font-semibold text-zinc-900">
                  {sharesOwned} shares {avgCost > 0 && `(@ $${avgCost.toFixed(2)})`}
                </span>
              </div>
              {!isBuy && sharesOwned === 0 && (
                <div className="text-amber-600 text-xs font-medium pt-1">
                  You do not currently own any shares of {stock.ticker}.
                </div>
              )}
            </div>

            {/* Quantity Input with Max Button */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                  Number of Shares
                </label>
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="text-xs text-blue-600 font-medium hover:underline hover:text-blue-700 focus:outline-none"
                >
                  Max ({isBuy ? maxAffordable : sharesOwned})
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max={!isBuy ? sharesOwned : undefined}
                  step="1"
                  required
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : '';
                    setQuantity(val);
                    setError('');
                  }}
                  className="w-full px-3.5 py-2.5 text-base font-semibold border border-zinc-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            {/* Order Preview */}
            <div className="pt-3 border-t border-zinc-100 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Price per share</span>
                <span className="font-medium text-zinc-900">${currentPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span className="text-zinc-900">{isBuy ? 'Estimated Total Cost' : 'Estimated Proceeds'}</span>
                <span className={cannotAfford ? 'text-red-600' : 'text-zinc-900'}>
                  ${estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {!isBuy && numQty > 0 && avgCost > 0 && (
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-500">Realized P&L</span>
                  <span className={sellPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {sellPnL >= 0 ? '+' : ''}${sellPnL.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full py-3 rounded-xl font-semibold text-white shadow-xs transition-all ${
                isBuy
                  ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300'
                  : 'bg-zinc-900 hover:bg-zinc-800 active:bg-black disabled:bg-zinc-400'
              } disabled:cursor-not-allowed`}
            >
              {loading
                ? 'Executing Order...'
                : cannotAfford
                ? 'Insufficient Cash'
                : cannotSell
                ? sharesOwned === 0 ? 'No Shares to Sell' : 'Exceeds Owned Shares'
                : isBuy
                ? `Buy ${numQty > 0 ? `${numQty} ` : ''}${stock.ticker}`
                : `Sell ${numQty > 0 ? `${numQty} ` : ''}${stock.ticker}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
