/**
 * upnpDeviceIntel.js — UPnP device description mining (idea 00130).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. UPnP devices
 * (printers, cameras, NAS, routers, media servers) serve an XML device
 * description at a predictable URL (e.g. /dev/desc.xml) that names the
 * device (friendlyName), its maker and model, model/manufacturer URLs,
 * a presentation URL (usually the admin web UI), and every hosted service
 * with control/event URLs. Parsing a description the device willingly
 * serves inventories the IoT/embedded estate and its admin surfaces.
 *
 * All functions are pure: they parse UPnP description XML supplied by the
 * caller and never fetch anything themselves. XML is parsed with a small
 * hand-rolled, dependency-free parser (tag-depth aware, so nested
 * `<device>` blocks inside `<deviceList>` are handled correctly).
 */

/**
 * Split XML into top-level blocks for a repeated tag (depth-aware, so
 * nested occurrences of the same tag are kept inside their parent block).
 *
 * @param {string} xml
 * @param {string} tag e.g. 'device'
 * @returns {string[]} Inner XML of each top-level <tag>…</tag> block.
 */
export function splitTopLevelBlocks(xml, tag) {
  const openRe = new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi');
  const closeRe = new RegExp(`</${tag}\\s*>`, 'gi');
  const marks = [];
  let m;
  while ((m = openRe.exec(xml)) !== null) marks.push({ pos: m.index, end: m.index + m[0].length, open: true });
  while ((m = closeRe.exec(xml)) !== null) marks.push({ pos: m.index, end: m.index + m[0].length, open: false });
  marks.sort((a, b) => a.pos - b.pos || (a.open === b.open ? 0 : a.open ? -1 : 1));

  const blocks = [];
  let depth = 0;
  let start = -1;
  for (const mk of marks) {
    if (mk.open) {
      if (depth === 0) start = mk.end;
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0 && start >= 0) blocks.push(xml.slice(start, mk.pos));
      if (depth < 0) depth = 0;
    }
  }
  return blocks;
}

/**
 * Get the text of the first <tag>…</tag> in a block (direct field, no
 * nested same-name tags expected for the fields we read).
 *
 * @param {string} block
 * @param {string} tag
 * @returns {string}
 */
export function getXmlField(block, tag) {
  const m = block.match(new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}\\s*>`, 'i'));
  if (!m) return '';
  return m[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
}

/**
 * Decode the five XML entities.
 * @param {string} s
 */
export function decodeXmlEntities(s) {
  return String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

/**
 * Parse the <service> blocks inside one device block.
 *
 * @param {string} deviceBlock
 * @returns {Array<{ serviceType: string, serviceId: string, scpdUrl: string, controlUrl: string, eventSubUrl: string }>}
 */
export function parseUpnpServices(deviceBlock) {
  const out = [];
  for (const sb of splitTopLevelBlocks(deviceBlock, 'service')) {
    out.push({
      serviceType: decodeXmlEntities(getXmlField(sb, 'serviceType')),
      serviceId: decodeXmlEntities(getXmlField(sb, 'serviceId')),
      scpdUrl: decodeXmlEntities(getXmlField(sb, 'SCPDURL')),
      controlUrl: decodeXmlEntities(getXmlField(sb, 'controlURL')),
      eventSubUrl: decodeXmlEntities(getXmlField(sb, 'eventSubURL')),
    });
  }
  return out;
}

/**
 * Parse one <device> block into structured intel (recursing into
 * <deviceList> for embedded devices).
 *
 * @param {string} deviceBlock
 * @returns {{ friendlyName: string, deviceType: string, manufacturer: string, manufacturerUrl: string, modelDescription: string, modelName: string, modelNumber: string, modelUrl: string, serialNumber: string, udn: string, presentationUrl: string, services: ReturnType<typeof parseUpnpServices>, embedded: Array<ReturnType<typeof parseUpnpDevice>> }}
 */
export function parseUpnpDevice(deviceBlock) {
  const embedded = [];
  const listM = deviceBlock.match(/<deviceList>([\s\S]*)<\/deviceList\s*>/i);
  if (listM) {
    for (const eb of splitTopLevelBlocks(listM[1], 'device')) embedded.push(parseUpnpDevice(eb));
  }
  return {
    friendlyName: decodeXmlEntities(getXmlField(deviceBlock, 'friendlyName')),
    deviceType: decodeXmlEntities(getXmlField(deviceBlock, 'deviceType')),
    manufacturer: decodeXmlEntities(getXmlField(deviceBlock, 'manufacturer')),
    manufacturerUrl: decodeXmlEntities(getXmlField(deviceBlock, 'manufacturerURL')),
    modelDescription: decodeXmlEntities(getXmlField(deviceBlock, 'modelDescription')),
    modelName: decodeXmlEntities(getXmlField(deviceBlock, 'modelName')),
    modelNumber: decodeXmlEntities(getXmlField(deviceBlock, 'modelNumber')),
    modelUrl: decodeXmlEntities(getXmlField(deviceBlock, 'modelURL')),
    serialNumber: decodeXmlEntities(getXmlField(deviceBlock, 'serialNumber')),
    udn: decodeXmlEntities(getXmlField(deviceBlock, 'UDN')),
    presentationUrl: decodeXmlEntities(getXmlField(deviceBlock, 'presentationURL')),
    services: parseUpnpServices(deviceBlock),
    embedded,
  };
}

/**
 * Flatten a device tree (embedded devices included) into one list.
 * @param {ReturnType<typeof parseUpnpDevice>} device
 */
export function flattenDeviceTree(device) {
  const out = [device];
  for (const e of device.embedded || []) out.push(...flattenDeviceTree(e));
  return out;
}

/**
 * Idea 00130 — UPnP device description mining.
 *
 * Parses UPnP device-description XML and returns friendly names, makers,
 * models, presentation URLs (admin UIs), hosted services with control URLs,
 * and embedded sub-devices.
 *
 * @param {string} xmlText Raw UPnP description XML.
 * @returns {{
 *   devices: Array<ReturnType<typeof parseUpnpDevice>>,
 *   allDevices: Array<ReturnType<typeof parseUpnpDevice>>,
 *   presentationUrls: string[],
 *   externalUrls: string[],
 *   services: Array<{ device: string, serviceType: string, controlUrl: string, eventSubUrl: string }>,
 *   summary: { rootDevices: number, totalDevices: number, services: number, presentationUrls: number },
 *   findings: string[]
 * }}
 */
export function mineUpnpDescription(xmlText) {
  const xml = String(xmlText || '');
  const devices = splitTopLevelBlocks(xml, 'device').map(parseUpnpDevice);
  const allDevices = devices.flatMap(flattenDeviceTree);

  const presentationUrls = [...new Set(allDevices.map(d => d.presentationUrl).filter(Boolean))];
  const externalUrls = [...new Set(
    allDevices.flatMap(d => [d.modelUrl, d.manufacturerUrl]).filter(u => /^https?:\/\//i.test(u)),
  )];

  const services = [];
  for (const d of allDevices) {
    for (const s of d.services) {
      services.push({
        device: d.friendlyName || d.udn || 'unnamed device',
        serviceType: s.serviceType,
        controlUrl: s.controlUrl,
        eventSubUrl: s.eventSubUrl,
      });
    }
  }

  const summary = {
    rootDevices: devices.length,
    totalDevices: allDevices.length,
    services: services.length,
    presentationUrls: presentationUrls.length,
  };

  const findings = [];
  const named = allDevices.filter(d => d.friendlyName).map(d => d.friendlyName);
  if (named.length) {
    findings.push(`${named.length} UPnP device(s): ${named.slice(0, 8).join(', ')}${named.length > 8 ? ` (+${named.length - 8} more)` : ''}.`);
  }
  const models = [...new Set(allDevices.map(d => [d.manufacturer, d.modelName].filter(Boolean).join(' ')).filter(Boolean))];
  if (models.length) {
    findings.push(`Model fingerprint(s): ${models.slice(0, 6).join(' | ')}${models.length > 6 ? '…' : ''} — ` +
      'drives firmware-version follow-up.');
  }
  if (presentationUrls.length) {
    findings.push(`Presentation URL(s) — usually the admin web UI: ${presentationUrls.slice(0, 6).join(', ')}` +
      `${presentationUrls.length > 6 ? '…' : ''}.`);
  }
  if (externalUrls.length) {
    findings.push(`Vendor URL(s) referenced by the device: ${externalUrls.slice(0, 4).join(', ')} — ` +
      'third-party hosts tied to the device supply chain.');
  }
  const wanServices = services.filter(s => /wanc|wanip|wanppp/i.test(s.serviceType));
  if (wanServices.length) {
    findings.push(`${wanServices.length} WAN-facing service(s) (WANIPConnection/WANPPPConnection): ` +
      'this device manages the internet uplink — its control URLs are high-value.');
  }
  const serials = [...new Set(allDevices.map(d => d.serialNumber).filter(Boolean))];
  if (serials.length) {
    findings.push(`Serial number(s) disclosed: ${serials.slice(0, 4).join(', ')} — hardware identity for asset correlation.`);
  }
  if (!devices.length) {
    findings.push('No <device> blocks parsed — confirm the input is UPnP device-description XML.');
  }

  return { devices, allDevices, presentationUrls, externalUrls, services, summary, findings };
}
