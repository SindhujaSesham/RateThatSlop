/*
 * Planned responsibility:
 * Validate, store, submit, and retrieve extension user reports about Etsy
 * listings or individual listing images.
 *
 * Implementation notes:
 * - Require authentication before submitting or reading account-linked
 *   server reports.
 * - Define report types, validate listing/image identifiers, and prevent
 *   duplicate or abusive submissions.
 * - Apply client-side rate limiting and leave moderation/final trust
 *   decisions to the server.
 * - Return reports as community evidence with confidence and status; never
 *   present an individual report as proof that a seller is fraudulent.
 * - Do not upload image bytes as part of ordinary reports.
 */