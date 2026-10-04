import React from 'react';
import { T } from '../dashboard/ui';
import { NewsEventItem, eventLabel } from '../../lib/newsEvents';
import { formatClock, statusTone } from './newsUi';

const ROW_H = 54;
const LINE_X = 14;
const SVG_W = 30;

type NodeState = 'done' | 'current' | 'pending';

interface TimelineNode {
  key: string;
  state: NodeState;
  /** Horizontal drift of the segment leading into this node: up-moves lean right, down-moves left. */
  drift: number;
  event?: NewsEventItem;
  title: string;
  meta: string;
}

interface EventTimelineProps {
  events: NewsEventItem[];
  status: string;
  marketStartMs: number | null;
  marketEndMs: number | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function segmentPath(y0: number, y1: number, drift: number): string {
  const h = y1 - y0;
  const pts: [number, number][] = [
    [LINE_X, y0],
    [LINE_X + drift * 0.35, y0 + h * 0.22],
    [LINE_X - drift * 0.45, y0 + h * 0.45],
    [LINE_X + drift, y0 + h * 0.7],
    [LINE_X + drift * 0.2, y0 + h * 0.88],
    [LINE_X, y1],
  ];
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}

export default function EventTimeline({ events, status, marketStartMs, marketEndMs, selectedId, onSelect }: EventTimelineProps) {
  const started = status !== 'NOT_STARTED' || !!marketStartMs;
  const nodes: TimelineNode[] = [
    { key: 'start', state: started ? 'done' : 'pending', drift: 0, title: 'Market Start', meta: marketStartMs ? formatClock(marketStartMs) : started ? 'Open' : 'Not started' },
    ...events.map((e): TimelineNode => ({
      key: e.id,
      state: e.status === 'ACTIVE' ? 'current' : e.status === 'COMPLETED' ? 'done' : 'pending',
      drift: e.sentiment === 'POSITIVE' ? 5 : e.sentiment === 'NEGATIVE' ? -5 : 2.5,
      event: e,
      title: eventLabel(e.number),
      meta: e.headline,
    })),
    {
      key: 'final',
      state: status === 'COMPLETED' ? 'done' : 'pending',
      drift: 0,
      title: 'Final Results',
      meta: status === 'COMPLETED' ? 'Standings locked' : marketEndMs ? `Closes ${formatClock(marketEndMs)}` : 'At market close',
    },
  ];

  const height = nodes.length * ROW_H;
  const yOf = (i: number) => i * ROW_H + ROW_H / 2;
  const strokeFor = (s: NodeState) => (s === 'current' ? T.cyan : s === 'done' ? T.muted : T.border);

  return (
    <section className="rounded-md border border-[#26343C] bg-[#0D1419] p-4" aria-label="Event timeline">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A4AFB4]">Event Timeline</h2>
        <span className="text-[11px] tabular-nums text-[#65737A]">{events.length} events</span>
      </div>

      <div className="xl:max-h-[calc(100vh-15rem)] xl:overflow-y-auto -mx-1 px-1">
        <div className="relative" style={{ height }}>
          <svg className="absolute left-0 top-0" width={SVG_W} height={height} aria-hidden="true">
            {nodes.slice(1).map((n, i) => (
              <path
                key={n.key}
                d={segmentPath(yOf(i) + 5, yOf(i + 1) - 5, n.drift)}
                fill="none"
                stroke={strokeFor(n.state)}
                strokeWidth={n.state === 'current' ? 1.75 : 1.25}
                strokeDasharray={n.state === 'pending' ? '2 3' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {nodes.map((n, i) => {
              const y = yOf(i);
              const c = n.event ? (n.state === 'pending' ? T.user : n.state === 'current' ? statusTone(n.event) : T.muted) : strokeFor(n.state);
              if (!n.event) {
                return <rect key={n.key} x={LINE_X - 3.5} y={y - 3.5} width="7" height="7" rx="1" fill={n.state === 'done' ? T.muted : T.bg} stroke={n.state === 'done' ? T.muted : T.border} />;
              }
              if (n.state === 'current') {
                return (
                  <g key={n.key}>
                    <circle cx={LINE_X} cy={y} r="7.5" fill="none" stroke={c} strokeOpacity="0.35" />
                    <circle cx={LINE_X} cy={y} r="4" fill={c} />
                  </g>
                );
              }
              return n.state === 'done'
                ? <circle key={n.key} cx={LINE_X} cy={y} r="3.5" fill={T.muted} />
                : <circle key={n.key} cx={LINE_X} cy={y} r="3.5" fill={T.bg} stroke={c} strokeOpacity="0.7" strokeWidth="1.25" />;
            })}
          </svg>

          <ol className="absolute inset-0" style={{ left: SVG_W + 6 }}>
            {nodes.map((n) => {
              const titleColor = n.state === 'current' ? T.cyan : n.state === 'done' ? T.text2 : T.muted;
              const content = (
                <>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] tabular-nums" style={{ color: titleColor }}>
                    {n.title}
                    {n.state === 'current' && <span className="ml-1.5 normal-case tracking-normal font-medium">· live</span>}
                  </span>
                  <span className={`block truncate text-xs mt-0.5 ${n.state === 'current' ? 'text-[#F3F5F4]' : n.state === 'done' ? 'text-[#A4AFB4]' : 'text-[#65737A]'}`}>
                    {n.meta}
                  </span>
                </>
              );
              return (
                <li key={n.key} style={{ height: ROW_H }} className="flex items-center">
                  {n.event ? (
                    <button
                      onClick={() => onSelect(n.event!.id)}
                      aria-current={n.state === 'current' ? 'step' : undefined}
                      className={`w-full min-w-0 text-left rounded-md px-2 py-1.5 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50 ${selectedId === n.event.id ? 'bg-[#111A20]' : 'hover:bg-[#111A20]/60'}`}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="w-full min-w-0 px-2 py-1.5">{content}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
