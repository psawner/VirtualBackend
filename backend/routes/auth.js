const express = require('express');
const bcrypt = require('bcrypt');
const passport = require('passport');
const db = require('../db');
const router = express.Router();

// ================== REGISTER ==================
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const [existing] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    await db.execute("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashed, role]);

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ================== LOGIN ==================
router.post('/login', (req, res, next) => {
  
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info.message || "Login failed" });

    req.login(user, err => {
      if (err) return next(err);
 
      console.log("Session after login:", req.session);

      return res.json({
        message: "Login successful",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    });
  })(req, res, next);
  

});

// ================== GET LOGGED-IN USER ==================
router.get('/me', (req, res) => {

  console.log("Session in /me route:", req.session);
  console.log("Authenticated?", req.isAuthenticated());
  console.log("User in /me:", req.user);


  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: "Not logged in" });
  }
});

// ================== LOGOUT ==================


router.post('/logout', (req, res) => {
  req.logout(err => {
    if (err) return res.status(500).json({ message: "Logout failed" });

    // 🔥 Destroy the session
    req.session.destroy(err => {
      if (err) return res.status(500).json({ message: "Session destroy failed" });

      // 🔒 Clear session cookie
      res.clearCookie('connect.sid', {
        path: '/', // Important if your cookie has a path
        httpOnly: true,
        sameSite: 'lax',
      });

      res.json({ message: "Logged out" });
    });
  });
});



// ================== FORGOT PASSWORD (STATIC DUMMY) ==================
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  // You’d normally send an email here
  return res.status(200).json({ message: "Reset link sent to your email." });
});

module.exports = router;
