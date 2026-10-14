import { useState, useEffect, useCallback } from "react";
import "./App.css";
import FileUpload from "./FileUpload";
import FileGrid, { UploadedFile } from "./FileGrid";

function App() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/files?limit=200");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load files");
      setFiles(Array.isArray(data.files) ? data.files : []);
    } catch (err: any) {
      setError(err.message || "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>File Uploads</h1>
        <p className="muted">Databricks Volume + Lakebase Postgres</p>
      </header>

      <main className="app-main">
        <FileUpload onUploaded={loadFiles} />
        <FileGrid files={files} loading={loading} error={error} />
      </main>
    </div>
  );
}

export default App;
