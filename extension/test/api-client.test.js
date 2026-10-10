/*
 * Planned test coverage:
 * - Authorization header and request-shape construction.
 * - Response schema validation.
 * - Timeout, unauthorized, rate-limit, malformed-response, and network
 *   errors.
 * - Safe retry behavior.
 * - Confirmation that ordinary requests exclude image bytes and secrets from
 *   logs or error messages.
 */