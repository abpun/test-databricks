import express from "express";
import {
  getTableNames,
  getBalanceData,
  getTransactionalData,
} from "../services/databricksService.js";

const router = express.Router();

router.get("/health", async (req, res) => {
  try {
    res.json({ status: "healthy" });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Databricks connectivity check failed",
      error: error.message,
    });
  }
});

router.get("/tables", async (req, res) => {
  try {
    const data = await getTableNames();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

router.get("/balance", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const data = await getBalanceData(limit);
    console.log("Balance data:", data);
    return res.json({ rows: Array.isArray(data) ? data : [data] });
  } catch (error) {
    console.log("Balance error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/transactions", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const data = await getTransactionalData(limit);
    return res.json({ rows: Array.isArray(data) ? data : [data] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
