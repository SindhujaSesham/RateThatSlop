
const supabase = require("../config/supabase");

async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Authentication required"
        });
    }

    const token = authHeader.slice(7);

    try {
        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
            return res.status(401).json({
                error: "Invalid or expired token"
            });
        }

        req.user = data.user;
        next();

    } catch (error) {
        console.error("Authentication error:", error);

        return res.status(500).json({
            error: "Authentication service unavailable"
        });
    }
}

module.exports = requireAuth;
