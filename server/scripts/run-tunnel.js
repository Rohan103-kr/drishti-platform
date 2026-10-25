const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { syncTunnelQR } = require('./sync-tunnel-qr');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const LOCAL_CLOUDFLARED = path.join(PROJECT_ROOT, 'server/cloudflared');

// 1. Terminate any previous cloudflared processes
try {
  execSync('pkill -9 -f cloudflared', { stdio: 'ignore' });
} catch (e) {}

// 2. Find cloudflared binary
let cloudflaredBin = null;
try {
  const whichOut = execSync('which cloudflared', { encoding: 'utf8' }).trim();
  if (whichOut && fs.existsSync(whichOut)) {
    cloudflaredBin = whichOut;
  }
} catch (e) {}

if (!cloudflaredBin && fs.existsSync(LOCAL_CLOUDFLARED)) {
  cloudflaredBin = LOCAL_CLOUDFLARED;
}

if (!cloudflaredBin) {
  console.error('\x1b[31m❌ cloudflared binary not found! Please install via: brew install cloudflared\x1b[0m');
  process.exit(1);
}

console.log('\x1b[36m============================================================\x1b[0m');
console.log('\x1b[32m⚡ Starting Cloudflare Tunnel & Live QR Generator...\x1b[0m');
console.log(`Executable: ${cloudflaredBin}`);
console.log('\x1b[36m============================================================\x1b[0m\n');

// Check if port 5000 is currently listening
try {
  const lsof = execSync('lsof -i :5000', { encoding: 'utf8' });
  if (!lsof.trim()) {
    console.log('\x1b[33m⚠️  ATTENTION: Drishti server is NOT running on port 5000 yet!\x1b[0m');
    console.log('\x1b[33m👉 Make sure to run \x1b[1mnpm run start:m4\x1b[0m\x1b[33m in another terminal tab, or Cloudflare will show "Host Error".\x1b[0m\n');
  }
} catch (e) {
  console.log('\x1b[33m⚠️  ATTENTION: Drishti server is NOT running on port 5000 yet!\x1b[0m');
  console.log('\x1b[33m👉 Run \x1b[1mnpm run start:m4\x1b[0m\x1b[33m in another terminal tab so incoming requests can be answered.\x1b[0m\n');
}

// 3. Spawn cloudflared tunnel explicitly pointing to 127.0.0.1:5000 (prevents IPv6 ::1 connection refused)
const tunnelProcess = spawn(cloudflaredBin, ['tunnel', '--url', 'http://127.0.0.1:5000'], {
  stdio: ['inherit', 'pipe', 'pipe'],
});

let detectedUrl = null;

function handleOutput(data) {
  const text = data.toString();
  process.stderr.write(text);

  if (!detectedUrl) {
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && match[0]) {
      detectedUrl = match[0];
      // Trigger QR & poster sync
      syncTunnelQR(detectedUrl, true).catch((err) => {
        console.error('Error syncing QR:', err);
      });
    }
  }
}

tunnelProcess.stdout.on('data', handleOutput);
tunnelProcess.stderr.on('data', handleOutput);

tunnelProcess.on('close', (code) => {
  console.log(`\n\x1b[33mTunnel process exited with code ${code}\x1b[0m`);
  process.exit(code || 0);
});

// Graceful cleanup on Ctrl+C
function cleanup() {
  if (tunnelProcess && !tunnelProcess.killed) {
    try {
      tunnelProcess.kill('SIGTERM');
    } catch (e) {}
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
