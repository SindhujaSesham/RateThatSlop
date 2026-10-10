/*
 * Planned responsibility:
 * Own account creation, login, logout, session restoration, and token
 * lifecycle for authenticated server features.
 *
 * Implementation notes:
 * - Keep credentials in the approved authentication flow and never log them.
 * - Store only the minimum session material required by the chosen auth
 *   design, preferably using secure short-lived access tokens and refresh
 *   handling where supported.
 * - Expose explicit signed-out, authenticated, expired, and unavailable
 *   states to background callers and the popup.
 * - Clear local session data on logout and authentication failure.
 * - Do not make local image inference depend on account availability.
 */