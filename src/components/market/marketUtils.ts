import { LiveStock } from '../../lib/liveData';

export type SortKey = 'GAINERS' | 'LOSERS' | 'PRICE' | 'VOLUME';
export type Side = 'BUY' | 'SELL';

export const CATEGORIES = ['All', 'Tech', 'Banking', 'Pharma', 'Defence', 'Energy', 'Consumer'] as const;
export type Category = typeof CATEGORIES[number];

const CATEGORY_MATCH: Record<Exclude<Category, 'All'>, RegExp> = {
  Tech: /tech|semiconductor|software|communication|internet/i,
  Banking: /bank|financ|insurance/i,
  Pharma: /pharma|health|bio|medical/i,
  Defence: /defen|aerospace|industrial/i,
  Energy: /energy|oil|gas|utilit/i,
  Consumer: /consumer|retail|staples|discretionary|food/i,
};

export function categoryOf(stock: LiveStock): Category | null {
  const sector = stock.sector || '';
  for (const [cat, re] of Object.entries(CATEGORY_MATCH)) {
    if (re.test(sector)) return cat as Category;
  }
  return null;
}

export function volumeOf(stock: LiveStock): number {
  return Number(stock.sessionVolume ?? stock.volume ?? 0) || 0;
}

export function formatVolume(v: number): string {
  if (!v) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

export function formatPrice(v: number): string {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dayRange(stock: LiveStock): { low: number; high: number } {
  const p = stock.currentPrice;
  return {
    low: Number(stock.dayLow) || Math.min(p, stock.dayOpen),
    high: Number(stock.dayHigh) || Math.max(p, stock.dayOpen),
  };
}

export function changeAbs(stock: LiveStock): number {
  return stock.change !== undefined ? Number(stock.change) : stock.currentPrice - stock.dayOpen;
}

const BADGE_TONES = ['#3B82FF', '#8C7A5B', '#5F8A7A', '#8A6F8F', '#7D8A5F', '#8F6F62', '#5F7A8A'];

export function badgeTone(ticker: string): string {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) | 0;
  return BADGE_TONES[Math.abs(h) % BADGE_TONES.length];
}

export function sortStocks(list: LiveStock[], sort: SortKey): LiveStock[] {
  const out = [...list];
  out.sort((a, b) => {
    if (sort === 'GAINERS') return b.changePercent - a.changePercent;
    if (sort === 'LOSERS') return a.changePercent - b.changePercent;
    if (sort === 'PRICE') return b.currentPrice - a.currentPrice;
    return volumeOf(b) - volumeOf(a);
  });
  return out;
}
