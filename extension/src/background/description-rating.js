/*
 * Planned responsibility:
 * Analyze listing titles and descriptions for indicators that the text may
 * have been generated or heavily templated.
 *
 * Implementation notes:
 * - Accept normalized listing text and return { score, confidence, status,
 *   reasons } so rating.js can combine this signal with other evidence.
 * - Keep text analysis local by default; do not send descriptions to a
 *   remote service unless the user explicitly opts into that feature.
 * - Treat missing, short, or inaccessible text as insufficient data rather
 *   than as evidence of suspicious behavior.
 * - Keep this signal separate from the image detector and do not label
 *   generated text as proof of fraud.
 */