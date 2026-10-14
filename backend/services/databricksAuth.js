import { getDatabricksConfig } from "../config/databricks.js";

let cached = { token: null, scope: null, expiresAt: 0 };

/**
 * Returns a workspace OAuth access token for the app's service principal,
 * obtained via the client-credentials grant. Cached until shortly before expiry.
 */
export async function getAccessToken() {
  const now = Date.now();
  if (cached.token && now < cached.expiresAt - 60_000) {
    return cached.token;
  }

  const config = getDatabricksConfig();
  const tokenUrl = `https://${config.host}/oidc/v1/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.secret,
    scope: "all-apis",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get access token: ${res.status} ${text}`);
  }

  const data = await res.json();
  const expiresInMs = (Number(data.expires_in) || 3600) * 1000;
  cached = {
    token: data.access_token,
    scope: data.scope || null,
    expiresAt: Date.now() + expiresInMs,
  };
  return cached.token;
}

/**
 * Decodes a JWT payload without verifying the signature. Used only to surface
 * non-sensitive claims (scope, subject, audience, expiry) for diagnostics.
 */
function decodeJwtClaims(token) {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const { scope, sub, aud, exp, client_id } = JSON.parse(json);
    return { scope, sub, aud, exp, client_id };
  } catch {
    return null;
  }
}

/**
 * Returns the SP's granted scope and token claims. Deliberately omits the
 * access token and client secret so it is safe to expose for diagnostics.
 */
export async function inspectIdentity() {
  const token = await getAccessToken();
  return {
    granted_scope: cached.scope,
    expires_at: new Date(cached.expiresAt).toISOString(),
    claims: decodeJwtClaims(token),
  };
}
