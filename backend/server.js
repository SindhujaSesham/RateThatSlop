// Start the server

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
});
*/
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

// Pattern-related routes
app.use("/api/patterns", patternRoutes);


// ============================================
// Gemini Description Evaluation Endpoint
// ============================================

// Evaluates an Etsy sewing pattern description
// using the existing evaluate-description.mjs file.

app.post("/api/evaluate-description", async (req, res) => {
    try {
        const { description } = req.body || {};

        // Make sure a description was provided
        if (
            typeof description !== "string" ||
            !description.trim()
        ) {
            return res.status(400).json({
                error: "A non-empty description is required."
            });
        }

        // Prevent excessively large descriptions
        if (description.length > 20000) {
            return res.status(400).json({
                error: "Description is too long."
            });
        }

        // Import the existing Gemini evaluation function
        const { evaluateDescription } =
            await import("./evaluate-description.mjs");

        // Send the description to Gemini for evaluation
        const result = await evaluateDescription(description);

        // Return the evaluation result to the caller
        return res.status(200).json(result);

    } catch (error) {
        console.error("Description evaluation failed:", error);

        return res.status(500).json({
            error: "Description evaluation failed."
        });
    }
});


// ============================================
// Start the server
// ============================================

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});