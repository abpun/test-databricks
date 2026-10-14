import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";
import databricksRoutes from "./routes/databricksRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import filesRoutes from "./routes/filesRoutes.js";
import { ensureTable } from "./services/lakebaseService.js";
import { inspectIdentity } from "./services/databricksAuth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 8000);
const staticDir = path.join(__dirname, "static");

if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true });
}

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.options("*", cors());

app.use(express.json());
app.use(express.static(staticDir));

app.use("/api/databricks", databricksRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/files", filesRoutes);

app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from Waft Tech!" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "healthy" });
});

// Diagnostic: shows the service principal's granted OAuth scope and token
// claims (never the token or secret). Remove once you've verified scope.
app.get("/api/debug/identity", async (req, res) => {
  try {
    const info = await inspectIdentity();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/data", (req, res) => {
  const data = Array.from({ length: 30 }, (_, x) => ({
    x,
    y: 2 ** x,
  }));

  res.json({
    data,
    title: "Hello world!",
    x_title: "Apps",
    y_title: "Fun with data",
  });
});

app.get("*", (req, res) => {
  const indexHtml = path.join(staticDir, "index.html");

  if (fs.existsSync(indexHtml)) {
    console.log(`Serving React frontend for path: ${req.path}`);
    return res.sendFile(indexHtml);
  }

  console.error("Frontend not built. index.html missing.");
  return res
    .status(404)
    .send("Frontend not built. Please run 'npm run build' first.");
});

app.listen(port, () => {
  console.log(`Application is running on port ${port}`);

  ensureTable()
    .then(() => console.log("Lakebase table 'uploaded_files' is ready."))
    .catch((err) =>
      console.error(
        "Could not ensure Lakebase table on startup:",
        err.message,
      ),
    );
});
