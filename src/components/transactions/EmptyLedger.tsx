import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const LINE = '0,46 30,42 60,44 90,34 120,38 150,26 180,30 210,20 240,24 270,14 300,18';

export default function EmptyLedger() {
  return (
    <div className="flex flex-col items-center text-center px-6 py-14">
      <svg width="300" height="60" viewBox="0 0 300 60" className="max-w-full" aria-hidden="true">
        <line x1="0" y1="52" x2="300" y2="52" stroke="#26343C" strokeWidth="1" />
        <polyline points={LINE} fill="none" stroke="#4A5A63" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="300" cy="18" r="2.5" fill="#4A5A63" transform="translate(-3 0)" />
      </svg>
      <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A4AFB4]">No trades yet</h3>
      <p className="mt-1.5 text-[13px] text-[#65737A]">Your transactions for this session will appear here.</p>
      <Link
        to="/market"
        className="group mt-5 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-[#3B82FF]/45 text-xs font-semibold uppercase tracking-[0.12em] text-[#F3F5F4] hover:bg-[#3B82FF]/10 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82FF]/50"
      >
        Start Trading
        <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
