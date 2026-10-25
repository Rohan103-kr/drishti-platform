require('dotenv').config();
const { pool } = require('../config/db');
const fs = require('fs');
const path = require('path');

async function cleanData() {
  const mode = process.argv[2] || '--all';

  try {
    console.log('\n🧹 ============================================================');
    console.log('   Starting Drishti Data Cleanup');
    console.log('   ============================================================');

    const resetUsers = mode === '--all' || mode === '--users';
    const resetQuiz = mode === '--all' || mode === '--quiz';

    // 1. Reset Student Registrations & Uploads
    if (resetUsers) {
      const [resReg] = await pool.execute('DELETE FROM registrations');
      try {
        await pool.execute('ALTER TABLE registrations AUTO_INCREMENT = 1');
      } catch (e) {}
      console.log(`✅ Cleared student registrations (${resReg.affectedRows} removed, ID counter reset to 1)`);

      // Delete payment screenshot images
      const uploadsDir = path.join(__dirname, '../uploads');
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        let count = 0;
        for (const file of files) {
          if (file.startsWith('payment_')) {
            try {
              fs.unlinkSync(path.join(uploadsDir, file));
              count++;
            } catch (e) {}
          }
        }
        console.log(`✅ Cleared uploaded payment screenshots (${count} files deleted)`);
      }
    }

    // 2. Reset Quiz Submissions & Leaderboard
    if (resetQuiz) {
      const [resSub] = await pool.execute('DELETE FROM quiz_submissions');
      try {
        await pool.execute('ALTER TABLE quiz_submissions AUTO_INCREMENT = 1');
      } catch (e) {}
      console.log(`✅ Cleared quiz participant submissions (${resSub.affectedRows} removed, ID counter reset to 1)`);

      // Reset quiz status to draft
      await pool.execute("UPDATE quiz_config SET status = 'draft', started_at = NULL, ended_at = NULL ORDER BY id DESC LIMIT 1");
      console.log('✅ Reset quiz competition state to fresh draft');
    }

    console.log('\n🎉 SUCCESS: Data has been reset successfully!');
    console.log('   - Admin accounts: PRESERVED 🔐');
    console.log('   - Quiz questions: PRESERVED 📝');
    console.log('============================================================\n');
  } catch (err) {
    console.error('❌ Error during cleanup:', err.message);
  } finally {
    process.exit(0);
  }
}

cleanData();

