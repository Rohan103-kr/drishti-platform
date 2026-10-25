const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const { pool } = require('../config/db');
const { generateQRCode, generateQRBuffer } = require('../utils/qr');
const { sendConfirmationEmail } = require('../utils/email');
require('dotenv').config();

const router = express.Router();

// Multer config for payment screenshot uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `payment_${Date.now()}_${Math.round(Math.random() * 1e6)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, png, webp) are allowed.'));
    }
  },
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

// POST /api/register - Register a new student
router.post('/', upload.single('payment_screenshot'), async (req, res) => {
  try {
    const { name, roll_number, branch, section, phone, email, utr_number } = req.body;

    // Validation
    if (!name || !roll_number || !branch || !section || !phone || !email) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    // Validate phone (10 digits)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ error: 'Phone number must be a valid 10-digit Indian number.' });
    }

    // Either payment screenshot or valid UTR number is required
    const cleanedUtr = utr_number ? utr_number.trim() : '';
    if (!req.file && (!cleanedUtr || cleanedUtr.length < 6)) {
      return res.status(400).json({
        error: 'Please provide either a payment confirmation screenshot or a valid 12-digit UPI UTR / Transaction ID.',
      });
    }

    // Check if roll number already registered
    const [existing] = await pool.execute(
      'SELECT id FROM registrations WHERE roll_number = ?',
      [roll_number]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'This roll number is already registered.' });
    }

    // If UTR number is provided, check for duplicate UTR submission
    if (cleanedUtr) {
      const [existingUtr] = await pool.execute(
        'SELECT id FROM registrations WHERE utr_number = ?',
        [cleanedUtr]
      );
      if (existingUtr.length > 0) {
        return res.status(409).json({
          error: 'This UPI Transaction ID / UTR number has already been submitted for another registration.',
        });
      }
    }

    // Generate unique QR token and unique human-readable pass code
    const qrToken = uuidv4();
    let passCode = generatePassCode();

    // Check for rare duplicate pass code
    try {
      const [dup] = await pool.execute('SELECT id FROM registrations WHERE pass_code = ?', [passCode]);
      if (dup.length > 0) passCode = generatePassCode();
    } catch (e) {}

    // Generate QR code with passCode
    const { qrDataUrl } = await generateQRCode(qrToken, passCode);
    const qrBuffer = await generateQRBuffer(qrToken, passCode);

    // Payment screenshot path (null if submitted via direct UPI intent without screenshot)
    const screenshotPath = req.file ? `/uploads/${req.file.filename}` : null;

    // Insert into database with payment_verified = FALSE
    await pool.execute(
      `INSERT INTO registrations (name, roll_number, branch, section, phone, email, payment_screenshot, utr_number, qr_token, pass_code, qr_data_url, payment_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [name, roll_number, branch, section, phone, email, screenshotPath, cleanedUtr || null, qrToken, passCode, qrDataUrl]
    );

    // Note: Confirmation email with QR is NOT sent now.
    // It will be sent when the admin verifies the payment screenshot in the Admin Panel.

    res.status(201).json({
      message: 'Registration submitted! Your payment is pending verification. Once approved, your official Entry QR pass will be sent to your email.',
      registration: {
        name,
        roll_number,
        branch,
        section,
        email,
        payment_verified: false,
      },
    });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.message && err.message.includes('Only image files')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// GET /api/register/verify-qr/:token - Verify QR code validity (public)
router.get('/verify-qr/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const [rows] = await pool.execute(
      'SELECT id, name, roll_number, branch, section, pass_code, qr_expired, verified_at FROM registrations WHERE qr_token = ? OR pass_code = ?',
      [token, token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ valid: false, error: 'QR code not found.' });
    }

    const registration = rows[0];

    if (registration.qr_expired) {
      return res.json({
        valid: false,
        expired: true,
        message: 'This QR code has already been used and verified.',
        verified_at: registration.verified_at,
        student: {
          name: registration.name,
          roll_number: registration.roll_number,
          branch: registration.branch,
          section: registration.section,
          pass_code: registration.pass_code,
        },
      });
    }

    res.json({
      valid: true,
      message: 'QR code is valid and awaiting verification.',
      student: {
        name: registration.name,
        roll_number: registration.roll_number,
        branch: registration.branch,
        section: registration.section,
        pass_code: registration.pass_code,
      },
    });
  } catch (err) {
    console.error('QR verification error:', err);
    res.status(500).json({ error: 'Server error during QR verification.' });
  }
});

module.exports = router;
