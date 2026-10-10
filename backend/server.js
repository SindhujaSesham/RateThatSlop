
const express = require("express");

const app = express();
const PORT = 3000;

// Allows Express to read JSON sent in requests
app.use(express.json());

// Test endpoint
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Rate that slop backend is running!" });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
