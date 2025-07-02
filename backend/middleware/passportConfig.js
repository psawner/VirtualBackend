const LocalStrategy = require("passport-local").Strategy;
const db = require("../db");
const bcrypt = require("bcrypt");

module.exports = function(passport) {
  passport.use(
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);
        if (rows.length === 0) return done(null, false, { message: "User not found" });

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return done(null, false, { message: "Invalid credentials" });

        delete user.password; // remove password
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      //console.log("Deserializing user ID:", id);
      const [rows] = await db.execute("SELECT id, name, email, role FROM users WHERE id = ?", [id]);
      if (rows.length === 0) return done(null, false);
      return done(null, rows[0]);
    } catch (err) {
      return done(err);
    }
  });
};
