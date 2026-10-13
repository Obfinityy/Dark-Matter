// Dark Matter — hunt intensity modes.
//
// Six modes, tiered by token usage and capability. Higher modes run deeper:
// more tools, longer chains, variant mining, and stateful sequencing.
// Premium tiers gate the upper modes (see frontend PremiumPage).

export const HUNT_MODES = {
  normal: {
    id: 'normal',
    name: 'Normal',
    tagline: 'Quick recon + top vulnerability checks',
    tokenBudget: '~50k tokens',
    depth: 1,
    techniques: ['recon', 'nuclei-critical', 'differential'],
    concurrency: 2,
    tier: 'free',
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    tagline: 'Deeper scan with confirmation',
    tokenBudget: '~200k tokens',
    depth: 2,
    techniques: ['recon', 'nuclei', 'differential', 'jwt-battery'],
    concurrency: 4,
    tier: 'free',
  },
  high: {
    id: 'high',
    name: 'High',
    tagline: 'Full attack surface + chaining',
    tokenBudget: '~800k tokens',
    depth: 3,
    techniques: ['recon', 'nuclei', 'differential', 'jwt-battery', 'chain-engine', 'variant-mining'],
    concurrency: 6,
    tier: 'pro',
  },
  ultra: {
    id: 'ultra',
    name: 'Ultra High',
    tagline: 'Stateful API fuzzing + logic tests',
    tokenBudget: '~2M tokens',
    depth: 4,
    techniques: ['recon', 'nuclei', 'differential', 'jwt-battery', 'chain-engine', 'variant-mining', 'api-sequencer', 'logic-tests'],
    concurrency: 8,
    tier: 'pro',
  },
  max: {
    id: 'max',
    name: 'Max',
    tagline: 'Everything: all techniques, longest chains',
    tokenBudget: '~5M tokens',
    depth: 5,
    techniques: ['recon', 'nuclei', 'differential', 'jwt-battery', 'chain-engine', 'variant-mining', 'api-sequencer', 'logic-tests', 'learning-replay'],
    concurrency: 10,
    tier: 'elite',
  },
  infinity: {
    id: 'infinity',
    name: 'Infinity',
    tagline: 'No limits — continuous hunting until stopped',
    tokenBudget: 'unlimited',
    depth: 6,
    techniques: ['all'],
    concurrency: 16,
    tier: 'elite',
    continuous: true,
  },
};

export const MODE_ORDER = ['normal', 'medium', 'high', 'ultra', 'max', 'infinity'];

export function getMode(id) {
  return HUNT_MODES[id] || HUNT_MODES.normal;
}

/** Premium tiers and which modes they unlock. */
export const TIERS = {
  free: { id: 'free', name: 'Free', price: '$0', modes: ['normal', 'medium'] },
  pro: { id: 'pro', name: 'Pro', price: '$99/mo', modes: ['normal', 'medium', 'high', 'ultra'] },
  elite: { id: 'elite', name: 'Elite', price: '$299/mo', modes: ['normal', 'medium', 'high', 'ultra', 'max', 'infinity'] },
};

export function modesForTier(tier) {
  const t = TIERS[tier] || TIERS.free;
  return t.modes.map(getMode);
}

export function canUseMode(tier, modeId) {
  const t = TIERS[tier] || TIERS.free;
  return t.modes.includes(modeId);
}
