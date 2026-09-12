/**
 * Keep-alive script to prevent Render from putting the server to sleep
 * This pings the server every 10 minutes
 */

const https = require('https');

const BACKEND_URL = 'https://pasan-enterprises-whk8.onrender.com';
const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

function pingServer() {
  const url = `${BACKEND_URL}/api/health`;
  
  console.log(`[${new Date().toISOString()}] Pinging server: ${url}`);
  
  https.get(url, (res) => {
    console.log(`[${new Date().toISOString()}] Server responded with status: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Ping failed:`, err.message);
  });
}

// Ping immediately on start
pingServer();

// Then ping every 10 minutes
setInterval(pingServer, PING_INTERVAL);

console.log(`Keep-alive service started. Pinging ${BACKEND_URL} every 10 minutes.`);
