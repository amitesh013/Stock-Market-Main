import React, { memo } from 'react';
import { Star } from 'lucide-react';
import { LiveStock } from '../../lib/liveData';
import { AffectedStock } from '../../lib/marketState';
import { MiniSparkline, T, toneColor } from '../dashboard/ui';
import TickerBadge from './TickerBadge';
import { Side, dayRange, formatPrice, formatVolume, volumeOf } from './marketUtils';

export const ROW_GRID =
  'grid items-center gap-3 grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[minmax(0,1fr)_auto_64px_auto] ' +
  'md:grid-cols-[112px_minmax(0,1fr)_84px_72px_88px_auto] xl:grid-cols-[112px_minmax(0,1fr)_84px_72px_88px_116px_64px_auto]';

interface WatchlistRowProps {
  stock: LiveStock;
  selected: boolean;
  starred: boolean;
  tradingOpen: boolean;
  impact?: AffectedStock;
  onSelect: (stock: LiveStock) => void;
  onTrade: (stock: LiveStock, side: Side) => void;
  onToggleStar: (ticker: string) => void;
}

function WatchlistRow({ stock, selected, starred, tradingOpen, impact, onSelect, onTrade, onToggleStar }: WatchlistRowProps) {
  const up = stock.changePercent >= 0;
  const { low, high } = dayRange(stock);
  const pct = `${up ? '+' : ''}${stock.changePercent.toFixed(2)}%`;

  const tradeBtn = (side: Side) => {
    const c = side === 'BUY' ? T.positive : T.negative;
    return (
      <button
        type="button"
        disabled={!tradingOpen}
        onClick={(e) => { e.stopPropagation(); onTrade(stock, side); }}
        title={tradingOpen ? `${side === 'BUY' ? 'Buy' : 'Sell'} ${stock.ticker}` : 'Market closed'}
        className="h-7 px-2.5 rounded-md text-[11px] font-semibold border transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:brightness-125"
        style={{ color: c, borderColor: `${c}66`, backgroundColor: `${c}1A` }}
      >
        {side === 'BUY' ? 'Buy' : 'Sell'}
      </button>
    );
  };

  return (
    <li
      onClick={() => onSelect(stock)}
      aria-selected={selected}
      className={`${ROW_GRID} px-4 py-2 cursor-pointer transition-colors duration-200 ${
        selected ? 'bg-[#111A20] shadow-[inset_2px_0_0_#00D9FF]' : 'hover:bg-[#111A20]/60'
      }`}
    >
      {/* Symbol */}
      <div className="flex items-center gap-2.5 min-w-0">
        <TickerBadge ticker={stock.ticker} size={26} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-[#F3F5F4]">{stock.ticker}</span>
            {impact && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                title="Mentioned in the live news event"
                style={{ backgroundColor: T.cyan }}
              />
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleStar(stock.ticker); }}
              aria-label={starred ? `Remove ${stock.ticker} from watchlist` : `Add ${stock.ticker} to watchlist`}
              className="p-0.5 rounded cursor-pointer"
            >
              <Star className="w-3 h-3" style={{ color: starred ? T.cyan : T.muted, fill: starred ? T.cyan : 'none' }} />
            </button>
          </div>
          <div className="md:hidden text-[11px] text-[#65737A] truncate">{stock.name}</div>
        </div>
      </div>

      {/* Company */}
      <div className="hidden md:block text-xs text-[#A4AFB4] truncate">{stock.name}</div>

      {/* Price / change (md+) */}
      <div className="hidden md:block text-right text-[13px] tabular-nums text-[#F3F5F4]">${formatPrice(stock.currentPrice)}</div>
      <div className="hidden md:block text-right text-xs font-semibold tabular-nums" style={{ color: toneColor(stock.changePercent) }}>{pct}</div>

      {/* Price / change (mobile) */}
      <div className="md:hidden text-right">
        <div className="text-[13px] tabular-nums text-[#F3F5F4]">${formatPrice(stock.currentPrice)}</div>
        <div className="text-[11px] font-semibold tabular-nums" style={{ color: toneColor(stock.changePercent) }}>{pct}</div>
      </div>

      {/* Trend */}
      <div className="hidden sm:flex justify-center">
        <MiniSparkline values={stock.history} width={64} height={22} positive={up} />
      </div>

      {/* Day range + volume (xl) */}
      <div className="hidden xl:block text-right text-xs tabular-nums text-[#A4AFB4]">
        {formatPrice(low)} – {formatPrice(high)}
      </div>
      <div className="hidden xl:block text-right text-xs tabular-nums text-[#A4AFB4]">{formatVolume(volumeOf(stock))}</div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1.5">
        {tradeBtn('BUY')}
        {tradeBtn('SELL')}
      </div>
    </li>
  );
}

export default memo(WatchlistRow);
