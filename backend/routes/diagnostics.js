const express = require("express");
const supabase = require("../config/supabase");
const requireAuth = require("../middleware/auth");

const router = express.Router();

async function checkTable(table) {
    const query = supabase.from(table).select("*", { count: "exact", head: true });
    const timeout = new Promise((resolve) => {
        setTimeout(() => resolve({
            error: "database check timed out after 5000ms"
        }), 5000);
    });
    const result = await Promise.race([query, timeout]);
    return result.error ? { ok: false, error: result.error.message || result.error } : { ok: true };
}

router.get("/", requireAuth, async (req, res) => {
    const checks = {};
    const tables = ["profiles", "patterns", "reports", "score_snapshots", "image_analyses"];

    const tableChecks = await Promise.all(tables.map((table) => checkTable(table)));
    tables.forEach((table, index) => {
        checks[table] = tableChecks[index];
    });

    const profileQuery = supabase
        .from("profiles")
        .select("id")
        .eq("id", req.user.id)
        .maybeSingle();
    const profileTimeout = new Promise((resolve) => {
        setTimeout(() => resolve({
            error: { message: "profile check timed out after 5000ms" }
        }), 5000);
    });
    const { data: profile, error: profileError } = await Promise.race([profileQuery, profileTimeout]);
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
