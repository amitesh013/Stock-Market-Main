import { useEffect, useState } from 'react';
import { useSession } from './session';

// The session config (see lib/session.tsx) carries `activeNewsEvent` = the raw
// `sessions/{sessionId}/meta/activeEvent` doc: { eventId, headline, description, type: 'POSITIVE' | 'NEGATIVE' | 'MIXED',
// affectedStocks: [{ ticker, strength: 'STRONG_UP' | ... | 'NO_IMPACT' | ... | 'SHARP_DOWN' }], triggeredAt, expiresAt, isExpired }.

export type MarketMode = 'NORMAL' | 'NEWS_EVENT';

export interface AffectedStock {
  ticker: string;
  direction: 'UP' | 'DOWN';
  strength?: string;
}

export interface ActiveNewsEvent {
  eventId: string;
  headline: string;
  description: string;
  sentiment: 'POSITIVE' | 'NEGATIVE';
  affectedStocks: AffectedStock[];
  triggeredAtMs: number;
  expiresAtMs: number;
}

export interface MarketState {
  status: string;
  mode: MarketMode;
  activeEvent: ActiveNewsEvent | null;
  config: any;
}

export const toMillis = (v: any): number => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'number') return v;
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
};

function parseAffected(list: any): AffectedStock[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => s?.ticker && s.strength !== 'NO_IMPACT')
    .map((s) => ({
      ticker: String(s.ticker),
      direction: s.direction === 'DOWN' || String(s.strength || '').includes('DOWN') ? 'DOWN' : 'UP',
    }));
}

function parseActiveEvent(raw: any): ActiveNewsEvent | null {
  if (!raw || !raw.headline) return null;
  const tone = raw.type || raw.sentiment;
  const expiresAtMs = toMillis(raw.expiresAt);
  return {
    eventId: raw.eventId || raw.id || '',
    headline: raw.headline,
    description: raw.description || '',
    sentiment: tone === 'NEGATIVE' ? 'NEGATIVE' : 'POSITIVE',
    affectedStocks: parseAffected(raw.affectedStocks),
    triggeredAtMs: toMillis(raw.triggeredAt),
    // An event ended early by the admin is flagged isExpired before its scheduled expiry.
    expiresAtMs: raw.isExpired ? Math.min(expiresAtMs || Date.now(), Date.now()) : expiresAtMs,
  };
}

/** The event on the session document, whether or not its window has passed. */
export function configuredEvent(config: any): ActiveNewsEvent | null {
  return parseActiveEvent(config?.activeNewsEvent);
}

export function useMarketState(): MarketState {
  const { config, sessionStatus } = useSession();
  const [now, setNow] = useState(Date.now());

  const parsed = configuredEvent(config);

  // Tick so the event drops out of the UI the moment it expires, even before the backend clears it.
  useEffect(() => {
    if (!parsed) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [parsed?.eventId, parsed?.expiresAtMs]);

  const activeEvent = parsed && parsed.expiresAtMs > now ? parsed : null;

  return {
    status: sessionStatus,
    mode: activeEvent ? 'NEWS_EVENT' : 'NORMAL',
    activeEvent,
    config,
  };
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
