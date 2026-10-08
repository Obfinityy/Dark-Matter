/**
 * accessibilityWidgetMapping.js — Accessibility-widget endpoint mapping.
 *
 * Idea 00916: map accessibility overlay endpoints.
 *
 * Defensive engine: maps third-party accessibility overlay/widget integrations
 * (e.g. widget loaders, config APIs, toolbar endpoints) from operator-collected
 * page HTML/JS of an authorized target, so the engagement inventory knows which
 * external accessibility services execute in the page context. Pure parsing —
 * no network calls.
 */

const WIDGET_PATTERNS = [
  { type: 'widget-loader', regex: /(accessi?bility|a11y)[-_ ]?(widget|overlay|toolbar|plugin|helper|assistant|bar)/i, confidence: 'high' },
  { type: 'widget-script', regex: /src=["'][^"']*(accessi?bility|a11y|userway|accessibe|equalweb|audioeye)[^"']*["']/i, confidence: 'high' },
  { type: 'widget-config-api', regex: /(widget|toolbar|overlay)[-_ ]?(config|settings|init|license|account|api)/i, confidence: 'medium' },
  { type: 'widget-cdn', regex: /cdn[^"'\s<>]{0,60}?(accessi?bility|a11y)/i, confidence: 'medium' },
  { type: 'widget-dom-hook', regex: /(id|class)=["'][^"']*(accessibility[-_ ]?(widget|toolbar|overlay|menu))[^"']*["']/i, confidence: 'low' },
];

/**
 * Map accessibility widget/overlay integrations in page text.
 * @param {string} html - Page HTML.
 * @param {string} [baseUrl]
 * @returns {{widgets: {url: string|null, type: string, confidence: string, snippet: string}[]}}
 */
export function mapAccessibilityWidgets(html = '', baseUrl = '') {
  const text = String(html);
  const widgets = [];
  const seen = new Set();
  const urlRegex = /["']((?:https?:)?\/\/[^"'\s<>]+|\/[a-zA-Z0-9_\-./?&=#%:]+)["']/g;
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    const raw = m[1].replace(/&amp;/g, '&');
    for (const pat of WIDGET_PATTERNS) {
      if (pat.regex.test(raw)) {
        const key = raw + pat.type;
        if (!seen.has(key)) {
          seen.add(key);
          let url = raw;
          if (baseUrl && raw.startsWith('/')) {
            try { url = new URL(raw, baseUrl).href; } catch { /* keep raw */ }
          }
          const idx = Math.max(0, m.index - 60);
          widgets.push({
            url,
            type: pat.type,
            confidence: pat.confidence,
            snippet: text.slice(idx, m.index + raw.length + 20).replace(/\s+/g, ' ').slice(0, 200),
          });
        }
      }
    }
  }
  // DOM hooks (inline widget containers) without URLs.
  const hookRegex = /<(div|section|aside|button)\b[^>]*?(id|class)=["']([^"']*(?:accessibility|a11y)[-_ ]?(widget|toolbar|overlay|menu)[^"']*)["'][^>]*>/gi;
  while ((m = hookRegex.exec(text)) !== null) {
    const marker = `${m[2]}=${m[3]}`;
    if (!seen.has(marker)) {
      seen.add(marker);
      widgets.push({ url: null, type: 'widget-dom-hook', confidence: 'low', snippet: m[0].slice(0, 200) });
    }
  }
  return { widgets };
}
