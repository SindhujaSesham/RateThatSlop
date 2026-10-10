/*
 * Planned responsibility:
 * Centralize authenticated communication with the RateThatSlop server.
 *
 * Implementation notes:
 * - Keep the server base URL in approved deployment configuration; never
 *   hard-code credentials or tokens in source.
 * - Add authorization headers through auth.js and validate every response
 *   against an expected structured shape.
 * - Implement timeouts, safe retry rules, and explicit errors for
 *   unauthorized, unavailable, invalid, and rate-limited responses.
 * - Send only the minimum listing metadata needed by each endpoint.
 * - Do not send image bytes for ordinary listing, rating, creator, review, or
 *   report requests.
 */