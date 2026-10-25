const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const SERVER_DIR = path.resolve(__dirname, '..');

console.log('\x1b[36m============================================================\x1b[0m');
console.log('\x1b[32m🚀 Starting Drishti Platform (M4 Server + Live Cloudflare Tunnel)...\x1b[0m');
console.log('\x1b[36m============================================================\x1b[0m\n');

// 1. Start Drishti Backend Server
const serverProcess = spawn('node', ['--max-old-space-size=4096', 'index.js'], {
  cwd: SERVER_DIR,
  stdio: 'inherit',
});

let tunnelProcess = null;

// Helper to poll port 5000 until server is ready
function waitForServer(callback, attempts = 0) {
  if (attempts > 30) {
    console.error('❌ Server took too long to start.');
    return;
  }

  const req = http.get('http://127.0.0.1:5000/api/health', (res) => {
    if (res.statusCode === 200) {
      callback();
    } else {
      setTimeout(() => waitForServer(callback, attempts + 1), 500);
    }
  });

  req.on('error', () => {
    setTimeout(() => waitForServer(callback, attempts + 1), 500);
  });
}

// 2. Once server responds on 5000, start tunnel runner
waitForServer(() => {
  console.log('\n\x1b[32m✅ Backend server is live! Now connecting Cloudflare Tunnel...\x1b[0m\n');
  tunnelProcess = spawn('node', ['server/scripts/run-tunnel.js'], {
    cwd: path.resolve(SERVER_DIR, '..'),
    stdio: 'inherit',
  });
});

function cleanup() {
  if (tunnelProcess) {
    try { tunnelProcess.kill('SIGTERM'); } catch (e) {}
  }
  if (serverProcess) {
    try { serverProcess.kill('SIGTERM'); } catch (e) {}
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
