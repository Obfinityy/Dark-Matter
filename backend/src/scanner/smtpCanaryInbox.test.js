// Tests for the local SMTP canary inbox — the $0 sink that proves SMTP
// header injection T2 (Bcc relay) by received mail. All servers bind
// loopback only; no external service, no lab needed.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createSmtpCanaryInbox } from './smtpCanaryInbox.js';

// Minimal SMTP client: enough to speak the sink's subset (EHLO, MAIL,
// RCPT, DATA, QUIT) and prove the sink records what was delivered.
function smtpClient(port) {
  const sock = net.connect(port, '127.0.0.1');
  let buf = '';
  const queue = [];
  const pending = [];
  sock.on('data', (c) => {
    buf += c.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (pending.length) pending.shift()(line);
      else queue.push(line);
    }
  });
  const readLine = () =>
    queue.length ? Promise.resolve(queue.shift()) : new Promise((r) => pending.push(r));
  const send = (s) =>
    new Promise((resolve, reject) => sock.write(s, (e) => (e ? reject(e) : resolve())));
  return { sock, readLine, send };
}

async function sendMail(port, { from, to, headers, body }) {
  const c = smtpClient(port);
  try {
    assert.match(await c.readLine(), /^220/);
    await c.send('EHLO fixture.test\r\n');
    let line;
    do {
      line = await c.readLine();
      assert.match(line, /^250/);
    } while (!/^250 /.test(line));
    await c.send(`MAIL FROM:<${from}>\r\n`);
    assert.match(await c.readLine(), /^250/);
    for (const rcpt of to) {
      await c.send(`RCPT TO:<${rcpt}>\r\n`);
      assert.match(await c.readLine(), /^250/);
    }
    await c.send('DATA\r\n');
    assert.match(await c.readLine(), /^354/);
    await c.send(`${headers}\r\n\r\n${body}\r\n.\r\n`);
    assert.match(await c.readLine(), /^250/);
    await c.send('QUIT\r\n');
    assert.match(await c.readLine(), /^221/);
  } finally {
    c.sock.destroy();
  }
}

function loopbackInbox() {
  return createSmtpCanaryInbox({ listenHost: '127.0.0.1', domain: 'canary.test' });
}

describe('smtpCanaryInbox', () => {
  it('starts on an ephemeral loopback port; check is null before any mail', async () => {
    const inbox = loopbackInbox();
    try {
      assert.equal(inbox.port, null, 'port is null before start');
      const port = await inbox.start();
      assert.ok(Number.isInteger(port) && port > 0, `bad port: ${port}`);
      assert.equal(inbox.port, port);
      assert.equal(inbox.domain, 'canary.test');
      assert.equal(inbox.check('nobody@canary.test'), null);
      assert.equal(inbox.messages.length, 0);
    } finally {
      await inbox.stop();
    }
  });

  it('POSITIVE: delivered mail is recorded with Bcc header, from, body', async () => {
    const inbox = loopbackInbox();
    try {
      const port = await inbox.start();
      await sendMail(port, {
        from: 'noreply@fixture.test',
        to: ['victim@canary.test'],
        headers: 'From: noreply@fixture.test\r\nTo: v@example.invalid\r\nBcc: victim@canary.test\r\nSubject: contact\r\nMessage-ID: <m1@fixture.test>',
        body: 'hello from the contact form',
      });
      assert.equal(inbox.messages.length, 1);
      const msg = inbox.check('victim@canary.test');
      assert.ok(msg, 'check must find the delivered mail');
      assert.match(msg.headers, /Bcc: victim@canary\.test/i);
      assert.match(msg.headers, /Message-ID: <m1@fixture\.test>/i);
      assert.equal(msg.from, 'noreply@fixture.test');
      assert.deepEqual(msg.to, ['victim@canary.test']);
      assert.match(msg.body, /hello from the contact form/);
      assert.ok(msg.at, 'message must carry a timestamp');
      // waitFor resolves at once for already-arrived mail.
      const again = await inbox.waitFor('victim@canary.test', 500);
      assert.ok(again, 'waitFor must resolve immediately for received mail');
      assert.equal(again, msg);
    } finally {
      await inbox.stop();
    }
  });

  it('waitFor pending resolves when the mail arrives later', async () => {
    const inbox = loopbackInbox();
    try {
      const port = await inbox.start();
      const waiting = inbox.waitFor('late@canary.test', 3000);
      await sendMail(port, {
        from: 'a@fixture.test',
        to: ['late@canary.test'],
        headers: 'From: a@fixture.test\r\nBcc: late@canary.test',
        body: 'late delivery',
      });
      const msg = await waiting;
      assert.ok(msg, 'pending waitFor must resolve on delivery');
      assert.match(msg.headers, /Bcc: late@canary\.test/i);
    } finally {
      await inbox.stop();
    }
  });

  it('NEGATIVE: waitFor times out null and check stays null for unknown addresses', async () => {
    const inbox = loopbackInbox();
    try {
      await inbox.start();
      const hit = await inbox.waitFor('never@canary.test', 300);
      assert.equal(hit, null);
      assert.equal(inbox.check('never@canary.test'), null);
      assert.equal(inbox.hasReceived('never@canary.test'), null);
      assert.equal(inbox.messages.length, 0);
    } finally {
      await inbox.stop();
    }
  });

  it('check matches the right recipient, case-insensitively', async () => {
    const inbox = loopbackInbox();
    try {
      const port = await inbox.start();
      await sendMail(port, {
        from: 'a@fixture.test',
        to: ['First@canary.test'],
        headers: 'From: a@fixture.test\r\nBcc: First@canary.test',
        body: 'one',
      });
      await sendMail(port, {
        from: 'a@fixture.test',
        to: ['second@canary.test'],
        headers: 'From: a@fixture.test\r\nBcc: second@canary.test',
        body: 'two',
      });
      assert.equal(inbox.messages.length, 2);
      assert.match(inbox.check('first@canary.test').body, /one/);
      assert.match(inbox.check('SECOND@canary.test').body, /two/);
      assert.equal(inbox.check('third@canary.test'), null);
    } finally {
      await inbox.stop();
    }
  });

  it('header-only match: Bcc in the header block confirms even if the envelope differs', async () => {
    const inbox = loopbackInbox();
    try {
      const port = await inbox.start();
      // A relay that kept the injected Bcc line in the headers but
      // delivered with a rewritten envelope recipient.
      await sendMail(port, {
        from: 'a@fixture.test',
        to: ['rewritten@canary.test'],
        headers: 'From: a@fixture.test\r\nBcc: header-only@canary.test',
        body: 'header match',
      });
      const msg = inbox.check('header-only@canary.test');
      assert.ok(msg, 'check must match the Bcc address in the headers');
      assert.match(msg.body, /header match/);
    } finally {
      await inbox.stop();
    }
  });

  it('dot-stuffing is undone and DATA without RCPT is rejected', async () => {
    const inbox = loopbackInbox();
    try {
      const port = await inbox.start();
      await sendMail(port, {
        from: 'a@fixture.test',
        to: ['dots@canary.test'],
        headers: 'From: a@fixture.test\r\nBcc: dots@canary.test',
        body: '..leading dot stays one dot',
      });
      assert.match(inbox.check('dots@canary.test').body, /^\.leading dot stays one dot/);
      // DATA with no RCPT TO must be a 503 and record nothing.
      const c = smtpClient(port);
      try {
        assert.match(await c.readLine(), /^220/);
        await c.send('EHLO fixture.test\r\n');
        let line;
        do {
          line = await c.readLine();
        } while (!/^250 /.test(line));
        await c.send('MAIL FROM:<a@fixture.test>\r\n');
        assert.match(await c.readLine(), /^250/);
        await c.send('DATA\r\n');
        assert.match(await c.readLine(), /^503/);
        await c.send('QUIT\r\n');
        assert.match(await c.readLine(), /^221/);
      } finally {
        c.sock.destroy();
      }
      assert.equal(inbox.messages.length, 1, 'rejected DATA must not record a message');
    } finally {
      await inbox.stop();
    }
  });

  it('unknown commands get 502; stop() resolves pending waiters null and closes the listener', async () => {
    const inbox = loopbackInbox();
    const port = await inbox.start();
    const c = smtpClient(port);
    try {
      assert.match(await c.readLine(), /^220/);
      await c.send('XYZZY\r\n');
      assert.match(await c.readLine(), /^502/);
    } finally {
      c.sock.destroy();
    }
    const waiting = inbox.waitFor('pending@canary.test', 10000);
    await inbox.stop();
    assert.equal(await waiting, null);
    assert.equal(await inbox.waitFor('late@canary.test', 5000), null, 'waitFor after stop resolves null at once');
    // Listener closed: a new TCP connect must fail.
    await new Promise((resolve, reject) => {
      const s = net.connect(port, '127.0.0.1');
      s.on('connect', () => {
        s.destroy();
        reject(new Error('listener still accepting connections after stop'));
      });
      s.on('error', () => resolve());
    });
  });
});
