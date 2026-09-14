const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All admin routes are protected
router.use(authenticateToken);

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const [totalRows] = await pool.execute('SELECT COUNT(*) as total FROM registrations');
    const [verifiedRows] = await pool.execute(
      'SELECT COUNT(*) as verified FROM registrations WHERE verified_at IS NOT NULL'
    );
    const [pendingRows] = await pool.execute(
      'SELECT COUNT(*) as pending FROM registrations WHERE verified_at IS NULL'
    );

    res.json({
      total: totalRows[0].total,
      verified: verifiedRows[0].verified,
      pending: pendingRows[0].pending,
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

    if (filter === 'verified') {
      conditions.push('verified_at IS NOT NULL');
    } else if (filter === 'pending') {
      conditions.push('verified_at IS NULL');
    }

    if (search) {
      conditions.push('(name LIKE ? OR roll_number LIKE ? OR email LIKE ? OR phone LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
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

// PUT /api/admin/verify/:id - Verify a registration and expire QR
router.put('/verify/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if registration exists
    const [rows] = await pool.execute('SELECT * FROM registrations WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    const registration = rows[0];

    // Check if already verified
    if (registration.verified_at) {
      return res.status(400).json({
        error: 'This registration is already verified.',
        verified_at: registration.verified_at,
      });
    }

    // Update: set verified_at and expire QR
    const now = new Date();
    await pool.execute(
      'UPDATE registrations SET verified_at = ?, qr_expired = TRUE WHERE id = ?',
      [now, id]
    );

    res.json({
      message: 'Registration verified successfully.',
      verified_at: now,
      student: {
        name: registration.name,
        roll_number: registration.roll_number,
      },
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Server error during verification.' });
  }
});

// PUT /api/admin/verify-token/:token - Verify a registration by QR token and expire QR
router.put('/verify-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const [rows] = await pool.execute('SELECT * FROM registrations WHERE qr_token = ?', [token]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'QR code not found.' });
    }

    const registration = rows[0];

    if (registration.verified_at || registration.qr_expired) {
      return res.status(400).json({
        error: 'This QR code has already been verified and expired.',
        verified_at: registration.verified_at,
        student: {
          name: registration.name,
          roll_number: registration.roll_number,
        },
      });
    }

    const now = new Date();
    await pool.execute(
      'UPDATE registrations SET verified_at = ?, qr_expired = TRUE WHERE id = ?',
      [now, registration.id]
    );

    res.json({
      message: 'Registration verified and QR code expired successfully.',
      verified_at: now,
      student: {
        id: registration.id,
        name: registration.name,
        roll_number: registration.roll_number,
        branch: registration.branch,
        section: registration.section,
      },
    });
  } catch (err) {
    console.error('Verify by token error:', err);
    res.status(500).json({ error: 'Server error during verification.' });
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
