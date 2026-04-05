const https = require('https');

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'valhallagroominghouse.onrender.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log("Probando Login con 604380270...");
  const login1 = await makeRequest('POST', '/api/login', { username: '604380270', password: 'jose1997' });
  console.log("Status:", login1.status, "Body:", login1.body);

  console.log("Probando Login con josemrojasamaya@gmail.com...");
  const login2 = await makeRequest('POST', '/api/login', { username: 'josemrojasamaya@gmail.com', password: 'josemiguel1997' });
  console.log("Status:", login2.status, "Body:", login2.body);
}

run();
