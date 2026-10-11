//SETUP SUPABASE CLIENT
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or legacy SUPABASE_KEY)");
}

try {
    const payload = JSON.parse(Buffer.from(supabaseKey.split(".")[1], "base64url").toString("utf8"));
    if (payload.role !== "service_role") {
        console.warn("SUPABASE_SERVICE_ROLE_KEY is not a service_role key; database writes may be rejected by RLS.");
    }
} catch {
    console.warn("Could not inspect Supabase key role; use the service_role key for server database access.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

module.exports = supabase;
