const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { sendConfirmationEmail } = require('../utils/email');
const { generateQRBuffer } = require('../utils/qr');

const router = express.Router();

// All admin routes are protected
router.use(authenticateToken);

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const [totalRows] = await pool.execute('SELECT COUNT(*) as total FROM registrations');
    const [pendingPaymentRows] = await pool.execute(
      'SELECT COUNT(*) as pending FROM registrations WHERE payment_verified = FALSE OR payment_verified IS NULL'
    );
    const [verifiedPaymentRows] = await pool.execute(
      'SELECT COUNT(*) as verified FROM registrations WHERE payment_verified = TRUE'
    );
    const [checkedInRows] = await pool.execute(
      'SELECT COUNT(*) as checked_in FROM registrations WHERE gate_checked_in = TRUE OR qr_expired = TRUE'
    );

    res.json({
      total: totalRows[0].total,
      pending: pendingPaymentRows[0].pending,
      verified: verifiedPaymentRows[0].verified,
      checked_in: checkedInRows[0].checked_in,
      pending_payment: pendingPaymentRows[0].pending,
      verified_payment: verifiedPaymentRows[0].verified,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Server error fetching stats.' });
  }
});

// GET /api/admin/registrations - List all registrations with optional filter
router.get('/registrations', async (req, res) => {
  try {
    const { filter, search } = req.query;
    let query = 'SELECT * FROM registrations';
    const params = [];
    const conditions = [];

    if (filter === 'pending' || filter === 'payment_pending') {
      conditions.push('(payment_verified = FALSE OR payment_verified IS NULL)');
    } else if (filter === 'verified' || filter === 'payment_approved') {
      conditions.push('payment_verified = TRUE');
    } else if (filter === 'checked_in') {
      conditions.push('(gate_checked_in = TRUE OR qr_expired = TRUE)');
    }

    if (search) {
      conditions.push('(name LIKE ? OR roll_number LIKE ? OR email LIKE ? OR phone LIKE ? OR pass_code LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.execute(query, params);

    res.json({ registrations: rows });
  } catch (err) {
    console.error('List registrations error:', err);
    res.status(500).json({ error: 'Server error fetching registrations.' });
  }
});

// GET /api/admin/registrations/:id - Get single registration
router.get('/registrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT * FROM registrations WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    res.json({ registration: rows[0] });
  } catch (err) {
    console.error('Get registration error:', err);
    res.status(500).json({ error: 'Server error fetching registration.' });
  }
});

// PUT /api/admin/verify-payment/:id - Verify payment proof and SEND QR EMAIL to student
router.put('/verify-payment/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute('SELECT * FROM registrations WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    const reg = rows[0];

    // Check if payment already verified
    if (reg.payment_verified) {
      return res.status(400).json({
        error: 'Payment for this student is already verified. Entry QR pass was already emailed.',
        payment_verified_at: reg.payment_verified_at,
      });
    }

    const now = new Date();
    const passCode = reg.pass_code || ('DRISHTI-' + Math.random().toString(36).substring(2, 8).toUpperCase());

    // Generate QR PNG buffer for the official email attachment
    const qrBuffer = await generateQRBuffer(reg.qr_token, passCode);

    // Update database: mark payment_verified = TRUE, store timestamp
    await pool.execute(
      `UPDATE registrations 
       SET payment_verified = TRUE, payment_verified_at = ?, verified_at = ?, pass_code = ?
       WHERE id = ?`,
      [now, now, passCode, id]
    );

    // Now send the official email with the QR code attachment and unique pass code
    let emailSent = true;
    try {
      await sendConfirmationEmail(
        {
          name: reg.name,
          roll_number: reg.roll_number,
          branch: reg.branch,
          section: reg.section,
          email: reg.email,
          qr_token: reg.qr_token,
          pass_code: passCode,
        },
        qrBuffer
      );
    } catch (emailErr) {
      console.error('Failed to send confirmation email on payment approval:', emailErr.message);
      emailSent = false;
    }

    res.json({
      message: emailSent
        ? `Payment verified! Entry QR code and Pass Code (${passCode}) have been emailed to ${reg.email}.`
        : `Payment verified! The Entry QR is active, though email delivery encountered an issue.`,
      email_sent: emailSent,
      payment_verified_at: now,
      student: {
        id: reg.id,
        name: reg.name,
        roll_number: reg.roll_number,
        branch: reg.branch,
        section: reg.section,
        email: reg.email,
        pass_code: passCode,
      },
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Server error during payment verification.' });
  }
});

// Alias for PUT /api/admin/verify/:id (triggers verify-payment)
router.put('/verify/:id', async (req, res, next) => {
  // Delegate to verify-payment
  const { id } = req.params;
  req.url = `/verify-payment/${id}`;
  router.handle(req, res, next);
});

// PUT /api/admin/verify-token/:token - Verify by token
router.put('/verify-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const [rows] = await pool.execute(
      'SELECT * FROM registrations WHERE qr_token = ? OR pass_code = ?',
      [token, token]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pass or QR code not found.' });
    }

    const registration = rows[0];

    if (registration.gate_checked_in || registration.qr_expired) {
      return res.status(400).json({
        error: 'This QR code has already been scanned at the gate and expired.',
        gate_checked_in_at: registration.gate_checked_in_at || registration.verified_at,
        student: {
          name: registration.name,
          roll_number: registration.roll_number,
          branch: registration.branch,
          section: registration.section,
          pass_code: registration.pass_code,
        },
      });
    }

    const now = new Date();
    await pool.execute(
      'UPDATE registrations SET gate_checked_in = TRUE, gate_checked_in_at = ?, qr_expired = TRUE WHERE id = ?',
      [now, registration.id]
    );

    res.json({
      message: 'Gate check-in verified! Hand over goodies and snacks.',
      gate_checked_in_at: now,
      student: {
        id: registration.id,
        name: registration.name,
        roll_number: registration.roll_number,
        branch: registration.branch,
        section: registration.section,
        pass_code: registration.pass_code,
      },
    });
  } catch (err) {
    console.error('Verify by token error:', err);
    res.status(500).json({ error: 'Server error during verification.' });
  }
});

// POST /api/admin/verify-scan - Dedicated camera scanner verification at the event gate
// Checks:
// 1. Not found -> status: 'not_matched' (Fake / invalid QR)
// 2. Found, but payment not verified -> status: 'unverified_payment' (Payment pending admin approval)
// 3. Found, already checked in -> status: 'already_done' (Prevent duplicate entry / goodies)
// 4. Found, valid -> status: 'verified' (Entry allowed & give goodies/snacks)
router.post('/verify-scan', async (req, res) => {
  try {
    let { scanData } = req.body;
    if (!scanData || typeof scanData !== 'string') {
      return res.status(400).json({ status: 'error', error: 'Scan data is required.' });
    }

    scanData = scanData.trim();

    // Extract token/code if scanData is a URL
    let extracted = scanData;
    const urlMatch = scanData.match(/\/verify\/([a-zA-Z0-9_-]+)/i);
    if (urlMatch && urlMatch[1]) {
      extracted = urlMatch[1];
    } else {
      try {
        const parsed = JSON.parse(scanData);
        if (parsed.token) extracted = parsed.token;
        else if (parsed.code) extracted = parsed.code;
      } catch (e) {
        // Not JSON, use as-is
      }
    }

    const codeQueryMatch = scanData.match(/[?&]code=([a-zA-Z0-9_-]+)/i);
    const candidateCode = codeQueryMatch ? codeQueryMatch[1] : extracted;

    // Search by qr_token, pass_code, or roll_number
    const [rows] = await pool.execute(
      `SELECT * FROM registrations 
       WHERE qr_token = ? OR pass_code = ? OR pass_code = ? OR roll_number = ?
       LIMIT 1`,
      [extracted, extracted, candidateCode, extracted]
    );

    // 1. Fake / Not Matched
    if (rows.length === 0) {
      return res.json({
        status: 'not_matched',
        success: false,
        message: 'False / Fake QR! No matching registration found in the system. Do NOT allow entry or goodies.',
        scanned: scanData,
      });
    }

    const reg = rows[0];

    // 2. Unverified Payment
    if (!reg.payment_verified) {
      return res.json({
        status: 'unverified_payment',
        success: false,
        message: 'Payment Pending! This student registration exists but the payment screenshot has not been approved yet.',
        student: {
          id: reg.id,
          name: reg.name,
          roll_number: reg.roll_number,
          branch: reg.branch,
          section: reg.section,
          phone: reg.phone,
          email: reg.email,
        },
      });
    }

    // 3. Already Checked In / Goodies Claimed
    if (reg.gate_checked_in || reg.qr_expired) {
      return res.json({
        status: 'already_done',
        success: false,
        message: 'Already Checked In! Entry and goodies have already been claimed for this pass. Do NOT issue second packet.',
        gate_checked_in_at: reg.gate_checked_in_at || reg.verified_at,
        student: {
          id: reg.id,
          name: reg.name,
          roll_number: reg.roll_number,
          branch: reg.branch,
          section: reg.section,
          pass_code: reg.pass_code,
          phone: reg.phone,
          email: reg.email,
        },
      });
    }

    // 4. Valid First-Time Gate Entry & Goodies Distribution
    const now = new Date();
    await pool.execute(
      'UPDATE registrations SET gate_checked_in = TRUE, gate_checked_in_at = ?, qr_expired = TRUE WHERE id = ?',
      [now, reg.id]
    );

    return res.json({
      status: 'verified',
      success: true,
      message: 'Verified! Entry Allowed. Hand over goodies and snacks packet! 🎁🍿',
      gate_checked_in_at: now,
      student: {
        id: reg.id,
        name: reg.name,
        roll_number: reg.roll_number,
        branch: reg.branch,
        section: reg.section,
        pass_code: reg.pass_code,
        phone: reg.phone,
        email: reg.email,
      },
    });
  } catch (err) {
    console.error('Verify scan error:', err);
    res.status(500).json({ status: 'error', error: 'Server error during scan verification.' });
  }
});

// GET /api/admin/export - Export registrations as CSV
router.get('/export', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT name, roll_number, branch, section, phone, email, utr_number, verified_at, created_at FROM registrations ORDER BY created_at DESC'
    );

    const headers = ['Name', 'Roll Number', 'Branch', 'Section', 'Phone', 'Email', 'UTR Number', 'Verified At', 'Registered At'];
    const csvRows = [headers.join(',')];

    rows.forEach((row) => {
      csvRows.push(
        [
          `"${row.name}"`,
          `"${row.roll_number}"`,
          `"${row.branch}"`,
          `"${row.section}"`,
          `"${row.phone}"`,
          `"${row.email}"`,
          `"${row.utr_number || 'N/A'}"`,
          `"${row.verified_at || 'Not Verified'}"`,
          `"${row.created_at}"`,
        ].join(',')
      );
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=drishti-registrations.csv');
    res.send(csvRows.join('\n'));
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Server error during export.' });
  }
});

module.exports = router;
