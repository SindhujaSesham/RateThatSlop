
const express = require("express");
const supabase = require("./config/supabase");
const patternRoutes = require("./routes/patterns");

const app = express();
const PORT = 3000;

// Allows Express to read JSON sent in requests
app.use(express.json());

// Basic Check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Rate that slop backend is running!" });
});

// Existing database connection check
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

// Pattern_related routes
app.use("/api/patterns", patternRoutes);
// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
