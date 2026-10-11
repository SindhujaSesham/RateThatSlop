const express = require("express");
const requireAuth = require("../middleware/auth");

const router = express.Router();

router.post("/evaluate", requireAuth, async (req, res) => {
    const description = req.body?.description;
    if (typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ error: "description is required" });
    }
    if (description.length > 20000) {
        return res.status(400).json({ error: "description is too long" });
    }
    try {
        const { evaluateDescription } = await import("../evaluate-description.mjs");
        res.json(await evaluateDescription(description));
    } catch (error) {
        console.error("Description evaluation failed:", error.message);
        res.status(503).json({ error: "Description evaluation is unavailable" });
    }
});

module.exports = router;
