const express = require("express");
const supabase = require("../config/supabase");
const requireAuth = require("../middleware/auth");

const router = express.Router();

function readReportInput(body) {
    const {
        platform,
        listingId,
        listingUrl,
        title,
        patternTried,
        garmentType,
        answers,
        questionnaireVersion
    } = body || {};

    if (
        typeof platform !== "string" ||
        !platform.trim() ||
        typeof listingId !== "string" ||
        !listingId.trim() ||
        typeof patternTried !== "boolean"
    ) {
        return { error: "platform, listingId, and patternTried are required" };
    }

    if (answers !== undefined &&
        (answers === null || typeof answers !== "object" || Array.isArray(answers))) {
        return { error: "answers must be a JSON object" };
    }

    if (questionnaireVersion !== undefined &&
        (!Number.isInteger(questionnaireVersion) || questionnaireVersion < 1)) {
        return { error: "questionnaireVersion must be a positive integer" };
    }

    return {
        value: {
            platform: platform.trim(),
            listingId: listingId.trim(),
            listingUrl: typeof listingUrl === "string" ? listingUrl.trim() : null,
            title: typeof title === "string" ? title.trim() : null,
            patternTried,
            garmentType: typeof garmentType === "string" ? garmentType.trim() : null,
            answers: answers || {},
            questionnaireVersion: questionnaireVersion || 1
        }
    };
}

async function findOrCreatePattern(report) {
    const { data, error } = await supabase
        .from("patterns")
        .upsert({
            source_platform: report.platform,
            external_listing_id: report.listingId,
            listing_url: report.listingUrl,
            title: report.title
        }, { onConflict: "source_platform,external_listing_id" })
        .select("id")
        .single();

    if (error) {
        throw error;
    }

    return data.id;
}

router.post("/", requireAuth, async (req, res) => {
    const parsed = readReportInput(req.body);
    if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
    }

    try {
        const patternId = await findOrCreatePattern(parsed.value);
        const { data, error } = await supabase
            .from("reports")
            .upsert({
                user_id: req.user.id,
                pattern_id: patternId,
                pattern_tried: parsed.value.patternTried,
                garment_type: parsed.value.garmentType,
                answers: parsed.value.answers,
                questionnaire_version: parsed.value.questionnaireVersion,
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id,pattern_id" })
            .select("id, pattern_id, pattern_tried, garment_type, answers, questionnaire_version, created_at, updated_at")
            .single();

        if (error) {
            throw error;
        }

        res.status(200).json(data);
    } catch (error) {
        console.error("Report submission failed:", error.message);
        res.status(500).json({ error: "Failed to save report" });
    }
});

router.get("/:platform/:listingId", requireAuth, async (req, res) => {
    const { platform, listingId } = req.params;

    try {
        const { data: pattern, error: patternError } = await supabase
            .from("patterns")
            .select("id")
            .eq("source_platform", platform)
            .eq("external_listing_id", listingId)
            .maybeSingle();

        if (patternError) {
            throw patternError;
        }

        if (!pattern) {
            return res.status(404).json({ error: "Pattern not found" });
        }

        const { data, error } = await supabase
            .from("reports")
            .select("id, pattern_tried, garment_type, answers, questionnaire_version, created_at, updated_at")
            .eq("pattern_id", pattern.id)
            .eq("user_id", req.user.id)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            return res.status(404).json({ error: "Report not found" });
        }

        res.json(data);
    } catch (error) {
        console.error("Report retrieval failed:", error.message);
        res.status(500).json({ error: "Failed to retrieve report" });
    }
});

module.exports = router;