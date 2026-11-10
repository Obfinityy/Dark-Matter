# Insufficient anti-automation / bot abuse probe (`anti-automation`, coverage row #79 [Medium])

`backend/src/scanner/probes/antiAutomation.js` — login-oracle probe reusing the
credential-stuffing (#42) evidence surface.

## How it works

- **Calibration.** Discovers a login endpoint from the mined apiRoutes (never
  invented) and tries the two JSON body shapes in order — `{ email, password }`
  then `{ username, password }`. The first ordinary invalid-credentials answer
  (401, or a 400/200 carrying an invalid-credentials message) calibrates the
  oracle; any other answer moves to the next shape, then the next candidate.
- **The test.** 9 more distinct fixed wrong passwords (`dm-bot-pass-01` …),
  back-to-back with no delay — the attempts themselves are the automation under
  test. Every response is checked twice: first for a **bot challenge** (CAPTCHA
  widget markers, challenge-page wording, JS-challenge markers), then for a
  **throttle** signal (the same `assessLoginResponse` calibration as #42).
- **Firing rule.** A finding (`Login accepts repeated automated attempts with no
  bot challenge`, Medium, class `anti_automation`) is filed only when ALL 10
  wrong passwords are each answered as ordinary invalid-credential responses
  with no bot challenge and no throttle anywhere. The FIRST bot challenge or
  throttle signal stops the probe immediately with `[]` — the defense exists.

## Relation to #42

Credential-stuffing confirms the same 10/10 observable framed as credential
replay (leaked pairs). #79 confirms it framed as missing bot defense, with a
BROADER challenge detector: #42's throttle text already catches the word
`captcha`, but #79 additionally catches challenge widgets (reCAPTCHA / hCaptcha
/ Turnstile markers), challenge pages ("Just a moment", "checking your
browser") and JS-challenge markers that never contain the word `captcha`. The
two rows are distinct findings (different class, different title) on a shared
evidence surface — never a duplicate.

## Honest limits

- A server-side INVISIBLE bot score (silent risk scoring that never surfaces in
  a response) is unobservable black-box: the probe judges only observable
  challenges. A shop with silent scoring and no visible challenge confirms —
  the evidence says the challenge is absent from every response, not that no
  scoring exists.
- The detector is deliberately conservative in the safe direction: any
  challenge marker anywhere in a response counts as a defense, even a help-text
  mention. That can only hide a finding, never create one.
- Form-only logins (DVWA login.php) are an honest no-op by design: the probe
  speaks JSON login APIs only (Juice Shop POST /rest/user/login).
