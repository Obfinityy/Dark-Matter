/**
 * normalizeTargetUrl — accept what a human pastes and make it a valid URL.
 * "target.com" -> "https://target.com"; "http://x" stays; trims whitespace.
 * Returns the normalized string, or the trimmed input if it can't be a URL.
 */
export function normalizeTargetUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return raw;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname || !url.hostname.includes('.')) return raw;
    return url.toString().replace(/\/$/, '');
  } catch {
    return raw;
  }
}
