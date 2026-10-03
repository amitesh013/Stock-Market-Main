import type { NewsEventConfig, NewsEventId } from './shared-types';

import techBoom from '../scenarios/tech-boom.json';
import consumerSurge from '../scenarios/consumer-spending-surge.json';
import energyBoom from '../scenarios/energy-transition-boom.json';
import bankingCrisis from '../scenarios/banking-liquidity-crisis.json';
import pharmaScandal from '../scenarios/pharma-safety-scandal.json';
import geopoliticalShock from '../scenarios/geopolitical-oil-shock.json';
import globalRecession from '../scenarios/global-recession.json';

export const ALL_SCENARIOS: NewsEventConfig[] = [
  techBoom,
  consumerSurge,
  energyBoom,
  bankingCrisis,
  pharmaScandal,
  geopoliticalShock,
  globalRecession,
] as NewsEventConfig[];

export const SCENARIO_MAP: Record<NewsEventId, NewsEventConfig> = Object.fromEntries(
  ALL_SCENARIOS.map(s => [s.id, s])
) as Record<NewsEventId, NewsEventConfig>;

export const POSITIVE_SCENARIOS = ALL_SCENARIOS.filter(s => s.type === 'POSITIVE');
export const NEGATIVE_SCENARIOS = ALL_SCENARIOS.filter(s => s.type === 'NEGATIVE');
export const MIXED_SCENARIOS = ALL_SCENARIOS.filter(s => s.type === 'MIXED');
