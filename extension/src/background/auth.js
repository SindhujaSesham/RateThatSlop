const SESSION_KEY = "serverSession";

function chromeStorage() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    throw new Error("extension storage is unavailable");
  }
  return chrome.storage.local;
}

export async function getSession() {
  const stored = await chromeStorage().get(SESSION_KEY);
  const session = stored[SESSION_KEY];
  if (!session || typeof session !== "object" ||
      typeof session.accessToken !== "string" || !session.accessToken) {
    return null;
  }
  return {
    accessToken: session.accessToken,
    expiresAt: typeof session.expiresAt === "string" ? session.expiresAt : null,
    user: session.user && typeof session.user === "object" ? session.user : null,
  };
}

export async function getAccessToken() {
  const session = await getSession();
  if (!session) return null;
  if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) {
    await clearSession();
    return null;
  }
  return session.accessToken;
}

export async function setSession(session) {
  if (!session || typeof session.accessToken !== "string" || !session.accessToken) {
    throw new Error("an access token is required");
  }
  await chromeStorage().set({
    [SESSION_KEY]: {
      accessToken: session.accessToken,
      expiresAt: typeof session.expiresAt === "string" ? session.expiresAt : null,
      user: session.user && typeof session.user === "object" ? session.user : null,
    },
  });
}

export async function clearSession() {
  await chromeStorage().remove(SESSION_KEY);
  await chromeStorage().remove("serverListingCache");
}