// Lane AI — OPTIONAL live temp-mail smoke test (NOT part of the suite).
//
// Hits the REAL providers from wherever it runs and checks only
// SHAPE: inbox creation + poll calls succeed. It does NOT assert
// that a real sender's mail arrives (that needs an external mailer;
// EC2 blocks outbound port 25, so arrival is proven by the first
// real signup attempt, and a poll timeout is the honest blocker
// signal). Run: node backend/scripts/tempmail-live-smoke.mjs
import { createInboxPreferred, listInboxMessages } from '../src/tempmail.js';

const inbox = await createInboxPreferred();
console.log('inbox:', inbox.provider, inbox.address);
const messages = await listInboxMessages(inbox);
console.log(`poll ok: ${messages.length} message(s) in inbox`);
console.log('LIVE SMOKE OK (shape only — arrival not asserted)');
