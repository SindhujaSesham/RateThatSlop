/*
 * Planned responsibility:
 * Provide accessible popup controls for account creation, login, logout, and
 * signed-in state.
 *
 * Implementation notes:
 * - Delegate credential and session operations to background/auth.js rather
 *   than handling tokens directly in the popup.
 * - Show signed-out, loading, authenticated, expired-session, and
 *   server-unavailable states clearly.
 * - Explain which features require an account, including reports and shared
 *   trusted-creator or listing data.
 * - Never render or log passwords or access tokens.
 */