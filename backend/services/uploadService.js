import { getDatabricksConfig } from "../config/databricks.js";

const VOLUME_PATH =
  "/Volumes/tsed_corporate_dev/finance_gold/vol_01_presentation";

async function getAccessToken() {
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
  return data.access_token;
}

export async function uploadToVolume(fileBuffer, fileName, { bsarId, gjahr, poper }) {
  const token = await getAccessToken();
  const config = getDatabricksConfig();

  const volumeFilePath = `${VOLUME_PATH}/bsar/${bsarId}/${gjahr}/${poper}/${fileName}`;
  const apiPath = `/api/2.0/fs/files${volumeFilePath}`;
  const url = `https://${config.host}${apiPath}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Databricks upload failed: ${res.status} ${text}`);
  }

  return { path: volumeFilePath };
}
