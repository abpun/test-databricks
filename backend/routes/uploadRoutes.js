import express from "express";
import multer from "multer";
import { uploadToVolume } from "../services/uploadService.js";
import { insertFileRecord } from "../services/lakebaseService.js";
import { databricksConfig } from "../config/databricks.js";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const isXlsx =
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.originalname.toLowerCase().endsWith(".xlsx");
    if (!isXlsx) {
      return cb(new Error("Only .xlsx files are allowed"));
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
