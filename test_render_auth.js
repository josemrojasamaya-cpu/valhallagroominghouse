const http = require('https');

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

    const req = http.request(options, (res) => {
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
  console.log("Creando usuario ADMIN...");
  const createRes = await makeRequest('POST', '/api/users', { username: 'admin', password: '123', role: 'admin' });
  console.log("Create Admin:", createRes.status, createRes.body);

  console.log("Probando Login con Admin...");
  const loginRes = await makeRequest('POST', '/api/login', { username: 'admin', password: '123' });
  console.log("Login Admin:", loginRes.status, loginRes.body);

  console.log("Probando Login con 604380270...");
  const loginUser = await makeRequest('POST', '/api/login', { username: '604380270', password: 'jose1997' });
  console.log("Login User:", loginUser.status, loginUser.body);
}

run();
