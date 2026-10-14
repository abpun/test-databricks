import express from "express";
import { listFiles } from "../services/lakebaseService.js";

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

export default router;
