// Plain-English activity feed — extracted from HuntCard.jsx (P6).
// Translates technical log entries into "I did this" narration anyone
// can understand. Pure function of (logs, target); returns the last 8
// deduplicated entries.
export function humanizeActivityLogs(logs, target) {
  const out = [];
  const seen = new Set();
  for (const entry of logs) {
    const text = entry.text || '';
    let emoji = '💭';
    let human = null;
    if (entry.kind === 'finding') {
      emoji = '🎯';
      human = `I found something: ${text.slice(0, 120)}`;
    } else if (entry.kind === 'tool') {
      const t = text.toLowerCase();
      // Human-mode GUI actions (Lane V): the line carries the tool
      // name + detail ("browser_open http://…/ftp"), so name what
      // the hunter actually did. These used to fall through to one
      // generic line, deduped by text into invisibility — the
      // activity feed showed nothing of human mode at all.
      if (t.startsWith('browser_open')) {
        const u = (text.match(/https?:\/\/\S+/) || [])[0];
        emoji = '🌐'; human = u ? `I opened ${u.slice(0, 80)} in my browser` : 'I opened a page in my browser';
      }
      else if (t.startsWith('browser_click')) { emoji = '🖱️'; human = `I clicked ${text.replace(/^browser_click\s*/i, '').slice(0, 60) || 'a page element'}`; }
      else if (t.startsWith('browser_type')) { emoji = '⌨️'; human = 'I typed into the page'; }
      else if (t.startsWith('browser_snapshot')) { emoji = '👀'; human = 'I took a close look at the page'; }
      else if (t.includes('nmap')) { emoji = '🔍'; human = 'I scanned the target for open ports'; }
      else if (t.includes('subdomain') || t.includes('subfinder') || t.includes('amass')) { emoji = '🌐'; human = 'I enumerated subdomains'; }
      else if (t.includes('nuclei')) { emoji = '🔬'; human = 'I ran vulnerability checks'; }
      else if (t.includes('curl') || t.includes('wget')) { emoji = '📡'; human = 'I fetched a web page to inspect it'; }
      else if (t.includes('sqlmap') || t.includes('sql')) { emoji = '💉'; human = 'I tested for SQL injection'; }
      else if (t.includes('xss')) { emoji = '⚡'; human = 'I tested for cross-site scripting'; }
      else if (t.startsWith('shell')) { emoji = '💻'; human = `I ran a command: ${text.replace(/^shell\s*/i, '').slice(0, 70)}`; }
      else { emoji = '🔧'; human = `I ran a security test`; }
    } else {
      // thinking entries — make them first-person and friendly
      const t = text.toLowerCase();
      if (t.includes('dedup_block')) { emoji = '🛑'; human = 'I caught myself repeating an action — my own record stopped it'; }
      else if (t.includes('reconnaissance') || t.includes('mapping the attack')) { emoji = '🗺️'; human = 'I started mapping the website'; }
      else if (t.includes('understanding target')) { emoji = '👀'; human = `I'm looking at ${target}`; }
      else if (t.includes('iteration')) { const m = text.match(/iteration\s+(\d+)/i); emoji = '🔄'; human = m ? `I'm on round ${m[1]} of testing` : 'I continued testing'; }
      else if (t.includes('business-logic') || t.includes('bl module')) { emoji = '🧠'; human = 'I planned business-logic attack scenarios'; }
      else if (t.includes('checkpoint') || t.includes('resum')) { emoji = '💾'; human = 'I picked up from where I left off'; }
      else if (t.includes('finished')) { emoji = '✅'; human = 'I finished the hunt'; }
      else if (t.includes('paused')) { emoji = '⏸️'; human = 'I paused — waiting for you'; }
      else if (t.includes('stopped')) { emoji = '⏹️'; human = 'I stopped the hunt'; }
      if (!human && text.trim()) {
        // Lane V: human-mode thinking is free-form first-person
        // reasoning that matches none of the pipeline-era patterns
        // above; dropping it froze this feed at the last pipeline
        // narration line while the hunter kept working. Show the
        // reasoning itself, trimmed to a feed line.
        human = text.replace(/\s+/g, ' ').trim().slice(0, 140);
      }
    }
    if (human && !seen.has(human)) {
      seen.add(human);
      out.push({ emoji, text: human, at: entry.at });
    }
  }
  return out.slice(-8);
}
