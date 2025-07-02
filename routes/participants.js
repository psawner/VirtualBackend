const express = require("express");
const router = express.Router();
const db = require("../db");

// Get all participants for a conference
router.get("/:conferenceId", async (req, res) => {
  const { conferenceId } = req.params;
  try {
    const [rows] = await db.query(`
  SELECT MIN(id) AS id, conference_id, email, MIN(name) AS name
  FROM participants
  WHERE conference_id = ?
  GROUP BY email
`, [conferenceId]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error fetching participants" });
  }
});

// Add a participant (Join Conference)
/*router.post("/", async (req, res) => {
  const { conferenceId, email, name } = req.body;

  if (!conferenceId || !email) {
    return res.status(400).json({ error: "conferenceId and email are required" });
  }

  try {
    // Check if this email already exists for the conference
    const [existing] = await db.query(
      "SELECT id FROM participants WHERE conference_id = ? AND email = ?",
      [conferenceId, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: "This participant is already added to the conference" });
    }
    await db.query(
      "INSERT INTO participants (conference_id, email, name) VALUES (?, ?, ?)",
      [conferenceId, email, name || null]
    );
    res.json({ message: "Participant added" });
  } catch (err) {
    console.error("Error adding participant:", err);
    res.status(500).json({ error: "Error adding participant" });
  }
});
*/

router.post("/", async (req, res) => {
  let { conferenceId, email, name } = req.body;

  conferenceId = parseInt(conferenceId, 10); // 🔑 Convert to integer
  name = (name || "").trim();
  // ✅ Debug log
  console.log("🔍 Received participant data:", { conferenceId, email, name });

  if (!conferenceId || !email) {
    return res.status(400).json({ error: "Valid conferenceId and email are required" });
  }

  try {
    const [existing] = await db.query(
      "SELECT id FROM participants WHERE conference_id = ? AND email = ?",
      [conferenceId, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: "This participant is already added to the conference" });
    }

    await db.query(
      "INSERT INTO participants (conference_id, email, name) VALUES (?, ?, ?)",
      [conferenceId, email, name || "Anonymous"]
    );
    

    res.json({ message: "Participant added" });
  } catch (err) {
    console.error("Error adding participant:", err);
    res.status(500).json({ error: "Error adding participant" });
  }
});


// Delete a participant
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM participants WHERE id = ?", [id]);
    res.json({ message: "Participant removed" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting participant" });
  }
});

// PUT /api/participants/:id/status
router.put("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    await db.query("UPDATE participants SET status = ? WHERE id = ?", [status, id]);
    res.json({ message: "Status updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Update participant name
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) return res.status(400).json({ error: "Name is required" });

  try {
    await db.query("UPDATE participants SET name = ? WHERE id = ?", [name, id]);
    res.json({ message: "Participant updated" });
  } catch (err) {
    console.error("Error updating participant:", err);
    res.status(500).json({ error: "Error updating participant" });
  }
});


const ensureAuthenticated = require("../middleware/ensureAuthenticated");


// ✅ Get all conferences the logged-in user has joined
router.get("/my", ensureAuthenticated, async (req, res) => {
  const userEmail = req.user.email;

  try {
    const [joined] = await db.query(
      `SELECT c.id, c.title, c.datetime, c.duration, c.description 
       FROM participants p
       JOIN conferences c ON p.conference_id = c.id
       WHERE p.email = ?`,
      [userEmail]
    );

    res.json(joined);
  } catch (error) {
    console.error("Error fetching user's joined conferences:", error);
    res.status(500).json({ message: "Server error" });
  }
});





module.exports = router;
