/**
 * zerotierNetworkMiner.js — ZeroTier network-ID miner.
 *
 * ZeroTier builds encrypted overlay networks identified by 16-hex-character
 * network IDs (e.g. `a09acf0233d7c6a8`). Those IDs surface in client configs
 * (`zerotier-cli join <id>`), state files
 * (`/var/lib/zerotier-one/networks/<id>.conf`), and sometimes in shipped
 * scripts or docs. Mining them maps the overlay networks an organization
 * runs — useful authorized reconnaissance showing which private networks the
 * target's tooling expects to join.
 *
 * Pure text analysis: the caller supplies fetched text. Candidates are only
 * accepted when surrounded by ZeroTier context, to avoid flagging arbitrary
 * hex strings. This module only DETECTS exposure — it never attempts to join
 * networks. Defensive use: authorized hardening review on targets the user
 * may test.
 */

/** ZeroTier network IDs are exactly 16 lowercase hex characters. */
const NETWORK_ID_RE = /\b[0-9a-f]{16}\b/gi;
/** ZeroTier node addresses are 10 hex characters — noted separately. */
const NODE_ADDRESS_RE = /\b[0-9a-f]{10}\b/gi;

const ZEROTIER_CONTEXT_RES = [
  /zerotier/i,
  /zero[\s_-]?tier/i,
  /\bnwid\b/i,
  /network[\s_-]?id/i,
  /\bnetworks?\b/i,
  /zerotier-cli/i,
  /planet|moon/i,
  /\.conf\b/i,
];

/**
 * Check whether the text around a match mentions ZeroTier context.
 *
 * @param {string} text - full text
 * @param {number} index - match offset
 * @param {number} window - characters of context on each side
 * @returns {boolean}
 */
export function hasZeroTierContext(text, index, window = 80) {
  const start = Math.max(0, index - window);
  const end = Math.min(text.length, index + window);
  const slice = text.slice(start, end);
  return ZEROTIER_CONTEXT_RES.some((re) => re.test(slice));
}

/**
 * Extract ZeroTier network IDs that appear in ZeroTier context.
 *
 * @param {string} text
 * @returns {Array<{ networkId: string, context: string }>}
 */
export function extractNetworkIds(text) {
  if (typeof text !== 'string') return [];
  NETWORK_ID_RE.lastIndex = 0;
  const out = [];
  const seen = new Set();
  let m;
  while ((m = NETWORK_ID_RE.exec(text)) !== null) {
    const id = m[0].toLowerCase();
    if (seen.has(id)) continue;
    if (!hasZeroTierContext(text, m.index)) continue;
    seen.add(id);
    const start = Math.max(0, m.index - 60);
    const end = Math.min(text.length, m.index + m[0].length + 60);
    out.push({
      networkId: id,
      context: text.slice(start, end).replace(/\s+/g, ' ').trim().slice(0, 140),
    });
  }
  return out;
}

/**
 * Extract ZeroTier node addresses (10-hex) that appear in ZeroTier context.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function extractNodeAddresses(text) {
  if (typeof text !== 'string') return [];
  NODE_ADDRESS_RE.lastIndex = 0;
  const out = new Set();
  let m;
  while ((m = NODE_ADDRESS_RE.exec(text)) !== null) {
    if (hasZeroTierContext(text, m.index)) out.add(m[0].toLowerCase());
  }
  return [...out].sort();
}

/**
 * Detect `zerotier-cli join <network-id>` invocations.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function extractJoinCommands(text) {
  if (typeof text !== 'string') return [];
  const re = /zerotier-cli\s+join\s+([0-9a-f]{16})/gi;
  const out = new Set();
  let m;
  while ((m = re.exec(text)) !== null) out.add(m[1].toLowerCase());
  return [...out].sort();
}

/**
 * Mine ZeroTier overlay-network references from text.
 *
 * @param {{ source?: string, text: string }} input
 * @returns {{ type: string, confidence: string, networks: object[], nodeAddresses: string[], joinCommands: string[], evidence: string }}
 */
export function mineZeroTierNetworks({ source = 'unknown', text = '' } = {}) {
  const networks = extractNetworkIds(text);
  const nodeAddresses = extractNodeAddresses(text);
  const joinCommands = extractJoinCommands(text);
  const found = networks.length > 0;

  return {
    type: 'ZeroTier Network-ID Mining',
    confidence: found ? 'high' : 'low',
    networks: networks.map((n) => ({
      networkId: n.networkId,
      context: n.context,
      severity: 'low',
      remediation:
        'Confirm the network ID is meant to be public; ZeroTier networks are ' +
        'private by authorization, but the ID reveals overlay topology.',
    })),
    nodeAddresses,
    joinCommands,
    evidence: found
      ? `Mined ${networks.length} ZeroTier network ID(s) from ${source}: ${networks.map((n) => n.networkId).join(', ')}` +
        (nodeAddresses.length ? `; ${nodeAddresses.length} node address(es) noted` : '') +
        (joinCommands.length ? `; ${joinCommands.length} join command(s) reference these networks` : '') +
        '.'
      : `No ZeroTier network IDs found in ${source}.`,
  };
}

export const ZEROTIER_NETWORK_MINER = {
  hasZeroTierContext,
  extractNetworkIds,
  extractNodeAddresses,
  extractJoinCommands,
  mineZeroTierNetworks,
};
export default ZEROTIER_NETWORK_MINER;
