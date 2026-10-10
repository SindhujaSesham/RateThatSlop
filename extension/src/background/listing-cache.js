/*
 * Planned responsibility:
 * Cache server-provided listing records and ratings locally so repeated page
 * visits do not require unnecessary requests or local inference.
 *
 * Implementation notes:
 * - Use a stable Etsy listing identity, preferably the canonical listing URL
 *   or listing ID, rather than an individual image URL.
 * - Store source, calculated-at time, model/rating version, signal metadata,
 *   and freshness information with each cached record.
 * - Validate cached records before use and define an explicit expiration
 *   policy.
 * - Fall back to local image inference when the record is missing, stale,
 *   invalid, or unavailable to an unsigned user.
 * - Keep cache contents minimal and clear account-scoped data on logout when
 *   required by the server privacy policy.
 */