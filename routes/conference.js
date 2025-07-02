const express = require("express");
const router = express.Router();
const db = require("../db"); // your MySQL connection



router.post("/create", async (req, res) => {
  const { title, datetime, duration, description, hostEmail } = req.body;

  if (!title || !datetime || !duration || !description || !hostEmail) {
    return res.status(400).json({ message: "All fields are required, including hostEmail." });
  }

  try {
    const sql = "INSERT INTO conferences (title, datetime, duration, description, host_email) VALUES (?, ?, ?, ?, ?)";
    const values = [title, datetime, duration, description, hostEmail];

    const [result] = await db.query(sql, values);
    res.status(200).json({ 
      message: "Conference created successfully.", 
      id: result.insertId
    });
  } catch (error) {
    console.error("Error creating conference:", error);
    res.status(500).json({ message: "Server error." });
  }
});


// routes/conference.js (add this route below the POST /create route)
router.get("/all", async (req, res) => {
    try {
      const [results] = await db.query("SELECT * FROM conferences ORDER BY datetime DESC");
      res.json(results);
    } catch (error) {
      console.error("Error fetching conferences:", error);
      res.status(500).json({ message: "Server error." });
    }
  });

  

  router.put("/:id", async (req, res) => {
    const { title, datetime, duration, description } = req.body;
    const { id } = req.params;
  
    try {
      await db.query(
        "UPDATE conferences SET title = ?, datetime = ?, duration = ?, description = ? WHERE id = ?",
        [title, datetime, duration, description, id]
      );
      res.json({ message: "Updated successfully" });
    } catch (error) {
      console.error("Update error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });




  router.delete("/:id", async (req, res) => {
    const { id } = req.params;
  
    try {
      await db.query("DELETE FROM conferences WHERE id = ?", [id]);
      res.json({ message: "Deleted successfully" });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  
  // Get single conference by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query("SELECT * FROM conferences WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Conference not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching conference:", error);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
