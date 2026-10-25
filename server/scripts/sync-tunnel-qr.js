const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SERVER_DIR = path.resolve(__dirname, '..');
const CLIENT_DIR = path.resolve(PROJECT_ROOT, 'client');

/**
 * Generate QR code poster HTML template with embedded base64 image
 */
function generatePosterHtml(tunnelUrl, base64Qr) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Drishti • Scan to Join</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: radial-gradient(circle at top, #1e1b4b 0%, #090a16 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #fff;
    }
    .poster-card {
      background: linear-gradient(180deg, rgba(30, 27, 75, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%);
      border: 2px solid rgba(168, 85, 247, 0.4);
      border-radius: 28px;
      padding: 40px 32px;
      text-align: center;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(124, 58, 237, 0.25);
    }
    .badge {
      display: inline-block;
      background: linear-gradient(135deg, #ec4899, #8b5cf6);
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 38px;
      font-weight: 900;
      letter-spacing: 6px;
      background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 6px;
    }
    .subtitle {
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 24px;
      letter-spacing: 0.5px;
    }
    .qr-box {
      background: #fff;
      padding: 16px;
      border-radius: 20px;
      display: inline-block;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      margin-bottom: 20px;
      border: 4px solid #8b5cf6;
    }
    .qr-box img {
      display: block;
      width: 260px;
      height: 260px;
    }
    .scan-label {
      font-size: 16px;
      font-weight: 700;
      color: #facc15;
      margin-bottom: 8px;
      letter-spacing: 1px;
    }
    .url-chip {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 12px;
      color: #38bdf8;
      font-family: monospace;
      word-break: break-all;
      margin-bottom: 20px;
    }
    .perks {
      display: flex;
      justify-content: space-around;
      font-size: 12px;
      color: #cbd5e1;
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 16px;
    }
    .btn-print {
      margin-top: 20px;
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    @media print {
      body { background: #fff; color: #000; padding: 0; }
      .poster-card { border: 1px solid #000; box-shadow: none; max-width: 100%; }
      .btn-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="poster-card">
    <div class="badge">Value Education Cell • AKGEC</div>
    <h1>DRISHTI</h1>
    <div class="subtitle">A Value Based Short Film Event & Live Quiz</div>

    <div class="qr-box">
      <img src="${base64Qr}" alt="Scan to visit Drishti">
    </div>

    <div class="scan-label">📷 Scan with Phone Camera</div>
    <div class="url-chip">${tunnelUrl}</div>

    <div class="perks">
      <div>🎬 Short Films</div>
      <div>🍿 Free Snacks</div>
      <div>🏆 Speed Quiz</div>
    </div>

    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
</body>
</html>`;
}

/**
 * Regenerate QR codes, poster HTML, and sync server/.env with new Cloudflare tunnel URL
 */
async function syncTunnelQR(rawUrl, autoOpen = true) {
  if (!rawUrl) {
    console.error('❌ Error: Tunnel URL is required.');
    return;
  }

  const tunnelUrl = rawUrl.trim().replace(/\/$/, '');
  const quizUrl = `${tunnelUrl}/quiz`;

  console.log(`\n🎨 Generating fresh QR codes for: ${tunnelUrl}`);

  const qrOptions = {
    width: 600,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  };

  // 1. Generate base64 Data URL for HTML poster embedding
  const base64Qr = await QRCode.toDataURL(tunnelUrl, qrOptions);

  // 2. Generate and save PNG files
  const pngDestinations = [
    path.join(PROJECT_ROOT, 'website_qr_code.png'),
    path.join(CLIENT_DIR, 'public/website_qr_code.png'),
    path.join(CLIENT_DIR, 'dist/website_qr_code.png'),
    path.join(CLIENT_DIR, 'public/home_qr.png'),
    path.join(CLIENT_DIR, 'dist/home_qr.png'),
    path.join(CLIENT_DIR, 'public/main_portal_qr.png'),
    path.join(CLIENT_DIR, 'dist/main_portal_qr.png'),
  ];

  for (const dest of pngDestinations) {
    try {
      const dir = path.dirname(dest);
      if (fs.existsSync(dir)) {
        await QRCode.toFile(dest, tunnelUrl, qrOptions);
      }
    } catch (err) {
      // ignore individual file write errors if directory missing
    }
  }

  // Generate Quiz Arena specific QR code
  const quizQrDestinations = [
    path.join(CLIENT_DIR, 'public/quiz_arena_qr.png'),
    path.join(CLIENT_DIR, 'dist/quiz_arena_qr.png'),
    path.join(CLIENT_DIR, 'public/quiz_qr.png'),
    path.join(CLIENT_DIR, 'dist/quiz_qr.png'),
  ];

  for (const dest of quizQrDestinations) {
    try {
      const dir = path.dirname(dest);
      if (fs.existsSync(dir)) {
        await QRCode.toFile(dest, quizUrl, qrOptions);
      }
    } catch (err) {}
  }

  // 3. Generate and save Poster HTML files
  const posterHtml = generatePosterHtml(tunnelUrl, base64Qr);
  const posterDestinations = [
    path.join(PROJECT_ROOT, 'website_qr_poster.html'),
    path.join(CLIENT_DIR, 'public/website_qr_poster.html'),
    path.join(CLIENT_DIR, 'dist/website_qr_poster.html'),
    path.join(CLIENT_DIR, 'public/poster.html'),
    path.join(CLIENT_DIR, 'dist/poster.html'),
  ];

  for (const dest of posterDestinations) {
    try {
      const dir = path.dirname(dest);
      if (fs.existsSync(dir)) {
        fs.writeFileSync(dest, posterHtml, 'utf8');
      }
    } catch (err) {}
  }

  // 4. Update server/.env with new FRONTEND_URL
  const envPath = path.join(SERVER_DIR, '.env');
  try {
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (/^FRONTEND_URL=.*$/m.test(envContent)) {
        envContent = envContent.replace(/^FRONTEND_URL=.*$/m, `FRONTEND_URL=${tunnelUrl}`);
      } else {
        envContent += `\nFRONTEND_URL=${tunnelUrl}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log(`📝 Updated server/.env: FRONTEND_URL=${tunnelUrl}`);
    }
  } catch (err) {
    console.warn('Could not update server/.env:', err.message);
  }

  // 5. Render live scannable QR in terminal console
  console.log('\n📱 \x1b[33mSCAN TO TEST INSTANTLY WITH YOUR PHONE CAMERA:\x1b[0m');
  try {
    const terminalQr = await QRCode.toString(tunnelUrl, { type: 'terminal', small: true });
    console.log(terminalQr);
  } catch (e) {}

  console.log('\x1b[32m════════════════════════════════════════════════════════════════════\x1b[0m');
  console.log(`\x1b[1m\x1b[36m🎉 NEW QR CODE & POSTER GENERATED SUCCESSFULLY!\x1b[0m`);
  console.log(`🌐 \x1b[1mPublic URL:\x1b[0m    ${tunnelUrl}`);
  console.log(`🎯 \x1b[1mQuiz Arena:\x1b[0m    ${quizUrl}`);
  console.log(`🖼️  \x1b[1mQR Poster:\x1b[0m     file://${path.join(PROJECT_ROOT, 'website_qr_poster.html')}`);
  console.log(`📁 \x1b[1mQR Image:\x1b[0m      file://${path.join(PROJECT_ROOT, 'website_qr_code.png')}`);
  console.log('\x1b[32m════════════════════════════════════════════════════════════════════\x1b[0m\n');

  // 6. Open poster automatically in macOS default browser
  if (autoOpen && process.platform === 'darwin') {
    exec(`open "${path.join(PROJECT_ROOT, 'website_qr_poster.html')}"`, () => {});
  }
}

// Allow direct CLI execution: node sync-tunnel-qr.js <url>
if (require.main === module) {
  const url = process.argv[2];
  if (url) {
    syncTunnelQR(url, true);
  } else {
    console.log('Usage: node sync-tunnel-qr.js <cloudflare_url>');
  }
}

module.exports = { syncTunnelQR };
