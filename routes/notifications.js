const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/ensureAuthenticated');

// GET unseen upcoming conferences
router.get('/unseen-upcoming', authenticateToken, async (req, res) => {
  try {
    const [unseen] = await db.execute(`
      SELECT c.id, c.title, c.datetime
      FROM conferences c
      LEFT JOIN seen_conferences s
        ON c.id = s.conference_id AND s.user_id = ?
      WHERE c.datetime > NOW() AND s.conference_id IS NULL
    `, [req.user.id]);

    res.json({ unseen });
  } catch (err) {
    console.error("Error fetching unseen conferences:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST mark upcoming conferences as seen
router.post('/mark-seen', authenticateToken, async (req, res) => {
  try {
    const seenIds = req.body.seenIds; // Array of conference IDs
    const userId = req.user.id;

    if (!Array.isArray(seenIds) || seenIds.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    const values = seenIds.map(id => [userId, id]);
    await db.query('INSERT IGNORE INTO seen_conferences (user_id, conference_id) VALUES ?', [values]);

    res.json({ message: 'Marked as seen' });
  } catch (err) {
    console.error("Mark seen error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
