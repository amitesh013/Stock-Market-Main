import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useSession } from './session';
import { ActiveNewsEvent, AffectedStock, MarketState, configuredEvent, toMillis } from './marketState';
import { LiveStock } from './liveData';
import { categoryOf } from '../components/market/marketUtils';

export type EventStatus = 'ACTIVE' | 'UPCOMING' | 'COMPLETED';

// EVENT: windowed event from simulation/config.activeNewsEvent.
// BULLETIN: admin-published `news` doc (no impact window).
// SCHEDULED: optional simulation/config.nextNewsEvent.
export type EventSource = 'EVENT' | 'BULLETIN' | 'SCHEDULED';

export interface NewsEventItem {
  id: string;
  number: number;
  source: EventSource;
  headline: string;
  description: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | null;
  status: EventStatus;
  startMs: number | null;
  endMs: number | null;
  affected: AffectedStock[];
  marketWide: boolean;
  /** Configured price impact in percent (bulletins carry an `impact` fraction). */
  configuredImpactPct: number | null;
}

export interface NewsEventsState {
  events: NewsEventItem[];
  active: NewsEventItem | null;
  /** Most recent windowed event: the active one, or the last one that ended. */
  featured: NewsEventItem | null;
  next: NewsEventItem | null;
  marketStartMs: number | null;
  marketEndMs: number | null;
  now: number;
}

// Windowed events seen per competition session. The session doc only holds the current event, so this
// keeps ended events in the Past list after the backend replaces or clears it.
const seenEventsBySession = new Map<string, Map<string, ActiveNewsEvent>>();
const seenEventsFor = (sessionId: string) => {
  let m = seenEventsBySession.get(sessionId);
  if (!m) { m = new Map(); seenEventsBySession.set(sessionId, m); }
  return m;
};

const eventKey = (e: ActiveNewsEvent) => e.eventId || `${e.headline}|${e.triggeredAtMs}`;
const sameHeadline = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function fromConfigEvent(e: ActiveNewsEvent, now: number): Omit<NewsEventItem, 'number'> {
  const status: EventStatus =
    e.triggeredAtMs > now ? 'UPCOMING' : e.expiresAtMs > now ? 'ACTIVE' : 'COMPLETED';
  return {
    id: `event:${eventKey(e)}`,
    source: 'EVENT',
    headline: e.headline,
    description: e.description,
    sentiment: e.sentiment,
    status,
    startMs: e.triggeredAtMs || null,
    endMs: e.expiresAtMs || null,
    affected: e.affectedStocks.map((s) => ({ ...s, ticker: (s.ticker || '').toUpperCase() })),
    marketWide: false,
    configuredImpactPct: null,
  };
}

function fromBulletin(doc: any): Omit<NewsEventItem, 'number'> {
  const sentiment = doc.sentiment === 'BULLISH' ? 'POSITIVE' : doc.sentiment === 'BEARISH' ? 'NEGATIVE' : null;
  const ticker = String(doc.ticker || '').trim().toUpperCase();
  const impact = typeof doc.impact === 'number' ? doc.impact : null;
  const direction: 'UP' | 'DOWN' = impact !== null ? (impact >= 0 ? 'UP' : 'DOWN') : sentiment === 'NEGATIVE' ? 'DOWN' : 'UP';
  return {
    id: `news:${doc.id}`,
    source: 'BULLETIN',
    headline: doc.headline || '',
    description: doc.summary && doc.summary !== doc.headline ? doc.summary : '',
    sentiment,
    status: 'COMPLETED',
    startMs: toMillis(doc.timestamp) || null,
    endMs: null,
    affected: ticker && ticker !== 'ALL' ? [{ ticker, direction }] : [],
    marketWide: ticker === 'ALL',
    configuredImpactPct: impact !== null ? impact * 100 : null,
  };
}

/** Normalised event list from the `news` collection, the config event and the optional scheduled event. */
export function useNewsEvents(market: MarketState): NewsEventsState {
  const { sessionId } = useSession();
  const [news, setNews] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setNews([]);
    if (!sessionId) return;
    return onSnapshot(
      query(collection(db, 'news'), where('sessionId', '==', sessionId)),
      (snap) => setNews(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('News listener error:', err),
    );
  }, [sessionId]);

  const seenEvents = sessionId ? seenEventsFor(sessionId) : new Map<string, ActiveNewsEvent>();
  const cfgEvent = configuredEvent(market.config);
  if (cfgEvent) seenEvents.set(eventKey(cfgEvent), cfgEvent);

  const nextRaw = market.config?.nextNewsEvent;
  const nextStartsMs = toMillis(nextRaw?.startsAt);

  // 1s clock so countdowns tick and an event flips to completed the moment its window closes.
  const needsClock = !!cfgEvent || !!nextRaw?.headline;
  useEffect(() => {
    if (!needsClock) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [needsClock]);

  const cfgKey = cfgEvent ? `${eventKey(cfgEvent)}|${cfgEvent.expiresAtMs}` : '';

  return useMemo(() => {
    const windowed = new Map<string, ActiveNewsEvent>(seenEvents);
    if (cfgEvent) windowed.set(eventKey(cfgEvent), cfgEvent);
    const eventItems = Array.from(windowed.values()).map((e) => fromConfigEvent(e, now));

    const bulletins = news
      .filter((n) => n.headline)
      .map(fromBulletin)
      .filter((b) => !eventItems.some((e) => sameHeadline(e.headline, b.headline)));

    const scheduled: Omit<NewsEventItem, 'number'>[] =
      nextRaw?.headline && !eventItems.some((e) => sameHeadline(e.headline, nextRaw.headline))
        ? [{
            id: 'scheduled:next',
            source: 'SCHEDULED',
            headline: String(nextRaw.headline),
            description: String(nextRaw.description || ''),
            sentiment: null,
            status: 'UPCOMING',
            startMs: nextStartsMs || null,
            endMs: null,
            affected: [],
            marketWide: false,
            configuredImpactPct: null,
          }]
        : [];

    const events = [...eventItems, ...bulletins, ...scheduled]
      .sort((a, b) => (a.startMs ?? Number.MAX_SAFE_INTEGER) - (b.startMs ?? Number.MAX_SAFE_INTEGER))
      .map((e, i) => ({ ...e, number: i + 1 }));

    const active = events.find((e) => e.status === 'ACTIVE') ?? null;
    const lastEnded = events
      .filter((e) => e.source === 'EVENT' && e.status === 'COMPLETED')
      .sort((a, b) => (b.endMs ?? 0) - (a.endMs ?? 0))[0] ?? null;

    return {
      events,
      active,
      featured: active ?? lastEnded,
      next: events.find((e) => e.status === 'UPCOMING') ?? null,
      marketStartMs: toMillis(market.config?.startTime) || toMillis(market.config?.startedAt) || null,
      marketEndMs: toMillis(market.config?.endTime) || toMillis(market.config?.completedAt) || null,
      now,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, news, cfgKey, nextRaw?.headline, nextRaw?.description, nextStartsMs, market.config?.startTime, market.config?.startedAt, market.config?.endTime, market.config?.completedAt, now]);
}

export function sectorLabel(stock: LiveStock): string {
  return categoryOf(stock) ?? 'Other';
}

/** Live stocks touched by an event; market-wide bulletins touch every stock. */
export function affectedLiveStocks(event: NewsEventItem, stocks: LiveStock[]): LiveStock[] {
  if (event.marketWide) return stocks;
  const tickers = new Set(event.affected.map((a) => a.ticker));
  return stocks.filter((s) => tickers.has(s.ticker.toUpperCase()));
}

export function eventSectors(event: NewsEventItem, stocks: LiveStock[]): string[] {
  if (event.marketWide) return ['All sectors'];
  return Array.from(new Set(affectedLiveStocks(event, stocks).map(sectorLabel)));
}

export interface SectorResponse {
  sector: string;
  changePct: number;
  count: number;
}

/** Average current change of the affected stocks, grouped by sector. */
export function sectorResponse(event: NewsEventItem, stocks: LiveStock[]): SectorResponse[] {
  const groups = new Map<string, number[]>();
  affectedLiveStocks(event, stocks).forEach((s) => {
    const key = sectorLabel(s);
    groups.set(key, [...(groups.get(key) ?? []), s.changePercent]);
  });
  return Array.from(groups.entries())
    .map(([sector, vals]) => ({ sector, changePct: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length }))
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

export function eventDirection(event: NewsEventItem): 'UP' | 'DOWN' | 'MIXED' | null {
  const dirs = new Set(event.affected.map((a) => a.direction));
  if (dirs.size === 1) return dirs.has('UP') ? 'UP' : 'DOWN';
  if (dirs.size > 1) return 'MIXED';
  if (event.sentiment === 'POSITIVE') return 'UP';
  if (event.sentiment === 'NEGATIVE') return 'DOWN';
  return null;
}

export function eventWindowMs(event: NewsEventItem): number | null {
  return event.startMs && event.endMs && event.endMs > event.startMs ? event.endMs - event.startMs : null;
}

export const eventLabel = (n: number) => `Event ${n.toString().padStart(2, '0')}`;
