# Sensitive File Exposure

## What it is
Deployment artifacts and debug endpoints left publicly reachable leak
source code, secrets, or server internals.

## How Dark Matter checks it
The scanner requests a fixed list of sensitive paths and checks for
content markers — not just HTTP 200 (which catches custom 404 pages).

Probe: `backend/src/scanner/probes/files.js` (`probeSensitiveFiles`).

## Paths and markers
| Path | Marker | Severity |
|---|---|---|
| `/.git/HEAD` | `ref:` | high |
| `/.env` | `=` | critical |
| `/phpinfo.php` | `phpinfo()` | medium |
| `/server-status` | `Apache Status` | medium |
| `/.DS_Store` | (any 200) | low |

## What counts as proof (oracle)
HTTP 200 **with** the content marker (`signalCorrelated: true`).

## Limits
Fixed path list in v1. Wordlist-driven discovery (ffuf/gobuster phase in
`docker/tools/`) extends coverage in later versions.

## Disclosure legs (rows #409 / #410, 14 Nov 2026)

Same `files` phase, separate probe: `backend/src/scanner/probes/disclosure.js`
(`probeDisclosure`). No new phase — `DEFAULT_PHASES` stays 148.

### #409 — robots.txt / sitemap.xml listing sensitive paths

The probe fetches `/robots.txt` and `/sitemap.xml` (read-only GETs,
redirects never followed) and flags a listed path that matches the
sensitive list: admin areas (`/admin`, `/wp-admin`, `/administrator`,
`/phpmyadmin`), backups (`.bak`, `.old`, `.sql`, `.zip`/`.tar`/`.gz`,
`backup`, `dump`), VCS/config (`.git`, `.svn`, `.env`, `/config`),
`/private`, `/internal`, `/secret`, `/staging`, `/dev/`, `/cgi-bin`.

Confirmation requires all three gates (same SPA discipline as the
file probe above):

1. A DIRECT 200 — redirects are never followed.
2. The body is NOT the origin's catch-all: a random nonexistent path
   must not return the same 200 body.
3. The body actually parses as a robots file (a `User-agent` /
   `Disallow` / `Allow` / `Sitemap` line) or a sitemap (`<urlset>` /
   `<sitemapindex>` with `<loc>` entries).

A bare `Disallow: /` or a public page (`/about`, `/contact`) never
fires. One finding per distinct sensitive path (capped at 5 per file),
severity low, class `robots_sitemap_disclosure`. Sitemap indexes are
NOT chased in v1 — their `<loc>` entries name sub-sitemap files, not
content paths.

### #410 — secrets / internals inside HTML comments

The probe extracts `<!-- ... -->` comments from the landing-page HTML
(the fingerprint step's `fp.body` — zero extra requests in-scan; a
single fallback GET when no HTML is passed) and matches secret /
internals patterns inside them:

| Signal | Example | Finding |
|---|---|---|
| Private-key block | `-----BEGIN RSA PRIVATE KEY-----` | `Private key block in HTML comment` |
| AWS access key | `AKIA…` (16 chars) | `AWS access key in HTML comment` |
| Connection string with credentials | `mongodb://user:pass@host/db` | `Database connection string…` |
| Credential assignment | `password: hunter2`, `api_key = AKIA…` | `Secret in HTML comment — password assignment` |
| Internal hostname / IP | `db01.corp.example.com`, `10.0.0.5` | `Internal hostname in HTML comment` |

Gates: SSI directives (`<!--#...-->`) and conditional comments
(`<!--[if ...]>`) are skipped; placeholders (`***`, `xxx`, `null`,
`changeme`, `your-password`, `test`) never fire; secret/key values
must be token-like (≥ 8 chars, token charset — same gate as
`credentialDisclosure.js`); password params fire on any non-empty,
non-placeholder value. Visible text never fires — that is row #41's
surface (`credentialDisclosure.js` strips comments for exactly this
reason). One finding per comment (strongest signal names it;
evidence lists every matched kind), capped at 5, severity low, class
`html_comment_secret`. Credential values are masked in evidence
(first 4 + last 2 chars) and never published in full.
