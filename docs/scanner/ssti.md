# Server-Side Template Injection (SSTI)

## What it is
User input is evaluated as a template expression, letting an attacker
execute code on the server.

## How Dark Matter checks it
For every discovered parameter, the scanner injects template
expressions and confirms ONLY on the evaluated value — never on a
literal reflection.

Probe: `backend/src/scanner/probes/ssti.js` (`probeSsti`, phase
`'ssti'`) — the generic `{{ }}` oracle.
Probe: `backend/src/scanner/probes/sstiPebble.js`
(`probeSstiPebble`, phase `'ssti-pebble'`) — Pebble fingerprinting.
Probe: `backend/src/scanner/probes/sstiEngines.js`
(`probeSstiEngines`, phase `'ssti-engines'`) — engine-specific legs
for FreeMarker, Velocity, Thymeleaf, Smarty, ERB, Handlebars and Pug.

## Payloads used
Generic oracle: `{{1336*7}}` (Jinja2/Twig/Blade — `{{ }}` engines).
The oracle is `9352`, not `49`: a 2-digit result can coincide with a
random token substring, and — disproven by proof #18 (8 Nov 2026) —
so can a 4-digit product (DVWA login.php mints a fresh 32-hex
user_token per GET, and one payload response's token contained 9352
while the control's did not, firing a CRITICAL false positive on a
page that never evaluates templates).

Engine legs (`sstiEngines.js`; each engine's arithmetic leg plus a
discriminator leg only that engine evaluates, with the false branch
as the nonsense control — the Pebble shape):
- FreeMarker: `${1336*7}`, `${(true)?then(9352,1111)}`,
  `${(false)?then(9352,1111)}`.
- Velocity: `#set($dmv=1336*7)$dmv`, `#if(true)9352#else 1111#end`,
  `#if(false)9352#else 1111#end`.
- Thymeleaf: `${1336*7}`, `${#strings.toUpperCase('dmtest')}`,
  `${false ? 9352 : 1111}`.
- Smarty: `{math equation="1336*7"}`, `{if true}9352{else}1111{/if}`,
  `{if false}9352{else}1111{/if}`.
- ERB: `<%= 1336*7 %>`, `<%= true ? 9352 : 1111 %>`,
  `<%= false ? 9352 : 1111 %>`.
- Handlebars: `{{#if true}}9352{{else}}1111{{/if}}`,
  `{{#if false}}9352{{else}}1111{{/if}}` (no arithmetic leg —
  `{{ }}` is a lookup in Handlebars, so the `#if` block helper IS
  the evaluation proof).
- Pug: `#{1336*7}`, `#{true ? 9352 : 1111}`,
  `#{false ? 9352 : 1111}`.

## What counts as proof (oracle)
The response contains `9352` **and not** the literal payload
(`signalCorrelated: true`) — the engine evaluated the expression.
A literal reflection means the input is not evaluated: not a
finding. Confirmation needs BOTH proof-#18 guards from
`oracleGuards.js`: (a) `stripVolatileValues` on the payload body AND
the control, so the oracle can never match inside a fresh token; and
(b) a repeat payload request — the evaluated value must re-appear at
the SAME reflection point (`sameReflectionPoint`) in a second,
independent response. The engine legs add a third check: the
discriminator's false branch must render the other value (`1111`),
never the oracle — a page that merely echoes `9352` fails it.
The engine judge (`assessEngineLeg`) uses `isPayloadReflected`,
which catches the payload in ANY encoding (raw, percent-encoded,
form-encoded, HTML-escaped) — a raw-only literal check would
confirm an HTML-escaped reflection of an ERB payload, whose
`&lt;...&gt;` form still carries the oracle digits.

## Limits
Engine-specific payloads for Tornado and Razor are documented next
steps. FreeMarker, Velocity, Thymeleaf, Smarty, ERB, Handlebars and
Pug are covered since 14 Nov 2026 (phase `'ssti-engines'`); the
generic `{{ }}` oracle never fired on them, because none of those
engines evaluates `{{ }}` arithmetic. The fingerprint's tech
detection picks the right family in later versions. A sink that
evaluates templates only in a POST body or a header is out of scope
(GET params only). Thymeleaf sinks that only evaluate `th:*`
attributes (never raw `${...}` in template text) are also out of
scope: the probe assumes the input is processed as a Thymeleaf
expression, the standard SSTI shape for the engine.
