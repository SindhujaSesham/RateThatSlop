// Start the server

require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Database and authentication
const supabase = require("./config/supabase");
const requireAuth = require("./middleware/auth");

// API routes
const patternRoutes = require("./routes/patterns");
const reportRoutes = require("./routes/reports");
const scoreRoutes = require("./routes/scores");
const healthRoutes = require("./routes/health");
const userRoutes = require("./routes/users");
const descriptionRoutes = require("./routes/descriptions");
const reviewRoutes = require("./routes/reviews");
const diagnosticsRoutes = require("./routes/diagnostics");

const app = express();
const PORT = process.env.PORT || 3000;

// Allows Express to read JSON sent in requests
app.use(express.json());
app.use(cors());

// Authenticated user info route
app.get("/api/me", requireAuth, (req, res) => {
    res.json({
        id: req.user.id,
        email: req.user.email
    });
});

// Pattern-related routes
app.use("/api", healthRoutes);
app.use("/api", userRoutes);
app.use("/api/patterns", patternRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/scores", scoreRoutes);
app.use("/api/descriptions", descriptionRoutes);
app.use("/api/reviews", reviewRoutes);


app.use("/api/evaluate-description", descriptionRoutes);
app.use("/api/diagnostics", diagnosticsRoutes);

// ============================================
// Start the server
// ============================================

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});