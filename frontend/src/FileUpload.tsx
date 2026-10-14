import { useState, useRef } from "react";

interface Props {
  onUploaded?: () => void;
}

export default function FileUpload({ onUploaded }: Props) {
  const [bsarId, setBsarId] = useState("");
  const [gjahr, setGjahr] = useState("");
  const [poper, setPoper] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 25 * 1024 * 1024;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setError("");
    setSuccess("");

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
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bsarId", bsarId);
    formData.append("gjahr", gjahr);
    formData.append("poper", poper);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
      } else {
        setSuccess(`Uploaded ${data.file?.file_name ?? file.name}`);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onUploaded?.();
      }
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const isValid = file && bsarId && gjahr && poper;

  return (
    <section className="card upload-card">
      <h2>Upload file</h2>
      <p className="muted">Excel (.xlsx) up to 25 MB, stored to the Databricks Volume.</p>

      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-row">
          <label>
            BSAR ID
            <input
              type="text"
              value={bsarId}
              onChange={(e) => setBsarId(e.target.value)}
              placeholder="1001"
              required
            />
          </label>
          <label>
            GJAHR
            <input
              type="text"
              value={gjahr}
              onChange={(e) => setGjahr(e.target.value)}
              placeholder="2024"
              required
            />
          </label>
          <label>
            POPER
            <input
              type="text"
              value={poper}
              onChange={(e) => setPoper(e.target.value)}
              placeholder="01"
              required
            />
          </label>
        </div>

        <label className="file-field">
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
            {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
          </span>
        )}

        <button type="submit" disabled={!isValid || uploading}>
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>

      {error && <p className="msg error">{error}</p>}
      {success && <p className="msg success">{success}</p>}
    </section>
  );
}
