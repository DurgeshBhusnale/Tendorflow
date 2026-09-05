const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

// The access token is mirrored into localStorage so a page reload can reuse one
// that is still valid instead of spending a round trip on /api/auth/refresh just
// to get back to where it was. The refresh token already lives there and is the
// strictly more powerful credential, so this doesn't widen the XSS blast radius.
let accessToken: string | null = localStorage.getItem(ACCESS_TOKEN_KEY);

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string | null): void {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

/**
 * Whether the stored access token can still be spent on a request. Absent,
 * malformed and near-expiry tokens all read as unusable; `skewSeconds` keeps a
 * token that is about to lapse mid-flight from being treated as good.
 *
 * This is an optimisation, not an authorisation check — the server decides. If
 * it disagrees the response interceptor refreshes and retries.
 */
export function isAccessTokenUsable(skewSeconds = 30): boolean {
  const token = getAccessToken();
  if (!token) {
    return false;
  }
  const payload = decodeJwtPayload(token);
  if (typeof payload?.exp !== "number") {
    return false;
  }
  return payload.exp * 1000 > Date.now() + skewSeconds * 1000;
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  const segment = token.split(".")[1];
  if (!segment) {
    return null;
  }
  try {
    return JSON.parse(atob(segment.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  setAccessToken(null);
  setRefreshToken(null);
}
