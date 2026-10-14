import { getDatabricksConfig } from "../config/databricks.js";

let cached = { token: null, expiresAt: 0 };

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
  cached = { token: data.access_token, expiresAt: Date.now() + expiresInMs };
  return cached.token;
}
