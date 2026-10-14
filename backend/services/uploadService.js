import { getDatabricksConfig } from "../config/databricks.js";
import { getAccessToken } from "./databricksAuth.js";

const VOLUME_PATH =
  "/Volumes/tsed_corporate_dev/finance_gold/vol_01_presentation";

export async function uploadToVolume(fileBuffer, fileName, { bsarId, gjahr, poper }) {
  const token = await getAccessToken();
  const config = getDatabricksConfig();

  const volumeFilePath = `${VOLUME_PATH}/bsar/${bsarId}/${gjahr}/${poper}/${fileName}`;
  const apiPath = `/api/2.0/fs/files${volumeFilePath}`;
  const url = `https://${config.host}${apiPath}?overwrite=true`;

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
