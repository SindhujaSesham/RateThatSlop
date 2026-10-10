
const express = require("express");
const supabase = require("./config/supabase");

const app = express();
const PORT = 3000;

// Allows Express to read JSON sent in requests
app.use(express.json());

// Test endpoint
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Rate that slop backend is running!" });
});

app.get("/api/test-db", async (req, res) => {
    const { data, error } = await supabase
        .from("patterns")
        .select("id, source_platform, title")
        .limit(5);

    if (error) {
        return res.status(500).json({
            status: "error",
            message: error.message
        });
    }

    res.json({
        status: "connected",
        patterns: data
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
