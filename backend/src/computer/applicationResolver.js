/**
 * ApplicationResolver — natural-language application resolution + safety gate.
 *
 * Two distinct jobs, kept in ONE place so both the worker and the tests can
 * use them:
 *
 *   1. RESOLUTION: "MS Word" / "word" / "microsoft word" / "notepad" /
 *      "calc" must all map to the right Windows application. This is NOT task
 *      execution — the brain still decides *whether* and *when* to open
 *      something. Resolution only names the application so open_application
 *      gets a clean launcher token instead of free text like "MS Word please".
 *
 *   2. POLICY GATE (requirement #28, #15): the whitelist gates *how* actions
 *      run (actionSchema), but some applications must never be driven at all
 *      — they expose credentials or allow irreversible destruction. The brain
 *      is prompted with this policy, and this resolver enforces it a second
 *      time, deterministically: even a jailbroken prompt that says
 *      `open_application("registry editor")` is rejected here, at the adapter
 *      boundary, before the bridge is touched.
 */

/**
 * Curated alias table. `launch` is the token handed to the OS launcher
 * (`cmd /c start "" <launch>` on Windows), chosen to be alias-independent and
 * machine-independent — never a hardcoded install path.
 */
export const APPLICATION_ALIASES = Object.freeze([
  // Browsers
  {
    canonical: 'Google Chrome',
    launch: 'chrome',
    aliases: ['chrome', 'google chrome', 'chromium-based chrome'],
  },
  { canonical: 'Microsoft Edge', launch: 'msedge', aliases: ['edge', 'microsoft edge', 'msedge'] },
  { canonical: 'Mozilla Firefox', launch: 'firefox', aliases: ['firefox', 'mozilla firefox'] },

  // Productivity
  {
    canonical: 'Microsoft Word',
    launch: 'winword',
    aliases: ['word', 'ms word', 'microsoft word', 'msword', 'winword'],
  },
  {
    canonical: 'Microsoft Excel',
    launch: 'excel',
    aliases: ['excel', 'ms excel', 'microsoft excel', 'xlsx'],
  },
  {
    canonical: 'Microsoft PowerPoint',
    launch: 'powerpnt',
    aliases: ['powerpoint', 'ms powerpoint', 'microsoft powerpoint', 'ppt'],
  },
  { canonical: 'Notepad', launch: 'notepad', aliases: ['notepad', 'windows notepad'] },
  { canonical: 'WordPad', launch: 'write', aliases: ['wordpad', 'windows wordpad'] },

  // Utilities
  {
    canonical: 'Calculator',
    launch: 'calculator:',
    aliases: ['calculator', 'calc', 'windows calculator'],
  },
  {
    canonical: 'File Explorer',
    launch: 'explorer',
    aliases: ['file explorer', 'explorer', 'windows explorer', 'files', 'my computer'],
  },
  { canonical: 'Paint', launch: 'mspaint', aliases: ['paint', 'mspaint', 'microsoft paint'] },
  {
    canonical: 'Settings',
    launch: 'ms-settings:',
    aliases: ['settings', 'windows settings', 'pc settings'],
  },

  // Development
  {
    canonical: 'Visual Studio Code',
    launch: 'code',
    aliases: ['vscode', 'vs code', 'visual studio code', 'code editor'],
  },
]);

const WORD_CHARS = /[a-z0-9]/i;

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9:.\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve a natural-language application mention into a canonical launch name.
 *
 * Returns { canonical, launch, method } on a hit; null when the text does not
 * clearly name a known application (the brain then decides unaided — resolution
 * failing must never invent an application).
 *
 * Matching strategy, most specific first:
 *   1. exact alias equality on the whole phrase ("ms word"),
 *   2. whole-word substring so "open word" hits "word" but "keyboard" never does.
 */
export function resolveApplication(text) {
  const haystack = normalize(text);
  if (!haystack) return null;

  const hits = [];
  for (const entry of APPLICATION_ALIASES) {
    // Longest aliases first: "ms word" must be evaluated before "word" so the
    // most specific mention of an application wins.
    const aliases = [...entry.aliases].sort((a, b) => b.length - a.length);
    let bestForEntry = null;
    for (const alias of aliases) {
      const needle = normalize(alias);
      if (!needle) continue;

      let method = null;
      if (haystack === needle) {
        method = 'exact';
      } else {
        let index = haystack.indexOf(needle);
        while (index !== -1) {
          const before = index === 0 ? ' ' : haystack[index - 1];
          const after =
            index + needle.length >= haystack.length ? ' ' : haystack[index + needle.length];
          if (!WORD_CHARS.test(before) && !WORD_CHARS.test(after)) {
            method = 'substring';
            break;
          }
          index = haystack.indexOf(needle, index + 1);
        }
      }

      if (method) {
        const hit = {
          canonical: entry.canonical,
          launch: entry.launch,
          alias: needle,
          method,
          specificity: needle.length + (method === 'exact' ? 1000 : 0),
        };
        if (!bestForEntry || hit.specificity > bestForEntry.specificity) bestForEntry = hit;
        if (method === 'exact') break; // cannot do better than an exact phrase
      }
    }
    if (bestForEntry) hits.push(bestForEntry);
  }

  if (!hits.length) return null;
  hits.sort((a, b) => b.specificity - a.specificity);
  const best = hits[0];
  return { canonical: best.canonical, launch: best.launch, method: best.method };
}

/**
 * Policy blocklist — applications DARKMATTER must never drive, with a
 * human-readable reason. Enforced at the worker boundary regardless of what
 * the brain asked for.
 */
const BLOCKED_APPLICATIONS = [
  {
    label: 'registry editor',
    pattern: /\b(registry editor|regedit|registry)\b/i,
    reason: 'Windows registry manipulation',
  },
  { label: 'task manager', pattern: /\b(task manager|taskmgr)\b/i, reason: 'process/kill access' },
  {
    label: 'device manager',
    pattern: /\b(device manager|devmgmt)\b/i,
    reason: 'driver/device control',
  },
  {
    label: 'disk managers',
    pattern: /\b(disk management|diskmgmt|diskpart)\b/i,
    reason: 'disk/volume destruction',
  },
  {
    label: 'group policy editor',
    pattern: /\b(group policy|gpedit)\b/i,
    reason: 'system policy control',
  },
  { label: 'services console', pattern: /\bservices\.msc\b/i, reason: 'system service control' },
  {
    label: 'credential/password managers',
    pattern:
      /\b(credential manager|password (?:vault|manager)|keepass|lastpass|1password|bitwarden)\b/i,
    reason: 'credential access',
  },
  { label: 'keyloggers', pattern: /\bkeyloggers?\b/i, reason: 'credential access' },
  {
    label: 'event viewer',
    pattern: /\b(event viewer|eventvwr)\b/i,
    reason: 'security log tampering',
  },
  {
    label: 'security policy editors',
    pattern: /\b(secpol|local security policy)\b/i,
    reason: 'security policy control',
  },
  {
    label: 'security-software control panels',
    pattern: /\b(windows defender|defender security)\b/i,
    reason: 'security software control',
  },
  { label: 'PowerShell', pattern: /\bpowershell\b/i, reason: 'arbitrary command execution' },
  {
    label: 'terminal emulators',
    pattern: /\b(windows terminal|git\s?bash|wsl|terminal)\b/i,
    reason: 'arbitrary command execution',
  },
  {
    label: 'command shells',
    pattern: /\b(cmd|cmd\.exe|command prompt)\b/i,
    reason: 'arbitrary command execution',
  },
  {
    label: 'FTP clients with stored credentials',
    pattern: /\bfilezilla\b/i,
    reason: 'stored FTP credentials',
  },
  { label: 'packet sniffers', pattern: /\bwireshark\b/i, reason: 'traffic capture' },
];

/** One-line rendering of the blocklist for the brain's system prompt. */
export const BLOCKED_REASON_TEXT = `Blocked (never open, never drive): ${BLOCKED_APPLICATIONS.map(
  rule => rule.label
).join(', ')}.`;

/**
 * Check whether driving this application (or opening this text as an
 * application) violates the safety policy.
 * @returns {{blocked: boolean, reason: string|null, matched: string|null}}
 */
export function isApplicationBlocked(name) {
  const value = String(name || '');
  for (const rule of BLOCKED_APPLICATIONS) {
    if (rule.pattern.test(value)) {
      return { blocked: true, reason: rule.reason, matched: rule.pattern.source };
    }
  }
  return { blocked: false, reason: null, matched: null };
}
