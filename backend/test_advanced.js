import { request } from 'http';

async function run() {
  try {
    const loginReq = request({
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', async () => {
        const cookie = res.headers['set-cookie']?.[0];
        if (!cookie) {
          console.error("No cookie:", body);
          return;
        }

        const authHeaders = {
          'Content-Type': 'application/json',
          'Cookie': cookie
        };

        const postChat = (data) => new Promise((resolve, reject) => {
          const req = request({
            hostname: '127.0.0.1',
            port: 4000,
            path: '/api/v1/infinite/chat',
            method: 'POST',
            headers: authHeaders
          }, res2 => {
            let body2 = '';
            res2.on('data', d => body2 += d);
            res2.on('end', () => resolve({ status: res2.statusCode, data: JSON.parse(body2) }));
          });
          req.on('error', reject);
          req.write(JSON.stringify(data));
          req.end();
        });

        const cid = 'c_adv_' + Date.now();

        console.log("=== TEST 1: Simple chat ===");
        const r1 = await postChat({ conversationId: cid, message: 'Hello' });
        console.log("Response:", r1.data.reply);

        console.log("\n=== TEST 2: Identity ===");
        await postChat({ conversationId: cid, message: 'My name is Bhavesh.' });
        const r2 = await postChat({ conversationId: cid, message: 'What is my name?' });
        console.log("Response:", r2.data.reply);

        console.log("\n=== TEST 4: Large prompt ===");
        const largePrompt = 'Repeat the word APPLE 500 times. ' + 'APPLE '.repeat(500);
        const r4 = await postChat({ conversationId: cid, message: largePrompt });
        console.log("Status:", r4.status);
        console.log("Response starts with:", r4.data.reply?.substring(0, 100));

        console.log("\n=== TEST 5: Rapid sequential messages ===");
        // Sending 3 messages concurrently
        const p1 = postChat({ conversationId: cid, message: 'What is 2+2? Reply with number only.' });
        const p2 = postChat({ conversationId: cid, message: 'What is 3+3? Reply with number only.' });
        const p3 = postChat({ conversationId: cid, message: 'What is 4+4? Reply with number only.' });
        const results = await Promise.all([p1, p2, p3]);
        console.log("Results of concurrent requests (Queue should have handled them serially without 429):");
        results.forEach((r, i) => console.log(`Msg ${i+1}: Status=${r.status} Reply=${r.data.reply}`));

      });
    });
    
    loginReq.write(JSON.stringify({ email: `test1790686185899@darkmatter.local`, password: 'password123' }));
    loginReq.end();
  } catch(e) {
    console.error(e);
  }
}
run();
