import React from 'react';
import { Star } from 'lucide-react';
import { LiveStock } from '../../lib/liveData';
import { AffectedStock } from '../../lib/marketState';
import { T, toneColor } from '../dashboard/ui';
import TickerBadge from './TickerBadge';
import { changeAbs, dayRange, formatPrice, formatVolume, volumeOf } from './marketUtils';

interface StockDetailHeaderProps {
  stock: LiveStock;
  starred: boolean;
  onToggleStar: () => void;
  impact?: AffectedStock;
}

export default function StockDetailHeader({ stock, starred, onToggleStar, impact }: StockDetailHeaderProps) {
  const chg = changeAbs(stock);
  const { low, high } = dayRange(stock);
  const stats = [
    { label: 'Day High', value: `$${formatPrice(high)}` },
    { label: 'Day Low', value: `$${formatPrice(low)}` },
    { label: 'Volume', value: formatVolume(volumeOf(stock)) },
    { label: 'Sector', value: stock.sector || '—' },
  ];

  return (
    <div key={stock.id} className="mk-fade flex flex-wrap items-center gap-x-8 gap-y-3">
      <div className="flex items-center gap-3 min-w-0">
        <TickerBadge ticker={stock.ticker} size={36} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-[#F3F5F4]">{stock.ticker}</h2>
            {impact && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-px rounded border"
                style={{ color: T.cyan, borderColor: `${T.cyan}55` }}
              >
                In the news
              </span>
            )}
          </div>
          <div className="text-xs text-[#A4AFB4] truncate max-w-[180px]">{stock.name}</div>
        </div>
      </div>

      <div>
        <div className="text-2xl font-semibold tabular-nums tracking-tight text-[#F3F5F4]">${formatPrice(stock.currentPrice)}</div>
        <div className="text-xs font-semibold tabular-nums" style={{ color: toneColor(chg) }}>
          {chg >= 0 ? '+' : '-'}${formatPrice(Math.abs(chg))} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-2 flex-1 min-w-0">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#65737A]">{s.label}</dt>
            <dd className="text-[13px] font-medium tabular-nums text-[#F3F5F4] truncate max-w-[160px]">{s.value}</dd>
          </div>
        ))}
      </dl>

      <button
        onClick={onToggleStar}
        aria-pressed={starred}
        aria-label={starred ? `Remove ${stock.ticker} from watchlist` : `Add ${stock.ticker} to watchlist`}
        title={starred ? 'Remove from watchlist' : 'Add to watchlist'}
        className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg border border-[#26343C] hover:border-[#4A5A63] transition-colors cursor-pointer"
      >
        <Star className="w-4 h-4" style={{ color: starred ? T.cyan : T.muted, fill: starred ? T.cyan : 'none' }} />
      </button>
    </div>
  );
}
