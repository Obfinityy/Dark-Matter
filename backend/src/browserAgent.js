// Dark Matter — Browser Automation via Playwright.
// Lets the hunt agent USE the site like a human: click, type, navigate,
// observe network traffic, intercept requests.

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Run a Playwright script in the hunt container.
 * The script can: goto URLs, click, fill forms, capture requests/responses.
 */
export async function runBrowserTask(huntId, script, timeoutMs = 60000) {
  // Write script to temp file and execute with node
  const scriptB64 = Buffer.from(script).toString('base64');
  const cmd = `node -e "
    const { chromium } = require('playwright');
    (async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      const requests = [];
      page.on('request', r => requests.push({ url: r.url(), method: r.method() }));
      page.on('response', r => requests.push({ url: r.url(), status: r.status() }));
      const scriptFn = new Function('page', 'requests', Buffer.from('${scriptB64}', 'base64').toString());
      const result = await scriptFn(page, requests);
      await browser.close();
      console.log(JSON.stringify({ result, requests: requests.slice(0, 50) }));
    })();
  "`;
  try {
    const { stdout } = await execAsync(cmd, { timeout: timeoutMs });
    return JSON.parse(stdout);
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Pre-built: crawl a site and extract forms, links, API endpoints.
 * This is what a human does first — explore the site.
 */
export function crawlScript(target) {
  return `
    await page.goto('${target}', { waitUntil: 'networkidle', timeout: 30000 });
    const forms = await page.$$eval('form', forms => forms.map(f => ({
      action: f.action,
      method: f.method,
      inputs: Array.from(f.querySelectorAll('input, textarea, select')).map(i => ({
        name: i.name, type: i.type, id: i.id
      }))
    })));
    const links = await page.$$eval('a[href]', els => els.map(e => e.href).slice(0, 50));
    return { forms, links: links.slice(0, 30), title: await page.title() };
  `;
}

/**
 * Pre-built: test a form for XSS by filling it with a payload.
 */
export function xssProbeScript(target, formIndex, payload) {
  return `
    await page.goto('${target}', { waitUntil: 'networkidle', timeout: 30000 });
    const forms = await page.$$('form');
    if (forms[${formIndex}]) {
      const inputs = await forms[${formIndex}].$$('input[type="text"], textarea');
      for (const input of inputs) {
        await input.fill('${payload.replace(/'/g, "\\'")}');
      }
      await forms[${formIndex}].evaluate(f => f.submit());
      await page.waitForTimeout(2000);
      const content = await page.content();
      return { reflected: content.includes('${payload.slice(0, 20)}'), url: page.url() };
    }
    return { error: 'form not found' };
  `;
}
