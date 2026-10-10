const express = require("express");
const requireAuth = require("../middleware/auth");

const router = express.Router();

router.get("/me", requireAuth, (req, res) => {
    res.json({
        id: req.user.id,
        email: req.user.email
    });
});

module.exports = router;
