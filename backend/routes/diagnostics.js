const express = require("express");
const supabase = require("../config/supabase");
const requireAuth = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
    const checks = {};
    const tables = ["profiles", "patterns", "reports", "score_snapshots", "image_analyses"];

    for (const table of tables) {
        const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
        checks[table] = error
            ? { ok: false, error: error.message }
            : { ok: true };
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", req.user.id)
        .maybeSingle();
    checks.profileForSignedInUser = profileError
        ? { ok: false, error: profileError.message }
        : { ok: Boolean(profile), error: profile ? undefined : "profile row is missing" };

    const failed = Object.values(checks).some((check) => !check.ok);
    res.status(failed ? 503 : 200).json({
        ok: !failed,
        authenticatedUserId: req.user.id,
        checks,
    });
});

module.exports = router;
