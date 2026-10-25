const express = require('express');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { sendConfirmationEmail } = require('../utils/email');
const { generateQRCode, generateQRBuffer } = require('../utils/qr');

const router = express.Router();

// Multer memory storage for Excel / CSV imports
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
});

// Helper to generate a unique readable pass code (e.g. DRISHTI-7K2M9P)
function generatePassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `DRISHTI-${code}`;
}

// Normalizes column names for comparison
function normalizeKey(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Looks for values in a row by matching multiple possible header variations (exact match first, then substring)
function findValue(row, possibleKeys) {
  const keys = Object.keys(row);
  // Pass 1: Look for exact key match with non-empty value
  for (const pKey of possibleKeys) {
    const target = normalizeKey(pKey);
    const exactKey = keys.find(k => normalizeKey(k) === target && String(row[k] || '').trim() !== '');
    if (exactKey) return String(row[exactKey]).trim();
  }
  // Pass 2: Look for substring match with non-empty value
  for (const pKey of possibleKeys) {
    const target = normalizeKey(pKey);
    const subKey = keys.find(k => {
      const norm = normalizeKey(k);
      return (norm.includes(target) || target.includes(norm)) && String(row[k] || '').trim() !== '';
    });
    if (subKey) return String(row[subKey]).trim();
  }
  return '';
}

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

// GET /api/admin/registrations - List all registrations with advanced filters & sorting
router.get('/registrations', async (req, res) => {
  try {
    const { filter, search, branch, section, sort } = req.query;
    let query = `SELECT id, name, roll_number, branch, section, phone, email, payment_screenshot, utr_number, qr_token, pass_code, payment_verified, payment_verified_at, gate_checked_in, gate_checked_in_at, qr_expired, verified_at, created_at FROM registrations`;
    const params = [];
    const conditions = [];

    // Status filter
    if (filter === 'pending' || filter === 'payment_pending') {
      conditions.push('(payment_verified = FALSE OR payment_verified IS NULL)');
    } else if (filter === 'verified' || filter === 'payment_approved') {
      conditions.push('payment_verified = TRUE');
    } else if (filter === 'checked_in') {
      conditions.push('(gate_checked_in = TRUE OR qr_expired = TRUE)');
    }

    // Branch filter
    if (branch && branch !== 'all') {
      conditions.push('branch LIKE ?');
      params.push(`%${branch}%`);
    }

    // Section filter
    if (section && section !== 'all') {
      conditions.push('section = ?');
      params.push(section);
    }

    // Search query
    if (search) {
      conditions.push('(name LIKE ? OR roll_number LIKE ? OR email LIKE ? OR phone LIKE ? OR pass_code LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Sorting
    if (sort === 'oldest') {
      query += ' ORDER BY created_at ASC';
    } else if (sort === 'name_asc') {
      query += ' ORDER BY name ASC';
    } else if (sort === 'name_desc') {
      query += ' ORDER BY name DESC';
    } else if (sort === 'roll_asc') {
      query += ' ORDER BY roll_number ASC';
    } else {
      query += ' ORDER BY created_at DESC';
    }

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

// POST /api/admin/registrations - Manually add a student registration
router.post('/registrations', async (req, res) => {
  try {
    let { name, roll_number, branch, section, phone, email, utr_number, payment_screenshot, auto_verify } = req.body;

    if (!name || !roll_number || !email) {
      return res.status(400).json({ error: 'Name, Roll Number, and Email are required.' });
    }

    name = String(name).trim();
    roll_number = String(roll_number).trim().toUpperCase();
    branch = String(branch || 'General').trim();
    section = String(section || '1').trim();
    phone = String(phone || '').replace(/\D/g, '').slice(-10);
    email = String(email).trim().toLowerCase();
    utr_number = utr_number ? String(utr_number).trim() : null;
    payment_screenshot = payment_screenshot ? String(payment_screenshot).trim() : null;

    // Check duplicate roll number
    const [existing] = await pool.execute(
      'SELECT id FROM registrations WHERE roll_number = ?',
      [roll_number]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: `Roll number ${roll_number} is already registered.` });
    }

    const qrToken = uuidv4();
    let passCode = generatePassCode();

    try {
      const [dup] = await pool.execute('SELECT id FROM registrations WHERE pass_code = ?', [passCode]);
      if (dup.length > 0) passCode = generatePassCode();
    } catch (e) {}

    const { qrDataUrl } = await generateQRCode(qrToken, passCode);
    const now = new Date();
    const isVerified = Boolean(auto_verify);

    const [result] = await pool.execute(
      `INSERT INTO registrations (
        name, roll_number, branch, section, phone, email,
        payment_screenshot, utr_number, qr_token, pass_code, qr_data_url,
        payment_verified, payment_verified_at, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        roll_number,
        branch,
        section,
        phone || '0000000000',
        email,
        payment_screenshot,
        utr_number,
        qrToken,
        passCode,
        qrDataUrl,
        isVerified,
        isVerified ? now : null,
        isVerified ? now : null,
      ]
    );

    let emailSent = false;
    if (isVerified) {
      try {
        const qrBuffer = await generateQRBuffer(qrToken, passCode);
        await sendConfirmationEmail(
          {
            name,
            roll_number,
            branch,
            section,
            email,
            qr_token: qrToken,
            pass_code: passCode,
          },
          qrBuffer
        );
        emailSent = true;
      } catch (mailErr) {
        console.warn('Manual registration QR email failed:', mailErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: isVerified
        ? (emailSent ? `Student added! Payment verified & Entry QR emailed to ${email}.` : `Student added & verified! (QR is active)`)
        : `Student added to list in Pending Review status.`,
      id: result.insertId,
      pass_code: passCode,
      email_sent: emailSent,
    });
  } catch (err) {
    console.error('Manual registration error:', err);
    res.status(500).json({ error: 'Server error during manual registration: ' + err.message });
  }
});

// PUT /api/admin/registrations/:id - Edit registration details
router.put('/registrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let { name, roll_number, branch, section, phone, email, utr_number, payment_screenshot } = req.body;

    const [rows] = await pool.execute('SELECT * FROM registrations WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    if (!name || !roll_number || !email) {
      return res.status(400).json({ error: 'Name, Roll Number, and Email are required.' });
    }

    name = String(name).trim();
    roll_number = String(roll_number).trim().toUpperCase();
    branch = String(branch || 'General').trim();
    section = String(section || '1').trim();
    phone = String(phone || '').replace(/\D/g, '').slice(-10);
    email = String(email).trim().toLowerCase();
    utr_number = utr_number ? String(utr_number).trim() : null;
    payment_screenshot = payment_screenshot ? String(payment_screenshot).trim() : null;

    // Check if roll_number is taken by another student
    const [dup] = await pool.execute(
      'SELECT id FROM registrations WHERE roll_number = ? AND id != ?',
      [roll_number, id]
    );
    if (dup.length > 0) {
      return res.status(409).json({ error: `Roll number ${roll_number} is already taken by another student.` });
    }

    await pool.execute(
      `UPDATE registrations 
       SET name = ?, roll_number = ?, branch = ?, section = ?, phone = ?, email = ?, utr_number = ?, payment_screenshot = ?
       WHERE id = ?`,
      [name, roll_number, branch, section, phone || '0000000000', email, utr_number, payment_screenshot, id]
    );

    res.json({
      success: true,
      message: `Registration for ${name} (${roll_number}) updated successfully.`,
    });
  } catch (err) {
    console.error('Update registration error:', err);
    res.status(500).json({ error: 'Server error updating registration: ' + err.message });
  }
});

// DELETE /api/admin/registrations/:id - Delete a registration
router.delete('/registrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT name, roll_number FROM registrations WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    await pool.execute('DELETE FROM registrations WHERE id = ?', [id]);

    res.json({
      success: true,
      message: `Registration for ${rows[0].name} (${rows[0].roll_number}) deleted successfully.`,
    });
  } catch (err) {
    console.error('Delete registration error:', err);
    res.status(500).json({ error: 'Server error deleting registration: ' + err.message });
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

// POST /api/admin/import-excel - Import registrations from Google Form Excel / CSV
router.post('/import-excel', importUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please select an Excel (.xlsx, .xls) or CSV file to upload.' });
    }

    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } catch (parseErr) {
      return res.status(400).json({ error: 'Unable to parse spreadsheet. Please ensure it is a valid .xlsx, .xls, or .csv file.' });
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return res.status(400).json({ error: 'The uploaded spreadsheet contains no sheets.' });
    }

    const sheetName = workbook.SheetNames[0];
    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ error: 'The uploaded sheet contains no data rows.' });
    }

    let importedCount = 0;
    const skippedDuplicates = [];
    const invalidRows = [];

    // Pre-fetch all existing roll numbers to check duplicates efficiently
    const [existingRows] = await pool.execute('SELECT roll_number FROM registrations');
    const existingRolls = new Set(existingRows.map((r) => String(r.roll_number).trim().toUpperCase()));

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2; // Row number in spreadsheet (accounting for 1-based index & header)

      const name = findValue(row, [
        'student name',
        'full name',
        'candidate name',
        'participant name',
        'name',
        'studentname',
        'fullname',
      ]);

      let roll_number = findValue(row, [
        'university roll no',
        'college roll no',
        'student no',
        'student number',
        'roll number',
        'roll no',
        'rollnumber',
        'rollno',
        'studentno',
        'student id',
      ]);

      const branch = findValue(row, [
        'branch',
        'department',
        'course',
        'branchdepartment',
        'dept',
      ]) || 'General';

      const section = findValue(row, ['section', 'sec']) || '1';

      let phone = findValue(row, [
        'whatsapp number',
        'phone number',
        'mobile number',
        'contact number',
        'whatsapp',
        'phone',
        'mobile',
        'contact',
      ]);

      const email = findValue(row, [
        'email address',
        'student email',
        'email id',
        'email',
        'mail',
      ]);

      const utr_number = findValue(row, [
        'transaction id',
        'txn id',
        'utr number',
        'utr',
        'reference id',
        'ref no',
        'payment id',
        'transaction reference',
        'utrno',
      ]);

      const payment_screenshot = findValue(row, [
        'upload payment screenshot',
        'payment screenshot',
        'payment proof',
        'upload payment proof',
        'upload screenshot',
        'screenshot',
        'payment receipt',
        'receipt',
        'drive link',
        'screenshot link',
        'drive',
      ]);

      // Normalize roll number
      roll_number = String(roll_number || '').trim().toUpperCase();

      // Clean phone number (strip spaces, country code if > 10 digits)
      phone = String(phone || '').replace(/\D/g, '');
      if (phone.length > 10) {
        phone = phone.slice(-10);
      }

      // Check required fields (Name, Roll Number, Email)
      if (!name || !roll_number || !email) {
        invalidRows.push({
          row: rowNum,
          name: name || '(empty)',
          roll_number: roll_number || '(empty)',
          email: email || '(empty)',
          reason: 'Missing name, roll number, or email.',
        });
        continue;
      }

      // Check if roll number already exists in DB or current import batch
      if (existingRolls.has(roll_number)) {
        skippedDuplicates.push({
          row: rowNum,
          roll_number,
          name,
        });
        continue;
      }

      // Track roll number to prevent duplicate within the same uploaded sheet
      existingRolls.add(roll_number);

      // Generate unique QR token and pass code
      const qrToken = uuidv4();
      let passCode = generatePassCode();

      // Check for rare passCode collision
      try {
        const [dup] = await pool.execute('SELECT id FROM registrations WHERE pass_code = ?', [passCode]);
        if (dup.length > 0) passCode = generatePassCode();
      } catch (e) {}

      // Generate QR data URL
      let qrDataUrl = '';
      try {
        const qrRes = await generateQRCode(qrToken, passCode);
        qrDataUrl = qrRes.qrDataUrl;
      } catch (qrErr) {
        console.warn('QR generation error for imported row:', qrErr.message);
      }

      // Insert into registrations table with payment_verified = FALSE
      await pool.execute(
        `INSERT INTO registrations (
          name, roll_number, branch, section, phone, email,
          payment_screenshot, utr_number, qr_token, pass_code, qr_data_url,
          payment_verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
        [
          name,
          roll_number,
          branch,
          section,
          phone || '0000000000',
          email,
          payment_screenshot || null,
          utr_number || null,
          qrToken,
          passCode,
          qrDataUrl,
        ]
      );

      importedCount++;
    }

    res.json({
      success: true,
      message: `Import complete! Successfully imported ${importedCount} student(s).`,
      totalRows: rawRows.length,
      importedCount,
      skippedDuplicatesCount: skippedDuplicates.length,
      skippedDuplicates,
      invalidRowsCount: invalidRows.length,
      invalidRows,
    });
  } catch (err) {
    console.error('Import excel error:', err);
    res.status(500).json({ error: 'Server error while importing file: ' + err.message });
  }
});

module.exports = router;
