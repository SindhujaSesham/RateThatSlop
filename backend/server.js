
const express = require("express");
const supabase = require("./config/supabase");
const patternRoutes = require("./routes/patterns");
const requireAuth = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;

// Allows Express to read JSON sent in requests
app.use(express.json());

// Basic Check
/*
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Rate that slop backend is running!" });
});*/
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
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

// Authenticated user info route
app.get("/api/me", requireAuth, (req, res) => {
    res.json({
        id: req.user.id,
        email: req.user.email
    });
});


// Pattern_related routes
app.use("/api/patterns", patternRoutes);

// Start the server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
