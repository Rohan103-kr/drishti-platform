const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send registration confirmation email with QR code
 * @param {Object} registration - Registration details
 * @param {Buffer} qrBuffer - QR code image buffer
 */
async function sendConfirmationEmail(registration, qrBuffer) {
  const { name, roll_number, branch, section, email, qr_token, pass_code } = registration;

  const mailOptions = {
    from: `"VE Cell - AKGEC" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '✅ Drishti Event Registration Confirmed - VE Cell AKGEC',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #080918; }
          .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0d1127 0%, #15193b 50%, #0a0d24 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(217, 70, 239, 0.2); }
          .header { background: linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #d946ef 100%); padding: 32px; text-align: center; }
          .header h1 { color: #fff; margin: 0; font-size: 32px; letter-spacing: 4px; font-weight: 800; }
          .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px; }
          .body { padding: 32px; color: #e0e0e0; }
          .greeting { font-size: 20px; color: #fff; margin-bottom: 16px; }
          .passcode-card { background: rgba(37, 99, 235, 0.12); border: 2px dashed #38bdf8; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0; }
          .passcode-title { font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 2px; font-weight: 700; margin-bottom: 6px; }
          .passcode-value { font-size: 28px; font-weight: 900; color: #facc15; letter-spacing: 3px; font-family: monospace; }
          .details { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { color: #a0a0b0; font-size: 13px; }
          .detail-value { color: #fff; font-weight: 600; font-size: 14px; }
          .qr-section { text-align: center; margin: 24px 0; }
          .qr-section img { border-radius: 14px; border: 4px solid rgba(124, 58, 237, 0.6); background: white; padding: 8px; }
          .qr-note { background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 8px; padding: 12px; font-size: 13px; color: #f43f5e; text-align: center; margin: 16px 0; }
          .footer { text-align: center; padding: 24px; color: #71717a; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
          .badge { display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div style="padding: 20px; background: #080918;">
          <div class="container">
            <div class="header">
              <h1>DRISHTI</h1>
              <p>Value Education Cell • AKGEC, Ghaziabad</p>
            </div>
            <div class="body">
              <div class="greeting">Hello ${name}! 👋</div>
              <p>Your registration for <strong>Drishti — A Value Based Short Film Event</strong> has been successfully received.</p>
              
              ${pass_code ? `
              <div class="passcode-card">
                <div class="passcode-title">YOUR UNIQUE ENTRY PASS CODE</div>
                <div class="passcode-value">${pass_code}</div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">Present this code or scan the QR below at the CSIT Seminar Hall gate</div>
              </div>
              ` : ''}

              <div class="details">
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="color: #a0a0b0; font-size: 13px;">Name</td>
                    <td style="color: #fff; font-weight: 600; font-size: 14px; text-align: right;">${name}</td>
                  </tr>
                  <tr>
                    <td style="color: #a0a0b0; font-size: 13px;">Roll Number</td>
                    <td style="color: #fff; font-weight: 600; font-size: 14px; text-align: right;">${roll_number}</td>
                  </tr>
                  <tr>
                    <td style="color: #a0a0b0; font-size: 13px;">Branch</td>
                    <td style="color: #fff; font-weight: 600; font-size: 14px; text-align: right;">${branch}</td>
                  </tr>
                  <tr>
                    <td style="color: #a0a0b0; font-size: 13px;">Section</td>
                    <td style="color: #fff; font-weight: 600; font-size: 14px; text-align: right;">${section}</td>
                  </tr>
                  <tr>
                    <td style="color: #a0a0b0; font-size: 13px;">Status</td>
                    <td style="text-align: right;"><span class="badge">Registered ✓</span></td>
                  </tr>
                </table>
              </div>

              <div class="qr-section">
                <p style="color: #a0a0b0; font-size: 13px; margin-bottom: 12px;">OFFICIAL ENTRY QR CODE</p>
                <img src="cid:qrcode" alt="Entry QR Code" width="250" height="250" />
              </div>

              <div class="qr-note">
                ⚠️ This QR code and Unique Pass Code are your official entry pass. Show either at the venue gate for camera verification. It will automatically expire once verified!
              </div>
            </div>
            <div class="footer">
              <p>Value Education Cell • Ajay Kumar Garg Engineering College</p>
              <p>27th KM Milestone, Delhi-Meerut Expressway, Ghaziabad, UP</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: 'drishti-qr-code.png',
        content: qrBuffer,
        cid: 'qrcode',
      },
    ],
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendConfirmationEmail, transporter };
