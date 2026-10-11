const express = require("express");
const requireAuth = require("../middleware/auth");

const router = express.Router();

async function evaluate(req, res) {
    const description = req.body?.description;
    if (typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ error: "description is required" });
    }
    if (description.length > 20000) {
        return res.status(400).json({ error: "description is too long" });
    }
    try {
        const { evaluateDescription } = await import("../evaluate-description.mjs");
        const result = await evaluateDescription(description, req.body?.listingDetails || {});
        const score = Number(result?.ai_likeness_score);
        if (!Number.isInteger(score) || score < 0 || score > 100) {
            return res.status(502).json({ error: "Description evaluator returned an invalid score" });
        }
        const rationale = typeof result.overall_rationale === "string"
            ? result.overall_rationale
                .replace(/^\s*AI-writing likelihood:\s*\d+\s*\/\s*100(?:\s*\([^)]*\))?\.\s*/i, "")
                .trim()
            : "";
        res.json({
            ...result,
            descriptionScore: score / 100,
            descriptionRationale: rationale,
            overall_rationale: rationale,
        });
    } catch (error) {
        console.error("Description evaluation failed:", error.message);
        res.status(503).json({ error: "Description evaluation is unavailable" });
    }
}

router.post("/evaluate", requireAuth, evaluate);
router.post("/", requireAuth, evaluate);

module.exports = router;
