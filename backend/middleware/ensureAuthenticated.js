function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next(); // ✅ User is authenticated, proceed to next middleware or route
  }
  return res.status(401).json({ message: "Unauthorized. Please log in." }); // ❌ Not logged in
}

module.exports = ensureAuthenticated;
