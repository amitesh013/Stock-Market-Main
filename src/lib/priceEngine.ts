// M2: pure price engine. No Firebase in here, so it is easy to test.

export interface SimStockConfig {
  ticker: string;       // key used by news events, e.g. "AAPL"
  volatility: number;   // existing stocks.volatility field (annual-style number, e.g. 0.20)
  liquidity: number;    // shares needed to move the price about 1%
}

export interface ActiveNews {
  targetPct: Record<string, number>; // ticker -> total move over the whole event, e.g. 0.08 = +8%
  startedAt: number;                 // ms timestamp
  endsAt: number;                    // ms timestamp
}

export const VOL_SCALE = 0.01;        // turns annual-style volatility into a per-tick move. Tune this.
export const DEFAULT_LIQUIDITY = 500; // used when a stock has no liquidity field. Tune this.
const MAX_PRESSURE_MOVE = 0.02;       // trading alone can move a price at most 2% per tick

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function gaussian(rand: () => number): number {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Firestore may hand back a number or a Timestamp object. Return milliseconds either way.
export function toMillis(v: any): number {
  if (typeof v === 'number') return v;
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  return 0;
}

export function nextPrice(
  price: number,
  cfg: SimStockConfig,
  netShares: number,        // shares bought minus shares sold since the last tick
  news: ActiveNews | null,
  lastTickMs: number,
  nowMs: number,
  rand: () => number = Math.random
): number {
  const noise = gaussian(rand) * cfg.volatility * VOL_SCALE;
  const pressure = clamp((netShares / cfg.liquidity) * 0.01, -MAX_PRESSURE_MOVE, MAX_PRESSURE_MOVE);

  // News: spread the event's total move evenly over its duration, based on how much of
  // the event fell inside this tick. When the event is over this stays 0, and the price
  // simply carries on from where it is (no reset).
  let newsDrift = 0;
  const target = news?.targetPct[cfg.ticker];
  if (news && target !== undefined && target > -1) {
    const duration = news.endsAt - news.startedAt;
    const overlap = Math.min(nowMs, news.endsAt) - Math.max(lastTickMs, news.startedAt);
    if (duration > 0 && overlap > 0) {
      newsDrift = Math.log(1 + target) * (overlap / duration);
    }
  }

  const next = price * Math.exp(noise + pressure + newsDrift);
  return Math.max(0.01, Math.round(next * 100) / 100);
}
