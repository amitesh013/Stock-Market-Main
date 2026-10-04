import React, { useEffect, useRef, useState } from 'react';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Minimal runner silhouette. Legs and arms swing only briefly after `progress` changes. */
export default function Runner({ progress, color, size = 20 }: { progress: number; color: string; size?: number }) {
  const [moving, setMoving] = useState(false);
  const prev = useRef(progress);

  useEffect(() => {
    if (Math.abs(prev.current - progress) < 0.001) return;
    prev.current = progress;
    if (prefersReducedMotion()) return;
    setMoving(true);
    const t = setTimeout(() => setMoving(false), 900);
    return () => clearTimeout(t);
  }, [progress]);

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className={`lb-runner ${moving ? 'is-moving' : ''}`}
      style={{ color }}
    >
      <g className="lb-runner-body" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="14.5" cy="4.5" r="2.1" fill="currentColor" stroke="none" />
        <path d="M13.2 7.6 L10.6 13.4" />
        <g className="lb-limb lb-arm-a"><path d="M12.6 8.6 L9.4 10.2 L7.8 8.4" /></g>
        <g className="lb-limb lb-arm-b"><path d="M12.6 8.6 L15.6 10.6 L17.6 9.2" /></g>
        <g className="lb-limb lb-leg-a"><path d="M10.6 13.4 L13.6 16.6 L12.6 20.6" /></g>
        <g className="lb-limb lb-leg-b"><path d="M10.6 13.4 L7.6 16.6 L4.6 17.4" /></g>
      </g>
    </svg>
  );
}
