require("dotenv").config();
const express = require("express");
const cors = require("cors");
const patternRoutes = require("./routes/patterns");
const reportRoutes = require("./routes/reports");
const scoreRoutes = require("./routes/scores");
const healthRoutes = require("./routes/health");
const userRoutes = require("./routes/users");
const descriptionRoutes = require("./routes/descriptions");

const app = express();
const PORT = process.env.PORT || 3000;

// Allows Express to read JSON sent in requests
app.use(express.json());
app.use(cors());

app.use("/api", healthRoutes);
app.use("/api", userRoutes);
app.use("/api/patterns", patternRoutes);
app.use("/api/scores", scoreRoutes);
app.use("/api/descriptions", descriptionRoutes);
app.use("/api/evaluate-description", descriptionRoutes);


// ============================================
// Start the server
// ============================================

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});