require('dotenv').config();
const { pool } = require('../config/db');
const fs = require('fs');
const path = require('path');

async function cleanDemoData() {
  try {
    console.log('🧹 Clearing demo registrations, test submissions, and uploaded screenshots...');

    // 1. Delete test registrations
    const [resReg] = await pool.execute('DELETE FROM registrations');
    console.log(`✅ Deleted demo registrations: ${resReg.affectedRows}`);

    // 2. Delete test quiz submissions
    const [resSub] = await pool.execute('DELETE FROM quiz_submissions');
    console.log(`✅ Deleted demo quiz submissions: ${resSub.affectedRows}`);

    // 3. Reset quiz config status
    await pool.execute("UPDATE quiz_config SET status = 'draft', started_at = NULL, ended_at = NULL WHERE id = 1");
    console.log('✅ Reset quiz_config to fresh draft state');

    // 4. Delete demo payment upload images
    const uploadsDir = path.join(__dirname, '../uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      let count = 0;
      for (const file of files) {
        if (file.startsWith('payment_')) {
          fs.unlinkSync(path.join(uploadsDir, file));
          count++;
        }
      }
      console.log(`✅ Deleted demo payment screenshots: ${count}`);
    }

    console.log('🎉 Clean-up complete! Database and uploads are completely fresh and ready for live participants.');
  } catch (err) {
    console.error('❌ Error during cleanup:', err.message);
  } finally {
    process.exit(0);
  }
}

cleanDemoData();
