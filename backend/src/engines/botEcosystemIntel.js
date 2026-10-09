/**
 * botEcosystemIntel.js — check GitHub for EXISTING public automation of a
 * target BEFORE claiming an automation finding.
 *
 * Lesson learned 10 Oct 2026 (VFS Global hunt): slot-monitoring bots for VFS
 * are public on GitHub (one with 402 stars). Reporting "I built a slot
 * checker" would be an instant duplicate. The bounty is for NOVEL automation
 * vectors (race conditions, scale abuse), not for re-implementing public bots.
 *
 * Pure functions — no network needed. The caller supplies repo data (from
 * GitHub search); this module scores and guides.
 */

// Signals a bot repo may implement, detected by keyword matching.
const SIGNAL_KEYWORDS = {
  'slot-monitoring': ['slot', 'availability', 'monitor', 'checkisslotavailable', 'slot-available'],
  booking: ['book', 'booking', 'reserve', 'reservation', 'appointment'],
  login: ['login', 'auth', 'signin', 'sign-in', 'log-in'],
  'captcha-solving': ['captcha', 'turnstile', 'recaptcha', '2captcha', 'anti-captcha', 'anticaptcha'],
  notification: ['telegram', 'alert', 'notify', 'notification', 'pushover', 'discord'],
};

const HIGH_STAR_THRESHOLD = 200;
const HIGH_REPO_COUNT = 3;

/**
 * Detect what a bot repo automates from its name/description/readme.
 * @param {object} args - { name, description, readme }
 * @returns {string[]} subset of ['slot-monitoring','booking','login','captcha-solving','notification']
 */
export function extractRepoSignals({ name = '', description = '', readme = '' } = {}) {
  const haystack = `${name} ${description} ${readme}`.toLowerCase();
  const signals = [];
  for (const [signal, keywords] of Object.entries(SIGNAL_KEYWORDS)) {
    if (keywords.some((k) => haystack.includes(k))) signals.push(signal);
  }
  return signals;
}

/**
 * Score duplicate risk for an automation finding against known public bots.
 * @param {object} args - { target, botRepos: [{name, stars, description}] }
 * @returns {object} { risk: 'high'|'medium'|'low', reasoning, matchedRepos }
 */
export function scoreAutomationDuplicateRisk({ target = '', botRepos = [] } = {}) {
  const repos = Array.isArray(botRepos) ? botRepos : [];
  const matchedRepos = repos.map((r) => ({
    name: String(r.name || 'unknown'),
    stars: Number(r.stars || 0),
    signals: extractRepoSignals(r),
  }));

  if (matchedRepos.length === 0) {
    return {
      risk: 'low',
      reasoning: `No public automation found for "${target}" — an automation finding is viable if the technique is novel. Document what makes it new.`,
      matchedRepos,
    };
  }

  const starLeader = matchedRepos.reduce((a, b) => (b.stars > a.stars ? b : a));
  const count = matchedRepos.length;

  if (count >= HIGH_REPO_COUNT || starLeader.stars >= HIGH_STAR_THRESHOLD) {
    const why =
      count >= HIGH_REPO_COUNT
        ? `${count} public bots automate this target`
        : `"${starLeader.name}" has ${starLeader.stars} stars doing this automation`;
    return {
      risk: 'high',
      reasoning: `HIGH duplicate risk for "${target}": ${why}. A generic automation report will be closed as duplicate. Only novel vectors (race conditions, scale abuse, bypass of anti-bot controls) are reportable.`,
      matchedRepos,
    };
  }

  return {
    risk: 'medium',
    reasoning: `MEDIUM duplicate risk for "${target}": ${count} small public bot(s) found (${matchedRepos.map((r) => r.name).join(', ')}). Report only with a clearly novel technique and document the difference.`,
    matchedRepos,
  };
}

/**
 * Guidance for what kind of automation claim is reportable at a risk level.
 * @param {string} risk - 'high'|'medium'|'low'
 * @returns {string} guidance text.
 */
export function automationClaimGuidance(risk = 'low') {
  switch (String(risk).toLowerCase()) {
    case 'high':
      return 'Do NOT report generic automation; only novel vectors (race conditions, scale abuse, anti-bot bypass) are reportable. Cite the existing public bots and explain precisely how your technique differs.';
    case 'medium':
      return 'Report only with a novel technique. Document the existing bot(s), then demonstrate what yours does that they cannot.';
    default:
      return 'Automation finding viable. Document novelty: what the automation achieves, why it matters to the business (slot-blocking, fraud, inventory exhaustion), and full reproduction steps.';
  }
}

export const BOT_ECOSYSTEM_INTEL = {
  extractRepoSignals,
  scoreAutomationDuplicateRisk,
  automationClaimGuidance,
};
export default BOT_ECOSYSTEM_INTEL;
