import React from 'react';
import { badgeTone } from './marketUtils';

export default function TickerBadge({ ticker, size = 28 }: { ticker: string; size?: number }) {
  const tone = badgeTone(ticker);
  return (
    <span
      aria-hidden="true"
      className="shrink-0 inline-flex items-center justify-center rounded-full font-semibold border"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        color: tone,
        borderColor: `${tone}55`,
        backgroundColor: `${tone}14`,
      }}
    >
      {ticker.charAt(0)}
    </span>
  );
}
