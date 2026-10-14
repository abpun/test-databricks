import express from "express";
import multer from "multer";
import { uploadToVolume } from "../services/uploadService.js";
import { insertFileRecord } from "../services/lakebaseService.js";
import { databricksConfig } from "../config/databricks.js";

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

// Allowed extensions: documents, images/photos, music/audio, video, archives.
const ALLOWED_EXTENSIONS = new Set([
  // documents
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "txt", "csv", "rtf", "md", "odt", "ods", "odp",
  // images / photos
  "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "tif", "tiff", "heic", "heif",
  // music / audio
  "mp3", "wav", "flac", "aac", "ogg", "oga", "m4a", "wma",
  // video
  "mp4", "mov", "avi", "mkv", "webm", "m4v",
  // archives
  "zip",
]);

function isAllowed(file) {
  const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";
  if (ALLOWED_EXTENSIONS.has(ext)) return true;
  // Fallback: accept any image/audio/video by MIME type.
  return /^(image|audio|video)\//.test(file.mimetype);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!isAllowed(file)) {
      return cb(
        new Error("Unsupported file type (documents, images, audio and video are allowed)"),
      );
    }
    cb(null, true);
  },
});

const router = express.Router();

router.post("/", (req, res) => {
  upload.single("file")(req, res, async (multerErr) => {
    if (multerErr) {
      const status = multerErr.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(status).json({ error: multerErr.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { bsarId, gjahr, poper } = req.body;
    if (!bsarId || !gjahr || !poper) {
      return res
        .status(400)
        .json({ error: "bsarId, gjahr, and poper are required" });
    }

    try {
      const result = await uploadToVolume(req.file.buffer, req.file.originalname, {
        bsarId,
        gjahr,
        poper,
      });

      const record = await insertFileRecord({
        fileName: req.file.originalname,
        volumePath: result.path,
        bsarId,
        gjahr,
        poper,
        contentType: req.file.mimetype,
        sizeBytes: req.file.size,
        uploadedBy: databricksConfig.clientId,
      });

      return res.json({
        message: "File uploaded successfully",
        file: record,
      });
    } catch (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ error: err.message });
    }
  });
});

export default router;
