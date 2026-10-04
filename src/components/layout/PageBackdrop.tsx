import React from 'react';
import { useLocation } from 'react-router-dom';
import { useMarketState } from '../../lib/marketState';
import dashboardBg from '../../assets/bg/dashboard-bg.jpg';
import marketBg from '../../assets/bg/market-globe-bg.jpg';
import portfolioBg from '../../assets/bg/portfolio-peaks-bg.jpg';
import eventsBg from '../../assets/bg/news-world-bg.jpg';
import transactionsBg from '../../assets/bg/transactions-ledger-bg.jpg';
import leaderboardBg from '../../assets/bg/leaderboard-runners-bg.jpg';
import finishBg from '../../assets/bg/placements-summit-bg.jpg';

interface Scene {
  src: string;
  /** Desktop opacity; tablet and mobile scale it down in CSS. */
  opacity: number;
  position: string;
  overlay: string;
}

const FULL: React.CSSProperties = { top: 0, left: 0, right: 0, bottom: 0 };

// Keeps the top band (page titles) and bottom edge calm while letting the scene fill the middle.
const vertical = 'linear-gradient(180deg, rgba(6,9,11,0.35) 0%, rgba(6,9,11,0.1) 14%, rgba(6,9,11,0.1) 70%, rgba(6,9,11,0.3) 100%)';
const vignette = 'radial-gradient(ellipse 100% 90% at 60% 45%, rgba(6,9,11,0) 55%, rgba(6,9,11,0.35) 100%)';

const SCENES: Record<string, Scene> = {
  '/': {
    src: dashboardBg,
    opacity: 0.42,
    position: '65% 45%',
    overlay: `linear-gradient(90deg, rgba(6,9,11,0.7) 0%, rgba(6,9,11,0.25) 40%, rgba(6,9,11,0) 75%), ${vertical}, ${vignette}`,
  },
  '/market': {
    src: marketBg,
    opacity: 0.6,
    position: '50% 50%',
    overlay: vertical,
  },
  '/portfolio': {
    src: portfolioBg,
    opacity: 0.4,
    position: '65% 40%',
    overlay: `linear-gradient(90deg, rgba(6,9,11,0.7) 0%, rgba(6,9,11,0.2) 45%, rgba(6,9,11,0) 80%), ${vertical}, ${vignette}`,
  },
  '/news': {
    src: eventsBg,
    opacity: 0.38,
    position: '50% 45%',
    overlay: `${vertical}, ${vignette}`,
  },
  '/transactions': {
    src: transactionsBg,
    opacity: 0.34,
    position: '50% 50%',
    overlay: `linear-gradient(90deg, rgba(6,9,11,0.55) 0%, rgba(6,9,11,0.15) 50%, rgba(6,9,11,0.05) 100%), ${vertical}`,
  },
  '/leaderboard': {
    src: leaderboardBg,
    opacity: 0.42,
    position: '60% 50%',
    overlay: `${vertical}, ${vignette}`,
  },
  '/placements': {
    src: finishBg,
    opacity: 0.44,
    position: '70% 30%',
    overlay: `linear-gradient(90deg, rgba(6,9,11,0.6) 0%, rgba(6,9,11,0.15) 50%, rgba(6,9,11,0.1) 100%), ${vertical}, ${vignette}`,
  },
};

/** Route-aware atmospheric layer behind the main content. Decorative only. */
export default function PageBackdrop() {
  const { pathname } = useLocation();
  const { status } = useMarketState();
  const scene = SCENES[pathname];
  if (!scene) return null;

  // The finish scene stays dimmer until the competition is actually complete.
  const opacity = pathname === '/placements' && status !== 'COMPLETED' ? scene.opacity * 0.55 : scene.opacity;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div key={pathname} className="page-bg absolute" style={{ ...FULL, ['--bg-o' as any]: opacity }}>
        <div
          className="page-bg-img absolute inset-0"
          style={{ backgroundImage: `url(${scene.src})`, backgroundSize: 'cover', backgroundPosition: scene.position, backgroundRepeat: 'no-repeat' }}
        />
        <div className="absolute inset-0" style={{ background: scene.overlay }} />
      </div>
    </div>
  );
}
