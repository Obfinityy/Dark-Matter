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

        // Test 1: Simple chat
        console.log("=== Test: Python Game ===");
        const start = Date.now();
        const r1 = await postChat({ conversationId: 'c1', message: 'ek program bana python mai game bana k de' });
        console.log("Time taken:", Date.now() - start, "ms");
        console.log(r1.data);

      });
    });
    
    loginReq.write(JSON.stringify({ email: `test1790686185899@darkmatter.local`, password: 'password123' }));
    loginReq.end();

  } catch(e) {
    console.error(e);
  }
}
run();
