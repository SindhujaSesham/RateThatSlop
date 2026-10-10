const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

router.get("/:platform/:listingId", async (req, res) => {
    const { platform, listingId } = req.params;

    try {
        const { data: pattern, error: patternError } = await supabase
            .from("patterns")
            .select("id, source_platform, external_listing_id, listing_url, title")
            .eq("source_platform", platform)
            .eq("external_listing_id", listingId)
            .maybeSingle();

        if (patternError) {
            throw patternError;
        }

        if (!pattern) {
            return res.status(404).json({ error: "Pattern not found" });
        }

        const { data: snapshot, error: snapshotError } = await supabase
            .from("score_snapshots")
            .select("id, total_image_score, description_score, user_reports_score, etsy_review_score, trusted_creator_score, aggregate_score, model_version, scoring_version, calculated_at")
            .eq("pattern_id", pattern.id)
            .order("calculated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (snapshotError) {
            throw snapshotError;
        }

        if (!snapshot) {
            return res.status(404).json({ error: "Score not found" });
        }

        const { data: images, error: imageError } = await supabase
            .from("image_analyses")
            .select("image_index, image_hash, ai_score, model_version, analyzed_at")
            .eq("snapshot_id", snapshot.id)
            .order("image_index", { ascending: true });

        if (imageError) {
            throw imageError;
        }

        res.json({
            pattern,
            score: {
                ...snapshot,
                images: images || []
            }
        });
    } catch (error) {
        console.error("Score retrieval failed:", error.message);
        res.status(500).json({ error: "Failed to retrieve score" });
    }
});

module.exports = router;