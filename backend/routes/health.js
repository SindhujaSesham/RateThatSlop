const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

router.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

router.get("/test-db", async (req, res) => {
    const { data, error } = await supabase
        .from("patterns")
        .select("id, source_platform, title")
        .limit(5);

    if (error) {
        console.error("Database health check failed:", error.message);
        return res.status(503).json({
            status: "error",
            message: "Database unavailable"
        });
    }

    res.json({
        status: "connected",
        patterns: data
    });
});

module.exports = router;
