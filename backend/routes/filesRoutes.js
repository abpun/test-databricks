import express from "express";
import { Readable } from "stream";
import { listFiles, getFileById } from "../services/lakebaseService.js";
import { downloadFromVolume } from "../services/uploadService.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const files = await listFiles(limit);
    return res.json({ files });
  } catch (err) {
    console.error("List files error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/:id/content", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid file id" });
  }

  try {
    const record = await getFileById(id);
    if (!record) {
      return res.status(404).json({ error: "File not found" });
    }

    const upstream = await downloadFromVolume(record.volume_path);
    if (!upstream.ok || !upstream.body) {
      const text = upstream.body ? await upstream.text() : "";
      return res
        .status(upstream.status || 502)
        .json({ error: `Failed to fetch file: ${upstream.status} ${text}` });
    }

    res.setHeader(
      "Content-Type",
      record.content_type || "application/octet-stream",
    );
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(record.file_name)}"`,
    );
    if (record.size_bytes) res.setHeader("Content-Length", record.size_bytes);

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    console.error("File content error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

export default router;
