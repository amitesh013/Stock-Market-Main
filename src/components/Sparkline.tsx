import React, { useId } from 'react';

interface SparklineProps {
  prices: number[];
  width?: number;
  height?: number;
  isPositive?: boolean;
  className?: string;
  showDot?: boolean;
}

export default function Sparkline({
  prices,
  width = 100,
  height = 32,
  isPositive = true,
  className = '',
  showDot = true,
}: SparklineProps) {
  const gradientId = useId();

  // Ensure we have at least a few points to render a nice curve
  let data = prices && prices.length > 0 ? prices : [100, 100];
  if (data.length === 1) {
    data = [data[0] * 0.995, data[0]];
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  const padX = 2;
  const padY = 4;
  const usableWidth = width - padX * 2;
  const usableHeight = height - padY * 2;

  const points = data.map((val, idx) => {
    const x = padX + (idx / (data.length - 1)) * usableWidth;
    const y = height - padY - ((val - min) / range) * usableHeight;
    return { x, y };
  });

  // Create smooth cubic bezier curve
  let pathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) * 0.5;
    const cp1y = p0.y;
    const cp2x = p0.x + (p1.x - p0.x) * 0.5;
    const cp2y = p1.y;
    pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;

  const strokeColor = isPositive ? '#10b981' : '#f43f5e';
  const fillColor = isPositive ? '#10b981' : '#f43f5e';
  const lastPoint = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible select-none shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Gradient Fill under curve */}
      <path d={areaD} fill={`url(#${gradientId})`} />

      {/* Main Sparkline Stroke */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Current/Latest price point */}
      {showDot && (
        <>
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="3"
            fill={strokeColor}
            className="transition-all duration-300"
          />
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="6"
            fill={strokeColor}
            opacity="0.25"
            className="animate-ping"
          />
        </>
      )}
    </svg>
  );
}
