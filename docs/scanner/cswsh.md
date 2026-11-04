# Cross-Site WebSocket Hijacking (CSWSH) Probe

## What it is

A WebSocket connection starts as an ordinary HTTP request with
`Upgrade: websocket`. The Same-Origin Policy does NOT stop a cross-origin page
from opening one: the victim's browser sends the handshake to the target WITH
the victim's cookies. If the server upgrades the socket without validating the
`Origin` header, an attacker's page gets a live, victim-authenticated socket —
read the victim's messages, send messages AS the victim. That is Cross-Site
WebSocket Hijacking (the WS analog of CSRF, but full-duplex). Everything about
it is testable with predefined handshake requests — no AI, no browser, no DOM.

## Detection surface

1. **Known-path Upgrade probes** (max 6): `/ws`, `/websocket`, `/socket.io/`,
   `/cable`, `/realtime`, `/notifications` — send the handshake;
   `101 Switching Protocols` = endpoint confirmed. Scheme follows the page
   (`wss://` on https, `ws://` on http).
2. **Passive bundle scan**: `new WebSocket(`, `wss://`, `ws://`,
   `graphql-ws`, `socket.io`, `SockJS`, `actioncable`, `/cable`.
3. GraphQL subscription endpoints found by probe #28 feed straight in here.

**Transport:** `fetch` cannot do the HTTP Upgrade, so the probe uses a raw
socket (`node:net` / `node:tls`, ~40 lines, zero new deps) — the only
house-style deviation, forced by the protocol.

**Safety:** handshake-only probing; after 101 the probe sends a clean close
frame (`0x88 0x00`) and never emits application messages. Read-only by
construction.

## Sub-tests

### T1. Origin validation on the handshake — HIGH if missing (core CSWSH condition)

Craft the Upgrade request by hand: `GET <path> HTTP/1.1`, `Host`,
`Upgrade: websocket`, `Connection: Upgrade`,
`Sec-WebSocket-Key: <base64(canary)>`, `Sec-WebSocket-Version: 13`,
`Origin: https://evil.example`. 5s timeout.

- **CANARY** (kills cached/generic 101s): the `Sec-WebSocket-Accept` response
  header MUST equal `base64(sha1(ourKey + 258EAFA5-E914-47DA-95CA-C5AB0DC85B11))`
  computed from OUR canary key (RFC 6455 §1.3). Mismatch = not our 101 —
  discard, no finding.
- **ORACLE** (differential, 3 handshakes): (a) legitimate Origin (target's
  own), (b) `Origin: https://evil.example`, (c) no Origin header. CONFIRMED
  HIGH ("missing Origin validation — CSWSH possible") only if (b) → 101 with
  a valid accept for our canary. If (b) → 403/400 while (a) → 101, the origin
  check is present: no finding.

**Reference:** PortSwigger CSWSH lab, OWASP WebSocket cheat sheet §origin check.

### T2. Cookie-authenticated socket from cross-origin context — HIGH / MEDIUM

**Precondition:** T1 proved no origin check. Repeat the evil-Origin handshake
WITH the session cookie jar the scanner already holds.

- **ORACLE:** 101 + the server's first frames arrive in an authenticated
  context (subscription ack, user payload — anything the anonymous T1
  handshake did not receive) with NO further auth message from us → the
  socket is authenticated as the victim from a cross-origin page = full
  CSWSH, CONFIRMED HIGH.
- If 101 but the server demands an auth message/token before any data:
  downgrade to MEDIUM ("origin check missing, but application-layer auth
  required") with the exact server behavior as evidence.

Read-only: handshake + close only; capture ≤3 initial frames, 5s window,
send zero application messages.

### T3. Auth token embedded in the WebSocket URL — LOW

Bundle-string check (no request needed): `wss://host/path?token=`,
`?access_token=`, `?auth=`. Tokens in URLs leak via proxy logs, Referer
headers, and browser history. Confirm the endpoint still upgrades, then file
LOW.

**Reference:** OWASP WebSocket cheat sheet §authentication.

### T4. Sensitive data pushed on connect, no client auth — MEDIUM / HIGH

Differential: anonymous handshake (no cookies) vs cookie handshake; capture
first frames of each (5s window, then close).

CONFIRMED only if the authenticated socket's first frames contain sensitive
fields via the predefined regex
(`email|password|token|balance|ssn|address|phone|api[_-]?key`) AND the
anonymous socket's frames do not (or anonymous gets 403/close). Canary: run
each side twice; the sensitive-field set must be stable across both runs
(kills one-off greeting frames).

Severity: HIGH if the pushed data includes credentials/tokens/financials,
MEDIUM for PII-only.

## Depth gating

- **Quick:** T1 only.
- **Standard / Deep:** full battery (T1–T4).

## Scan-time budget

T1 ≈ 3 handshakes, T2 ≈ 2, T4 ≈ 4 → under 10 handshakes per endpoint, each
<1s — seconds-scale, $0 AI.

## v1 limits (documented)

Message-level injection or CSRF-via-WebSocket-message (needs per-app protocol
knowledge — future), socket.io polling-transport quirks (protocol-specific —
future), frame-flooding DoS (out of scope, same no-amplification rule as #28).

## #270 — WebSocket unencrypted channel on HTTPS site — MEDIUM

Owned by `wsMessages.js` (`t270Unencrypted`), runs BEFORE the D1 inventory
early-return: a referenced `ws://` URL exists regardless of whether any live
`wss://` endpoint is found.

**Method.**
1. HTTPS pages only. Fetch the target page HTML; extract `ws://` URLs via
   regex. Also fetch up to 3 same-origin `<script src>` bundles and extract
   `ws://` URLs from them (bounded: ≤4 requests).
2. Each distinct `ws://` reference on an HTTPS page =
   `ws_unencrypted_channel` (medium), `parameter` = the ws URL. Evidence notes
   that tokens/messages sent over the channel are network-readable.
3. Standard/Deep only: **active confirmation** — attempt a real `ws://`
   handshake to the same host:port using the probe's RFC 6455 client. A 101
   response upgrades the evidence ("cleartext channel LIVE"); a failed
   handshake keeps the finding with passive evidence (the reference itself is
   the vuln — the page instructs clients to go cleartext).

**Proof criteria.** Positive = HTTPS page references `ws://` (not `wss://`).
HTTP pages never fire (no downgrade). Pages with no `ws://` refs never fire.

**Limits.** Detection only — no frame content is read or sent beyond the
handshake. Subresource integrity / CSP of the referencing script is out of
scope.
