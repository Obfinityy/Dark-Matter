// Test for Lane AI (24 Oct 2026) — temp-mail inbox + code extraction.
//
// All provider I/O runs against injected stub fetch implementations
// (deterministic, no network in the suite). The LIVE provider
// verification from EC2 is documented in solver-lane-ai.md: mail.tm
// account+token+poll and GuerrillaMail inbox+poll+fetch were all
// exercised against the real APIs from the hunt box on 24 Oct 2026
// (EC2 blocks outbound port 25, so a full external send→receive
// loop could not be completed from there — the first real signup
// attempt is the arrival test, and a poll timeout is the honest
// blocker signal for it).
//
// Run: node backend/scripts/test-tempmail.mjs
import {
  createInboxPreferred,
  listInboxMessages,
  extractVerificationCode,
  pollForCode,
} from '../src/tempmail.js';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const jsonRes = (obj) => ({ ok: true, status: 200, json: async () => obj });

// mail.tm stub: domains -> accounts -> token -> messages (empty, then one code mail)
function mailtmStubFactory() {
  let polls = 0;
  return async (url, opts = {}) => {
    if (url.endsWith('/domains')) return jsonRes({ 'hydra:member': [{ domain: 'stubmail.test', isActive: true }] });
    if (url.endsWith('/accounts') && opts.method === 'POST') return jsonRes({ id: 'acc1', address: 'obfinity-x@stubmail.test' });
    if (url.endsWith('/token')) return jsonRes({ token: 'stub-token-123' });
    if (/\/messages\/[^/]+$/.test(url)) return jsonRes({ id: 'm1', text: 'Your verification code is 739214. It expires in 10 minutes.' });
    if (url.endsWith('/messages')) {
      polls++;
      return jsonRes(polls < 2
        ? { 'hydra:member': [] }
        : { 'hydra:member': [{ id: 'm1', subject: 'Verify', from: { address: 'noreply@target.test' }, createdAt: '2026-10-24T00:00:00Z', intro: 'Your verification code' }] });
    }
    throw new Error(`unexpected mail.tm url ${url}`);
  };
}

// GuerrillaMail stub: inbox -> empty check -> welcome + code mail
function guerrillaStubFactory() {
  let polls = 0;
  return async (url) => {
    if (url.includes('f=get_email_address')) return jsonRes({ email_addr: 'abc123@guerrillamailblock.com', sid_token: 'sid-stub' });
    if (url.includes('f=check_email')) {
      polls++;
      return jsonRes(polls < 2
        ? { list: [] }
        : { list: [{ mail_id: 7, mail_subject: 'Code', mail_from: 'noreply@target.test', mail_body: 'Hi, your OTP is 482917. Thanks.' }] });
    }
    throw new Error(`unexpected guerrilla url ${url}`);
  };
}

const failingFetch = async () => { throw new Error('network down'); };

// ---- provider selection -----------------------------------------------------
{
  const inbox = await createInboxPreferred(mailtmStubFactory());
  check('mail.tm primary: inbox issued', inbox.provider === 'mail.tm' && inbox.address.endsWith('@stubmail.test') && inbox.token === 'stub-token-123');
  const stub = mailtmStubFactory();
  const empty = await listInboxMessages(inbox, stub);
  const full = await listInboxMessages(inbox, stub);
  check('mail.tm: list empty then full-detail message', empty.length === 0 && full.length === 1 && full[0].text.includes('739214'));
}
{
  // mail.tm down -> GuerrillaMail fallback
  const mixedFetch = async (url, opts) => {
    if (url.includes('mail.tm')) throw new Error('mail.tm down');
    return guerrillaStubFactory()(url, opts);
  };
  const inbox = await createInboxPreferred(mixedFetch);
  check('fallback: guerrilla inbox when mail.tm fails', inbox.provider === 'guerrillamail' && inbox.address.includes('@guerrillamailblock.com'));
}
{
  let threw = false;
  try { await createInboxPreferred(failingFetch); } catch { threw = true; }
  check('all providers down -> throws', threw);
}

// ---- code extraction --------------------------------------------------------
check('extract: keyword-proximate code', extractVerificationCode('Your verification code is 739214. It expires soon.') === '739214');
check('extract: OTP phrasing', extractVerificationCode('Hi, your OTP is 482917. Thanks.') === '482917');
check('extract: bare digits fallback (first)', extractVerificationCode('Order 123456 shipped') === '123456');
check('extract: keyword beats earlier bare digits', extractVerificationCode('Ticket 999999 — verification code: 112233') === '112233');
check('extract: no digits -> null', extractVerificationCode('Welcome to the site!') === null);
check('extract: 3-digit and 9-digit ignored', extractVerificationCode('call 123 or 123456789') === null);
check('extract: empty safe', extractVerificationCode('') === null);

// ---- polling ----------------------------------------------------------------
{
  const inbox = { provider: 'mail.tm', address: 'obfinity-x@stubmail.test', token: 'stub-token-123' };
  const res = await pollForCode(inbox, { maxPolls: 3, intervalMs: 1, sleep: async () => {}, fetchFn: mailtmStubFactory() });
  check('poll: code found on 2nd poll', res.ok === true && res.code === '739214' && res.polls === 2);
}
{
  const inbox = { provider: 'guerrillamail', address: 'abc123@guerrillamailblock.com', token: 'sid-stub' };
  const res = await pollForCode(inbox, { maxPolls: 3, intervalMs: 1, sleep: async () => {}, fetchFn: guerrillaStubFactory() });
  check('poll: guerrilla code found', res.ok === true && res.code === '482917');
}
{
  const inbox = { provider: 'mail.tm', address: 'obfinity-x@stubmail.test', token: 'stub-token-123' };
  const neverFetch = async (url, opts = {}) => {
    if (url.endsWith('/messages')) return jsonRes({ 'hydra:member': [] });
    return mailtmStubFactory()(url, opts);
  };
  const res = await pollForCode(inbox, { maxPolls: 3, intervalMs: 1, sleep: async () => {}, fetchFn: neverFetch });
  check('poll: timeout is a bounded blocker signal', res.ok === false && res.reason === 'timeout' && res.polls === 3);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
