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
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <title>Drishti Official Entry Pass</title>
        <style>
          @media only screen and (max-width: 600px) {
            .mobile-outer { padding: 8px !important; }
            .mobile-card { border-radius: 12px !important; }
            .mobile-body { padding: 20px 16px !important; }
            .mobile-passcode { font-size: 24px !important; letter-spacing: 2px !important; }
            .mobile-qr { width: 200px !important; height: 200px !important; }
            .mobile-grid { display: block !important; width: 100% !important; margin-bottom: 8px !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #060814; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #060814; margin: 0; padding: 16px 0;">
          <tr>
            <td align="center" class="mobile-outer" style="padding: 12px;">
              
              <!-- Main Container -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="mobile-card" style="max-width: 560px; width: 100%; background: linear-gradient(180deg, #0d1226 0%, #080a17 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(124, 58, 237, 0.3); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);">
                
                <!-- Ticket Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1e3a8a 0%, #6366f1 45%, #a855f7 75%, #ec4899 100%); padding: 28px 20px; text-align: center;">
                    <div style="display: inline-block; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 700; color: #ffffff; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px;">
                      🎟️ OFFICIAL ENTRY PASS
                    </div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 34px; font-weight: 900; letter-spacing: 5px; text-shadow: 0 2px 10px rgba(0,0,0,0.4);">
                      DRISHTI
                    </h1>
                    <p style="color: rgba(255, 255, 255, 0.95); margin: 6px 0 0 0; font-size: 13px; font-weight: 500; letter-spacing: 0.5px;">
                      Value Based Short Film Event • VE Cell AKGEC
                    </p>
                  </td>
                </tr>

                <!-- Ticket Content Body -->
                <tr>
                  <td class="mobile-body" style="padding: 28px 24px;">
                    
                    <!-- Greeting -->
                    <div style="font-size: 19px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">
                      Hello ${name}! 👋
                    </div>
                    <p style="font-size: 14px; line-height: 1.5; color: #cbd5e1; margin: 0 0 20px 0;">
                      Your payment has been <strong style="color: #10b981;">approved & verified</strong>. Here is your official entry pass for Drishti.
                    </p>

                    <!-- Pass Code High-Contrast Box -->
                    ${pass_code ? `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(168, 85, 247, 0.12)); border: 2px dashed #38bdf8; border-radius: 12px; margin: 0 0 24px 0;">
                      <tr>
                        <td align="center" style="padding: 18px 14px;">
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; margin-bottom: 6px;">
                            ENTRY PASS CODE
                          </div>
                          <div class="mobile-passcode" style="font-family: 'Courier New', Courier, monospace; font-size: 30px; font-weight: 900; color: #facc15; letter-spacing: 3px; text-shadow: 0 0 15px rgba(250, 204, 21, 0.4);">
                            ${pass_code}
                          </div>
                          <div style="font-size: 12px; color: #cbd5e1; margin-top: 6px;">
                            Present this code or scan the QR below at the hall entrance
                          </div>
                        </td>
                      </tr>
                    </table>
                    ` : ''}

                    <!-- Event Quick Badges -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                      <tr>
                        <td align="center">
                          <table role="presentation" width="100%" cellpadding="6" cellspacing="0" border="0">
                            <tr>
                              <td align="center" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 10px 8px;">
                                <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">📍 Venue</div>
                                <div style="font-size: 13px; color: #ffffff; font-weight: 700; margin-top: 3px;">CSIT Seminar Hall</div>
                              </td>
                              <td width="8"></td>
                              <td align="center" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 10px 8px;">
                                <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">🎁 Goodies</div>
                                <div style="font-size: 13px; color: #d946ef; font-weight: 700; margin-top: 3px;">Free Snacks & Kit</div>
                              </td>
                              <td width="8"></td>
                              <td align="center" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 10px 8px;">
                                <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">🏆 Contest</div>
                                <div style="font-size: 13px; color: #38bdf8; font-weight: 700; margin-top: 3px;">Live Speed Quiz</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Student Details Card -->
                    <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                      <div style="font-size: 12px; font-weight: 700; color: #a855f7; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px;">
                        STUDENT CREDENTIALS
                      </div>
                      <table role="presentation" width="100%" cellpadding="6" cellspacing="0" border="0" style="font-size: 13px;">
                        <tr>
                          <td style="color: #94a3b8; width: 38%; padding: 6px 0;">Student Name:</td>
                          <td style="color: #ffffff; font-weight: 700; text-align: right; padding: 6px 0;">${name}</td>
                        </tr>
                        <tr>
                          <td style="color: #94a3b8; padding: 6px 0; border-top: 1px solid rgba(255, 255, 255, 0.05);">University Roll:</td>
                          <td style="color: #38bdf8; font-family: monospace; font-weight: 700; text-align: right; padding: 6px 0; border-top: 1px solid rgba(255, 255, 255, 0.05);">${roll_number}</td>
                        </tr>
                        <tr>
                          <td style="color: #94a3b8; padding: 6px 0; border-top: 1px solid rgba(255, 255, 255, 0.05);">Branch & Section:</td>
                          <td style="color: #ffffff; font-weight: 600; text-align: right; padding: 6px 0; border-top: 1px solid rgba(255, 255, 255, 0.05);">${branch} (Sec ${section})</td>
                        </tr>
                        <tr>
                          <td style="color: #94a3b8; padding: 6px 0; border-top: 1px solid rgba(255, 255, 255, 0.05);">Payment Status:</td>
                          <td style="color: #10b981; font-weight: 700; text-align: right; padding: 6px 0; border-top: 1px solid rgba(255, 255, 255, 0.05);">Verified & Paid ✓</td>
                        </tr>
                      </table>
                    </div>

                    <!-- Centered QR Code Card -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                      <tr>
                        <td align="center">
                          <div style="background: rgba(124, 58, 237, 0.08); border: 2px solid rgba(124, 58, 237, 0.4); border-radius: 16px; padding: 20px; display: inline-block; max-width: 280px; width: 100%; text-align: center;">
                            <div style="font-size: 11px; font-weight: 700; color: #a855f7; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">
                              ENTRY GATE QR CODE
                            </div>
                            <img src="cid:qrcode" alt="Drishti Entry QR Code" class="mobile-qr" width="220" height="220" style="display: block; margin: 0 auto; border-radius: 12px; background-color: #ffffff; padding: 8px; max-width: 100%; height: auto; box-shadow: 0 4px 16px rgba(0,0,0,0.3);" />
                            <div style="font-size: 11px; color: #94a3b8; margin-top: 12px; font-weight: 500;">
                              📷 Hold under entry camera for barcode scan
                            </div>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Instructions / Goodies Note -->
                    <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 14px; font-size: 12px; color: #fde68a; line-height: 1.5;">
                      <strong>⚠️ Important Instructions for Entry:</strong><br/>
                      • Keep this pass handy on your mobile phone upon arrival.<br/>
                      • Hand over your pass code or QR code at the gate scanner to collect your snacks packet & goodies.<br/>
                      • Use your <strong>Roll Number</strong> to participate in the <strong>Live Speed Quiz</strong>!
                    </div>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background: #070913; border-top: 1px solid rgba(255, 255, 255, 0.06); padding: 22px 20px; text-align: center; color: #64748b; font-size: 11px; line-height: 1.5;">
                    <p style="margin: 0 0 6px 0; font-weight: 600; color: #94a3b8;">Value Education Cell • Ajay Kumar Garg Engineering College</p>
                    <p style="margin: 0; font-size: 11px;">27th KM Milestone, Delhi-Meerut Expressway, Ghaziabad, UP 201009</p>
                    <p style="margin: 6px 0 0 0; font-size: 10px; color: #475569;">Questions? Contact event coordinator or reply to this email.</p>
                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>
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
