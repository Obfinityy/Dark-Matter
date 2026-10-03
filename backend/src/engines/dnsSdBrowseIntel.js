/**
 * dnsSdBrowseIntel.js — DNS-SD service browsing analysis (idea 00129).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. DNS Service
 * Discovery (RFC 6763) publishes what a network offers: `_services._dns-sd`
 * PTR records list every advertised service type, each type's PTR records
 * list its instances, and SRV/TXT records resolve instances to hosts, ports,
 * and metadata. Parsing browse output (dig, dns-sd, avahi-browse) — data the
 * network willingly advertises — enumerates services and their hosts.
 *
 * All functions are pure: they analyze browse/record text supplied by the
 * caller and never perform DNS queries themselves.
 */

/**
 * Well-known DNS-SD service types and what they disclose.
 */
export const DNSSD_SERVICE_MAP = {
  '_http._tcp': 'Web server (HTTP)',
  '_https._tcp': 'Web server (HTTPS)',
  '_ftp._tcp': 'FTP server',
  '_ssh._tcp': 'SSH server',
  '_smb._tcp': 'SMB/CIFS file sharing',
  '_afpovertcp._tcp': 'AFP file sharing (Apple)',
  '_nfs._tcp': 'NFS file sharing',
  '_printer._tcp': 'Printer (generic)',
  '_ipp._tcp': 'IPP printing',
  '_ipps._tcp': 'IPP over TLS printing',
  '_pdl-datastream._tcp': 'Raw printer port 9100',
  '_rdp._tcp': 'Remote Desktop (RDP)',
  '_vnc._tcp': 'VNC remote desktop',
  '_rfb._tcp': 'VNC (RFB protocol)',
  '_telnet._tcp': 'Telnet server',
  '_rtsp._tcp': 'RTSP streaming (often cameras)',
  '_onvif._tcp': 'ONVIF camera',
  '_axis-video._tcp': 'Axis camera',
  '_daap._tcp': 'iTunes/DAAP media sharing',
  '_airport._tcp': 'AirPort base station',
  '_airplay._tcp': 'AirPlay receiver',
  '_raop._tcp': 'AirPlay audio',
  '_hap._tcp': 'HomeKit accessory',
  '_homekit._tcp': 'HomeKit',
  '_mqtt._tcp': 'MQTT broker',
  '_coap._udp': 'CoAP (IoT)',
  '_snmp._udp': 'SNMP agent',
  '_tftp._udp': 'TFTP server',
  '_ntp._udp': 'NTP server',
  '_syslog._udp': 'Syslog receiver',
  '_ldap._tcp': 'LDAP directory',
  '_kerberos._tcp': 'Kerberos KDC',
  '_gc._tcp': 'AD Global Catalog',
  '_kpasswd._tcp': 'Kerberos password change',
  '_msdcs._tcp': 'AD domain controller locator',
  '_workstation._tcp': 'Windows workstation',
  '_server._tcp': 'Windows server',
  '_adisk._tcp': 'Time Machine backup disk',
  '_device-info._tcp': 'Device info (Apple)',
  '_sleep-proxy._udp': 'Sleep proxy',
  '_presence._tcp': 'Presence/iChat',
  '_xserveraid._tcp': 'macOS Server admin',
  '_odisk._tcp': 'Optical disk sharing',
  '_webdav._tcp': 'WebDAV',
  '_webdavs._tcp': 'WebDAV over TLS',
  '_carddav._tcp': 'CardDAV',
  '_caldav._tcp': 'CalDAV',
  '_subversion._tcp': 'Subversion server',
  '_git._tcp': 'Git daemon',
  '_docker._tcp': 'Docker',
  '_http-alt._tcp': 'Alternate HTTP port',
  '_esphome._tcp': 'ESPHome device',
  '_octoprint._tcp': 'OctoPrint (3D printer)',
  '_spotify-connect._tcp': 'Spotify Connect',
  '_sonos._tcp': 'Sonos speaker',
  '_googlecast._tcp': 'Chromecast',
  '_miio._udp': 'Xiaomi miIO device',
};

/**
 * Normalize any string containing a DNS-SD service type to the bare
 * `_<service>._<proto>` form, e.g. `_http._tcp.example.com.` → `_http._tcp`.
 * @param {string} s
 * @returns {string | null}
 */
export function normalizeServiceType(s) {
  const m = String(s || '').toLowerCase().match(/_[a-z0-9-]+\._(?:tcp|udp)/);
  return m ? m[0] : null;
}

/**
 * Describe a `_service._proto` type using the known map.
 * @param {string} serviceType e.g. `_ipp._tcp`
 * @returns {string}
 */
export function describeServiceType(serviceType) {
  const key = normalizeServiceType(serviceType);
  return (key && DNSSD_SERVICE_MAP[key]) || 'Unrecognized service type — investigate the instance TXT records';
}

/**
 * Idea 00129 — DNS-SD service browsing.
 *
 * Parses DNS-SD browse output (dig PTR/SRV/TXT, `dns-sd -B`, avahi-browse)
 * and returns advertised service types, instances with their hosts/ports/
 * TXT metadata, and the host inventory behind them.
 *
 * @param {string} text Raw browse/record text.
 * @returns {{
 *   serviceTypes: Array<{ type: string, description: string, instanceCount: number }>,
 *   instances: Array<{ instance: string, serviceType: string | null, host: string | null, port: number | null, txt: Record<string, string>, detail: string }>,
 *   hosts: Array<{ name: string, services: string[] }>,
 *   summary: { serviceTypes: number, instances: number, hosts: number },
 *   findings: string[]
 * }}
 */
export function browseDnsSd(text) {
  const raw = String(text || '');
  const serviceTypes = new Set();
  const instances = new Map(); // instance name -> { serviceType, host, port, txt }

  const ensure = (inst) => {
    const key = inst.replace(/\.$/, '');
    if (!instances.has(key)) instances.set(key, { serviceType: null, host: null, port: null, txt: {} });
    return instances.get(key);
  };
  const tagService = (inst, rawType) => {
    const t = normalizeServiceType(rawType);
    if (t) {
      inst.serviceType = t;
      serviceTypes.add(t);
    }
  };

  for (const line of raw.split('\n')) {
    const l = line.trim();
    if (!l || /^[#;]/.test(l)) continue;

    // _services._dns-sd._udp.<dom> PTR <service-type>.<dom>
    let m = l.match(/_services\._dns-sd\._udp\b[\s\S]*?\sPTR\s+(\S+)/i);
    if (m) {
      const t = normalizeServiceType(m[1]);
      if (t) serviceTypes.add(t);
      continue;
    }

    // Generic record: <owner> [ttl] IN <TYPE> <rdata> — owner may contain spaces
    // (DNS-SD instance names like "Intranet Portal._http._tcp.example.com.").
    m = l.match(/^(.+?)\s+(?:\d+\s+)?IN\s+(PTR|SRV|TXT|A|AAAA)\s+(.+?)\s*$/i);
    if (!m) {
      // dns-sd -B style: "<timestamp>  _http._tcp.  local.  My Web Server"
      const b = l.match(/(_[a-z0-9-]+\._(?:tcp|udp))\.\s+\S+\s+(.+?)\s*$/i);
      if (b && !/PTR|SRV|TXT/i.test(l)) {
        const t = normalizeServiceType(b[1]);
        const inst = ensure(`${b[2].trim()}.${t}`);
        tagService(inst, b[1]);
      }
      continue;
    }

    const owner = m[1].trim();
    const rtype = m[2].toUpperCase();
    const rdata = m[3].trim();

    if (rtype === 'PTR') {
      const inst = ensure(rdata.replace(/\.$/, ''));
      tagService(inst, owner);
    } else if (rtype === 'SRV') {
      const sm = rdata.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s*$/);
      if (sm) {
        const inst = ensure(owner.replace(/\.$/, ''));
        inst.host = sm[4].replace(/\.$/, '');
        inst.port = Number(sm[3]);
        tagService(inst, owner);
      }
    } else if (rtype === 'TXT') {
      const inst = ensure(owner.replace(/\.$/, ''));
      for (const qm of rdata.matchAll(/"([^"]*)"/g)) {
        const kv = qm[1];
        const eq = kv.indexOf('=');
        if (eq > 0) inst.txt[kv.slice(0, eq).toLowerCase()] = kv.slice(eq + 1);
      }
      tagService(inst, owner);
    }
    // A/AAAA owner names feed the host inventory below via instances.
  }

  const instanceList = [...instances.entries()].map(([instance, s]) => ({
    instance,
    serviceType: s.serviceType,
    host: s.host,
    port: s.port,
    txt: s.txt,
    detail: `Service instance '${instance}'` +
      (s.serviceType ? ` (${describeServiceType(s.serviceType)})` : '') +
      (s.host ? ` → ${s.host}${s.port ? `:${s.port}` : ''}` : ' — host/port not resolved in browse data') + '.',
  })).sort((a, b) => a.instance.localeCompare(b.instance));

  const hostMap = new Map();
  for (const s of instanceList) {
    if (!s.host) continue;
    if (!hostMap.has(s.host)) hostMap.set(s.host, new Set());
    if (s.serviceType) hostMap.get(s.host).add(s.serviceType);
  }
  const hosts = [...hostMap.entries()].map(([name, svcs]) => ({
    name,
    services: [...svcs],
  })).sort((a, b) => a.name.localeCompare(b.name));

  const typeList = [...serviceTypes].map(t => ({
    type: t,
    description: describeServiceType(t),
    instanceCount: instanceList.filter(s => s.serviceType === t).length,
  })).sort((a, b) => b.instanceCount - a.instanceCount || a.type.localeCompare(b.type));

  const summary = {
    serviceTypes: typeList.length,
    instances: instanceList.length,
    hosts: hosts.length,
  };

  const findings = [];
  if (typeList.length) {
    findings.push(`${typeList.length} service type(s) advertised: ` +
      typeList.slice(0, 8).map(t => `${t.type} (${t.description})`).join(', ') +
      `${typeList.length > 8 ? ` (+${typeList.length - 8} more)` : ''}.`);
  }
  if (hosts.length) {
    findings.push(`${hosts.length} host(s) behind advertised services: ${hosts.slice(0, 10).map(h => h.name).join(', ')}` +
      `${hosts.length > 10 ? ` (+${hosts.length - 10} more)` : ''} — service-to-host mapping for the segment.`);
  }
  const remoteAccess = instanceList.filter(s => /_ssh\._tcp|_rdp\._tcp|_vnc\._tcp|_rfb\._tcp|_telnet\._tcp/.test(s.serviceType || ''));
  if (remoteAccess.length) {
    findings.push(`${remoteAccess.length} remote-access service instance(s): ` +
      remoteAccess.slice(0, 6).map(s => `${s.instance}${s.host ? ` → ${s.host}:${s.port ?? '?'}` : ''}`).join(', ') +
      ' — reachable management endpoints.');
  }
  const iot = instanceList.filter(s => /_hap\._tcp|_homekit|_mqtt|_coap|_esphome|_octoprint|_onvif|_axis-video/.test(s.serviceType || ''));
  if (iot.length) {
    findings.push(`${iot.length} IoT/smart-device service instance(s) — IoT devices are a soft ` +
      'perimeter; inventory models and firmware.');
  }
  if (!typeList.length && !instanceList.length) {
    findings.push('No DNS-SD data parsed — confirm the input is dig PTR/SRV/TXT, dns-sd, or avahi-browse output.');
  }

  return { serviceTypes: typeList, instances: instanceList, hosts, summary, findings };
}
