
const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

router.get("/:platform/:listingId", async (req, res) => {
    const { platform, listingId } = req.params;

    try {
        const { data, error } = await supabase
            .from("patterns")
            .select("id, source_platform, external_listing_id, listing_url, title")
            .eq("source_platform", platform)
            .eq("external_listing_id", listingId)
            .maybeSingle();

        if (error) {
            console.error("Database error:", error.message);
            return res.status(500).json({
                error: "Failed to retrieve pattern"
            });
        }

        if (!data) {
            return res.status(404).json({
                error: "Pattern not found"
            });
        }

        res.json(data);

    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({
            error: "Internal server error"
        });
    }
});

module.exports = router;
