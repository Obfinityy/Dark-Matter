/**
 * netbiosNameIntel.js — NetBIOS name table mining (idea 00127).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. NetBIOS name
 * services (UDP 137) answer name-table queries with every name a Windows
 * host has registered: the machine name, the workgroup/domain, and — for
 * infrastructure hosts — domain-controller and master-browser roles. One
 * `nbtstat -A` / `nmblookup -A` response against an in-scope host yields its
 * machine identity and the Windows domain it belongs to.
 *
 * All functions are pure: they parse name-table text supplied by the caller
 * and never send NetBIOS queries themselves.
 */

/**
 * NetBIOS name suffix (type byte) → meaning. Suffix 0x00/0x20 on a UNIQUE
 * name is the machine itself; GROUP suffixes describe the workgroup/domain.
 */
export const NETBIOS_SUFFIX_MAP = {
  '00': { scope: 'UNIQUE', role: 'Workstation / machine name' },
  '01': { scope: 'UNIQUE', role: 'Messenger service (legacy)' },
  '03': { scope: 'UNIQUE', role: 'Messenger service name' },
  '1B': { scope: 'UNIQUE', role: 'Domain master browser' },
  '1C': { scope: 'GROUP', role: 'Domain controllers for the domain' },
  '1D': { scope: 'GROUP', role: 'Master browser for the subnet' },
  '1E': { scope: 'GROUP', role: 'Browser elections service (workgroup/domain)' },
  20: { scope: 'UNIQUE', role: 'File server service (Server service)' },
  21: { scope: 'UNIQUE', role: 'RAS client' },
  22: { scope: 'UNIQUE', role: 'RAS server' },
  23: { scope: 'UNIQUE', role: 'SMS clients' },
  24: { scope: 'UNIQUE', role: 'SMS administrators' },
  30: { scope: 'UNIQUE', role: 'NetBIOS datagram service' },
  31: { scope: 'UNIQUE', role: 'NetBIOS name service client' },
  43: { scope: 'UNIQUE', role: 'SMS remote control' },
  44: { scope: 'UNIQUE', role: 'SMS remote chat' },
  45: { scope: 'UNIQUE', role: 'SMS remote file transfer' },
  46: { scope: 'UNIQUE', role: 'SMS remote chat (2)' },
  '4C': { scope: 'UNIQUE', role: 'DEC TCP/IP print server' },
  52: { scope: 'UNIQUE', role: 'DEC TCP/IP print server (2)' },
  '6A': { scope: 'UNIQUE', role: 'Microsoft Exchange Interchange' },
  87: { scope: 'UNIQUE', role: 'Microsoft Exchange MTA' },
  BE: { scope: 'GROUP', role: 'Network monitor agent' },
  BF: { scope: 'GROUP', role: 'Network monitor utility' },
};

/**
 * Parse nbtstat -A / nmblookup -A style name tables:
 *   WORKSTATION01    <00>  UNIQUE      Registered
 *   CORPDOMAIN       <1C>  GROUP       Registered
 *   MAC Address = 00-11-22-33-44-55
 *
 * @param {string} text
 * @returns {Array<{ name: string, suffix: string, scope: string, role: string | null, status: string, detail: string }>}
 */
export function parseNetbiosNameTable(text) {
  const out = [];
  const re =
    /^\s*([A-Za-z0-9!#$%&'()\-@^_`{}~][A-Za-z0-9!#$%&'()\-@^_`{}~ .]{0,30}?)\s*<([0-9A-Fa-f]{2})>\s+(UNIQUE|GROUP)\s+(\w[\w-]*)/gim;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].trim().replace(/\s+$/, '');
    if (!name || /^MAC Address/i.test(name)) continue;
    const suffix = m[2].toUpperCase();
    const scope = m[3].toUpperCase();
    const status = m[4];
    const known = NETBIOS_SUFFIX_MAP[suffix];
    out.push({
      name,
      suffix,
      scope,
      role: known ? known.role : null,
      status,
      detail:
        `NetBIOS name '${name}<${suffix}>' (${scope}) — ` +
        (known ? known.role : 'unrecognized suffix; investigate the registering service') +
        ` [${status}].`,
    });
  }
  return out;
}

/**
 * Extract the MAC address line some tools append to the table.
 * @param {string} text
 * @returns {string | null}
 */
export function extractNetbiosMac(text) {
  const m = String(text || '').match(
    /MAC Address\s*=\s*([0-9A-Fa-f]{2}(?:[-:][0-9A-Fa-f]{2}){5})/i
  );
  return m ? m[1].toUpperCase().replace(/:/g, '-') : null;
}

/**
 * Idea 00127 — NetBIOS name table mining.
 *
 * Parses NetBIOS name-service responses and returns registered machine
 * names, workgroups/domains, role-bearing names (domain controllers,
 * master browsers), and the host MAC.
 *
 * @param {string} text Raw nbtstat / nmblookup output.
 * @returns {{
 *   names: ReturnType<typeof parseNetbiosNameTable>,
 *   machineNames: string[],
 *   workgroups: string[],
 *   domainControllers: string[],
 *   masterBrowsers: string[],
 *   fileServers: string[],
 *   mac: string | null,
 *   summary: { total: number, unique: number, group: number },
 *   findings: string[]
 * }}
 */
export function mineNetbiosNames(text) {
  const raw = String(text || '');
  const names = parseNetbiosNameTable(raw);
  const mac = extractNetbiosMac(raw);

  const machineNames = [
    ...new Set(
      names.filter(n => n.scope === 'UNIQUE' && ['00', '20'].includes(n.suffix)).map(n => n.name)
    ),
  ];
  const workgroups = [
    ...new Set(
      names.filter(n => n.scope === 'GROUP' && ['00', '1E'].includes(n.suffix)).map(n => n.name)
    ),
  ];
  const domainControllers = [...new Set(names.filter(n => n.suffix === '1C').map(n => n.name))];
  const masterBrowsers = [
    ...new Set(names.filter(n => ['1B', '1D'].includes(n.suffix)).map(n => n.name)),
  ];
  const fileServers = [...new Set(names.filter(n => n.suffix === '20').map(n => n.name))];

  const summary = {
    total: names.length,
    unique: names.filter(n => n.scope === 'UNIQUE').length,
    group: names.filter(n => n.scope === 'GROUP').length,
  };

  const findings = [];
  if (machineNames.length) {
    findings.push(
      `Machine name(s): ${machineNames.join(', ')} — the host's NetBIOS identity; ` +
        'naming conventions decode site/role numbering.'
    );
  }
  if (workgroups.length) {
    findings.push(
      `Workgroup/domain(s): ${workgroups.join(', ')} — the Windows domain this host belongs to; ` +
        'seed for AD-oriented enumeration.'
    );
  }
  if (domainControllers.length) {
    findings.push(
      `Domain controller group registration(s): ${domainControllers.join(', ')} — ` +
        'confirms an Active Directory domain is in use; enumerate its controllers.'
    );
  }
  if (masterBrowsers.length) {
    findings.push(
      `Browser role(s): ${masterBrowsers.join(', ')} — browse-list holders know every Windows host on the segment.`
    );
  }
  if (fileServers.length) {
    findings.push(
      `File-server registration(s): ${fileServers.join(', ')} — Server service is running; ` +
        'inventory its shares within scope.'
    );
  }
  if (mac) findings.push(`MAC address: ${mac} — hardware identity for asset correlation.`);
  if (!names.length) {
    findings.push(
      'No NetBIOS names parsed — confirm the input is nbtstat -A / nmblookup -A output.'
    );
  }

  return {
    names,
    machineNames,
    workgroups,
    domainControllers,
    masterBrowsers,
    fileServers,
    mac,
    summary,
    findings,
  };
}
