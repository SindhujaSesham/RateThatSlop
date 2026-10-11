const express = require("express");
const requireAuth = require("../middleware/auth");

const router = express.Router();
const MAX_REVIEWS = 100;
const MAX_IMAGES = 100;

function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isImageMetadataList(value) {
    return Array.isArray(value) && value.length <= MAX_IMAGES && value.every((image) =>
        isRecord(image) &&
        typeof image.url === "string" &&
        image.url.length > 0 &&
        image.url.length <= 4096 &&
        !/^data:/i.test(image.url) &&
        typeof image.alt === "string" &&
        image.alt.length <= 1000
    );
}

function normalizeReviewsAndImages(value) {
    if (!isRecord(value) ||
        typeof value.ratings !== "string" || value.ratings.length > 2000 ||
        !Array.isArray(value.reviews) || value.reviews.length > MAX_REVIEWS ||
        !value.reviews.every((review) =>
            isRecord(review) &&
            typeof review.text === "string" &&
            review.text.trim().length > 0 &&
            review.text.length <= 2000 &&
            typeof review.rating === "string" &&
            review.rating.length <= 200
        ) ||
        !isImageMetadataList(value.images) ||
        !isImageMetadataList(value.reviewImages)) {
        return null;
    }

    return {
        ratings: value.ratings,
        reviews: value.reviews.map(({ text, rating }) => ({ text, rating })),
        images: value.images.map(({ url, alt }) => ({ url, alt })),
        reviewImages: value.reviewImages.map(({ url, alt }) => ({ url, alt })),
    };
}

router.post("/evaluate", requireAuth, async (req, res) => {
    const reviewsAndImages = normalizeReviewsAndImages(req.body?.reviewsAndImages);
    if (!reviewsAndImages) {
        return res.status(400).json({ error: "valid reviewsAndImages are required" });
    }
    try {
        const { evaluateReviews } = await import("../evaluate-reviews.mjs");
        res.json(await evaluateReviews(reviewsAndImages));
    } catch (error) {
        console.error("Review evaluation failed:", error.message);
        res.status(503).json({ error: "Review evaluation is unavailable" });
    }
});

module.exports = router;