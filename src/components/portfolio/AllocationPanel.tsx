import React from 'react';
import { Eyebrow, formatUSD } from '../dashboard/ui';

export interface AllocationSlice {
  name: string;
  value: number;
  pct: number;
  color: string;
}

export const CATEGORY_COLORS: Record<string, string> = {
  Tech: '#3B82FF',
  Banking: '#00D9FF',
  Pharma: '#20C978',
  Defence: '#D5A653',
  Energy: '#D9364A',
  Consumer: '#00AFCB',
  Other: '#65737A',
};

const LABELS: Record<string, string> = { Tech: 'Technology', Defence: 'Defence', Other: 'Other' };

interface AllocationPanelProps {
  slices: AllocationSlice[];
  active: string | null;
  onSelect: (name: string | null) => void;
}

export default function AllocationPanel({ slices, active, onSelect }: AllocationPanelProps) {
  return (
    <section className="h-full rounded-md border border-[#26343C] bg-[#0D1419] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <Eyebrow>Asset Allocation</Eyebrow>
        {active && (
          <button onClick={() => onSelect(null)} className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A4AFB4] hover:text-[#F3F5F4] cursor-pointer">
            Clear filter
          </button>
        )}
      </div>

      {slices.length === 0 ? (
        <p className="text-sm text-[#65737A]">No invested capital yet. Your allocation appears after your first buy.</p>
      ) : (
        <>
          <div className="flex h-2.5 rounded-full overflow-hidden gap-px bg-[#111A20]" role="img" aria-label="Allocation by category">
            {slices.map((s) => (
              <div
                key={s.name}
                className="h-full transition-[width,opacity] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${s.pct}%`, backgroundColor: s.color, opacity: active && active !== s.name ? 0.3 : 1 }}
              />
            ))}
          </div>

          <ul className="mt-4 space-y-1">
            {slices.map((s) => {
              const isActive = active === s.name;
              return (
                <li key={s.name}>
                  <button
                    onClick={() => onSelect(isActive ? null : s.name)}
                    aria-pressed={isActive}
                    className={`w-full grid grid-cols-[minmax(0,110px)_minmax(0,1fr)_48px] sm:grid-cols-[minmax(0,110px)_minmax(0,1fr)_88px_48px] items-center gap-3 rounded-md px-2 py-1.5 text-left border transition-colors duration-200 cursor-pointer ${
                      isActive ? 'border-[#3B82FF]/50 bg-[#111A20]' : 'border-transparent hover:bg-[#111A20]/60'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-[13px] text-[#F3F5F4] truncate">{LABELS[s.name] || s.name}</span>
                    </span>
                    <span className="h-1.5 rounded-full bg-[#111A20] overflow-hidden">
                      <span className="block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                    </span>
                    <span className="hidden sm:block text-right text-xs tabular-nums text-[#A4AFB4]">{formatUSD(s.value, 0)}</span>
                    <span className="text-right text-xs font-semibold tabular-nums text-[#F3F5F4]">{s.pct.toFixed(0)}%</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
