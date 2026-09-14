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
  const { name, roll_number, branch, section, email, qr_token } = registration;

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
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #0f0f1a; }
          .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border-radius: 16px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #e94560, #c23152); padding: 32px; text-align: center; }
          .header h1 { color: #fff; margin: 0; font-size: 32px; letter-spacing: 4px; }
          .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
          .body { padding: 32px; color: #e0e0e0; }
          .greeting { font-size: 20px; color: #fff; margin-bottom: 16px; }
          .details { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { color: #a0a0b0; font-size: 13px; }
          .detail-value { color: #fff; font-weight: 600; font-size: 14px; }
          .qr-section { text-align: center; margin: 24px 0; }
          .qr-section img { border-radius: 12px; border: 3px solid rgba(233, 69, 96, 0.5); }
          .qr-note { background: rgba(233, 69, 96, 0.1); border: 1px solid rgba(233, 69, 96, 0.3); border-radius: 8px; padding: 12px; font-size: 13px; color: #e94560; text-align: center; margin: 16px 0; }
          .footer { text-align: center; padding: 24px; color: #666; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.05); }
          .badge { display: inline-block; background: linear-gradient(135deg, #e94560, #c23152); color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div style="padding: 20px; background: #0f0f1a;">
          <div class="container">
            <div class="header">
              <h1>DRISHTI</h1>
              <p>VE Cell • AKGEC, Ghaziabad</p>
            </div>
            <div class="body">
              <div class="greeting">Hello ${name}! 👋</div>
              <p>Your registration for <strong>Drishti</strong> has been successfully received. Please find your details and entry QR code below.</p>
              
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
                <p style="color: #a0a0b0; font-size: 13px; margin-bottom: 12px;">YOUR ENTRY QR CODE</p>
                <img src="cid:qrcode" alt="Entry QR Code" width="250" height="250" />
              </div>

              <div class="qr-note">
                ⚠️ This QR code is your entry pass. Please show it at the venue for verification. It will expire once scanned.
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
