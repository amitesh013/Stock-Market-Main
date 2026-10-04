import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useMarketState } from '../lib/marketState';
import { usePositionSummary } from '../lib/liveData';
import { useLeaderboardUsers } from '../lib/leaderboard';
import { EventStatus, NewsEventItem, useNewsEvents } from '../lib/newsEvents';
import { Card, CardTitle } from '../components/dashboard/ui';
import NewsHeader, { EventTab } from '../components/news/NewsHeader';
import ActiveEventHero from '../components/news/ActiveEventHero';
import EventTimeline from '../components/news/EventTimeline';
import EventList from '../components/news/EventList';
import PastEvents from '../components/news/PastEvents';
import EventDetailPanel from '../components/news/EventDetailPanel';
import AffectedAssets from '../components/news/AffectedAssets';
import CompetitionPulse from '../components/news/CompetitionPulse';

const TAB_FOR: Record<EventStatus, EventTab> = { ACTIVE: 'ACTIVE', UPCOMING: 'UPCOMING', COMPLETED: 'PAST' };

export default function NewsEvents() {
  const { user } = useAuth();
  const market = useMarketState();
  const position = usePositionSummary();
  const stocks = position.stocks;
  const ranked = useLeaderboardUsers().filter((u) => u.role !== 'admin');
  const { events, active, featured, next, marketStartMs, marketEndMs, now } = useNewsEvents(market);

  const [pickedTab, setPickedTab] = useState<EventTab | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const byTab: Record<EventTab, NewsEventItem[]> = {
    ACTIVE: events.filter((e) => e.status === 'ACTIVE'),
    UPCOMING: events.filter((e) => e.status === 'UPCOMING'),
    PAST: events.filter((e) => e.status === 'COMPLETED').reverse(),
  };
  const tab: EventTab = pickedTab ?? (byTab.ACTIVE.length ? 'ACTIVE' : byTab.UPCOMING.length ? 'UPCOMING' : 'PAST');
  const counts = { ACTIVE: byTab.ACTIVE.length, UPCOMING: byTab.UPCOMING.length, PAST: byTab.PAST.length };

  const selected = events.find((e) => e.id === selectedId) ?? null;
  const focus = active ?? featured;

  const select = (id: string) => {
    if (id === selectedId) {
      setSelectedId(null);
      return;
    }
    const e = events.find((x) => x.id === id);
    if (e) setPickedTab(TAB_FOR[e.status]);
    setSelectedId(id);
  };

  const myIndex = ranked.findIndex((u) => u.id === user?.uid);

  const timeline = (
    <EventTimeline
      events={events}
      status={market.status}
      marketStartMs={marketStartMs}
      marketEndMs={marketEndMs}
      selectedId={selectedId}
      onSelect={select}
    />
  );

  const detail = (e: NewsEventItem, inline = false) => (
    <EventDetailPanel event={e} stocks={stocks} now={now} inline={inline} onClose={() => setSelectedId(null)} />
  );

  return (
    <div className="min-w-0">
      <NewsHeader status={market.status} total={events.length} tab={tab} onTab={setPickedTab} counts={counts} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <aside className="hidden xl:block xl:col-span-3 xl:sticky xl:top-20 min-w-0">{timeline}</aside>

        <div className="lg:col-span-8 xl:col-span-6 min-w-0 space-y-4">
          <ActiveEventHero featured={featured} next={next} status={market.status} now={now} stocks={stocks} onView={select} />

          <div className="xl:hidden">{timeline}</div>

          <section aria-label={`${tab.toLowerCase()} events`}>
            {tab === 'PAST' ? (
              <PastEvents events={byTab.PAST} stocks={stocks} selectedId={selectedId} onSelect={select} />
            ) : (
              <EventList
                events={byTab[tab]}
                stocks={stocks}
                selectedId={selectedId}
                onSelect={select}
                emptyText={tab === 'ACTIVE' ? 'No event is live right now.' : 'No upcoming events have been scheduled.'}
                renderInline={(e) => detail(e, true)}
              />
            )}
          </section>
        </div>

        <div className="lg:col-span-4 xl:col-span-3 min-w-0 space-y-4">
          {selected && <div className="hidden lg:block">{detail(selected)}</div>}

          {focus && (focus.affected.length > 0 || focus.marketWide) && (
            <div className={selected ? 'lg:hidden' : ''}>
              <Card className="!p-4">
                <CardTitle right={<span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#65737A]">{focus.status === 'ACTIVE' ? 'Live event' : 'Last event'}</span>}>
                  Affected Assets
                </CardTitle>
                <AffectedAssets event={focus} stocks={stocks} />
              </Card>
            </div>
          )}

          <CompetitionPulse
            status={market.status}
            hasLiveEvent={!!active}
            portfolioValue={position.netWorth}
            returnPct={position.returnPct}
            rank={myIndex >= 0 ? myIndex + 1 : null}
            total={ranked.length}
          />
        </div>
      </div>
    </div>
  );
}
