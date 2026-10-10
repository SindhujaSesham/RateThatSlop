/*
 * Planned responsibility:
 * Read and manage trusted creator or seller information used as a bounded
 * contextual signal in listing ratings.
 *
 * Implementation notes:
 * - Use authenticated api-client requests for shared server data.
 * - Keep local user preferences, such as a personal trusted-seller list, in
 *   chrome.storage.local when appropriate.
 * - Return normalized signal objects with score, confidence, status, and
 *   reasons; trust must reduce risk without overriding strong evidence.
 * - Handle signed-out, expired-session, unavailable-server, and missing-seller
 *   states explicitly.
 * - Never store or log passwords, access tokens, or unnecessary personal data.
 */