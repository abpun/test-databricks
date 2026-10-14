import { useState, useRef } from "react";

interface UploadResult {
  message: string;
  fileName: string;
  path: string;
}

export default function FileUpload() {
  const [bsarId, setBsarId] = useState("");
  const [gjahr, setGjahr] = useState("");
  const [poper, setPoper] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 25 * 1024 * 1024;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setError("");
    setResult(null);

    if (!selected) {
      setFile(null);
      return;
    }

    if (!selected.name.toLowerCase().endsWith(".xlsx")) {
      setError("Only .xlsx files are allowed");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (selected.size > MAX_SIZE) {
      setError("File exceeds 25 MB limit");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !bsarId || !gjahr || !poper) return;

    setUploading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bsarId", bsarId);
    formData.append("gjahr", gjahr);
    formData.append("poper", poper);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
      } else {
        setResult(data);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const isValid = file && bsarId && gjahr && poper;

  return (
    <section className="upload-card">
      <h2>Upload File to Databricks Volume</h2>

      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-row">
          <label>
            BSAR ID
            <input
              type="text"
              value={bsarId}
              onChange={(e) => setBsarId(e.target.value)}
              placeholder="e.g. 1001"
              required
            />
          </label>
          <label>
            GJAHR
            <input
              type="text"
              value={gjahr}
              onChange={(e) => setGjahr(e.target.value)}
              placeholder="e.g. 2024"
              required
            />
          </label>
          <label>
            POPER
            <input
              type="text"
              value={poper}
              onChange={(e) => setPoper(e.target.value)}
              placeholder="e.g. 01"
              required
            />
          </label>
        </div>

        <div className="file-input-row">
          <label>
            File (.xlsx, max 25 MB)
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              required
            />
          </label>
          {file && (
            <span className="file-info">
              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          )}
        </div>

        <button type="submit" disabled={!isValid || uploading}>
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </form>

      {error && <p className="upload-error">{error}</p>}

      {result && (
        <div className="upload-success">
          <p>Uploaded: {result.fileName}</p>
          <p className="upload-path">{result.path}</p>
        </div>
      )}
    </section>
  );
}
