const express = require("express");
const requireAuth = require("../middleware/auth");

const router = express.Router();

router.post("/evaluate", requireAuth, async (req, res) => {
    const description = req.body?.description;
    const suppliedDetails = req.body?.listingDetails || {};
    if (typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ error: "description is required" });
    }
    if (description.length > 20000) {
        return res.status(400).json({ error: "description is too long" });
    }
    if (!suppliedDetails || typeof suppliedDetails !== "object" || Array.isArray(suppliedDetails)) {
        return res.status(400).json({ error: "listingDetails must be an object" });
    }
    const detailLimits = { title: 500, price: 120, instructions: 12000, attributes: 12000 };
    const listingDetails = {};
    for (const [key, limit] of Object.entries(detailLimits)) {
        const value = suppliedDetails[key];
        if (value !== undefined && typeof value !== "string") {
            return res.status(400).json({ error: `listingDetails.${key} must be text` });
        }
        listingDetails[key] = typeof value === "string" ? value.slice(0, limit) : "";
    }
    if (Object.values(listingDetails).join("\n").length > 20000) {
        return res.status(400).json({ error: "listing details are too long" });
    }
    try {
        const { evaluateDescription } = await import("../evaluate-description.mjs");
        res.json(await evaluateDescription(description, listingDetails));
    } catch (error) {
        console.error("Description evaluation failed:", error.message);
        res.status(503).json({ error: "Description evaluation is unavailable" });
    }
});

module.exports = router;
