const QRCode = require('qrcode');

/**
 * Generate a QR code data URL from a verification URL
 * @param {string} token - Unique QR token
 * @returns {Promise<string>} - QR code as data URL (base64 PNG)
 */
async function generateQRCode(token, passCode = '') {
  const codeParam = passCode ? `?code=${encodeURIComponent(passCode)}` : '';
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${token}${codeParam}`;

  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    width: 400,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });

  return { qrDataUrl, verificationUrl };
}

/**
 * Generate QR code as buffer for email attachment
 * @param {string} token - Unique QR token
 * @param {string} [passCode] - Unique readable pass code
 * @returns {Promise<Buffer>} - QR code as PNG buffer
 */
async function generateQRBuffer(token, passCode = '') {
  const codeParam = passCode ? `?code=${encodeURIComponent(passCode)}` : '';
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${token}${codeParam}`;

  const buffer = await QRCode.toBuffer(verificationUrl, {
    width: 400,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });

  return buffer;
}

module.exports = { generateQRCode, generateQRBuffer };
