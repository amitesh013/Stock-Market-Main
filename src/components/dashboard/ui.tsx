import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const T = {
  bg: '#06090B',
  surface: '#0D1419',
  surface2: '#111A20',
  border: '#26343C',
  text: '#F3F5F4',
  text2: '#A4AFB4',
  muted: '#65737A',
  surface3: '#162129',
  borderStrong: '#34444D',
  // Semantic accents: blue = you / interaction, green = up, red = down, cyan = live data, gold = leader / finish.
  gold: '#D5A653',
  positive: '#39FF88',
  positive2: '#20C978',
  negative: '#FF4D5A',
  negative2: '#D9364A',
  user: '#3B82FF',
  user2: '#2563EB',
  cyan: '#00D9FF',
  cyan2: '#00AFCB',
  chart: '#00AFCB',
};

/** Small, tight glow for status dots, markers and chart accents only. */
export const glow = (color: string, px = 8) => `0 0 ${px}px ${color}99`;

export function formatUSD(val: number, digits = 2): string {
  return `$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatSignedUSD(val: number, digits = 2): string {
  return `${val >= 0 ? '+' : '-'}${formatUSD(val, digits)}`;
}

export function formatPct(val: number, digits = 2): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(digits)}%`;
}

export function toneColor(val: number): string {
  return val >= 0 ? T.positive : T.negative;
}

export function Card({ children, className = '', onClick }: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <section
      onClick={onClick}
      className={`card-glow bg-[#0D1419]/85 rounded-md border border-[#26343C] p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function Eyebrow({ children, color = T.text2 }: { children: React.ReactNode; color?: string }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>
      {children}
    </h2>
  );
}

export function CardTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <Eyebrow>{children}</Eyebrow>
      {right}
    </div>
  );
}

export function ViewLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      onClick={(e) => e.stopPropagation()}
      className="group/link shrink-0 whitespace-nowrap inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A4AFB4] hover:text-[#F3F5F4] transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
    >
      {children}
      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5" />
    </Link>
  );
}

export function MiniSparkline({ values, width = 72, height = 24, positive, color }: {
  values: number[];
  width?: number;
  height?: number;
  positive: boolean;
  color?: string;
}) {
  const data = values.length >= 2 ? values : [values[0] ?? 0, values[0] ?? 0];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 2) + 1;
    const y = max === min ? height / 2 : height - 2 - ((v - min) / range) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const stroke = color ?? (positive ? T.positive : T.negative);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PageHeader({ title, description, children }: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[#F3F5F4]">{title}</h1>
        {description && <p className="text-sm text-[#A4AFB4] mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}
