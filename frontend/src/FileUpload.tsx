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

  const MAX_SIZE = 100 * 1024 * 1024;

  const ALLOWED_EXTENSIONS = [
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "csv", "rtf", "md", "odt", "ods", "odp",
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "tif", "tiff", "heic", "heif",
    "mp3", "wav", "flac", "aac", "ogg", "oga", "m4a", "wma",
    "mp4", "mov", "avi", "mkv", "webm", "m4v",
    "zip",
  ];

  const isAllowed = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (ALLOWED_EXTENSIONS.includes(ext)) return true;
    return /^(image|audio|video)\//.test(f.type);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setError("");
    setSuccess("");

    if (!selected) {
      setFile(null);
      return;
    }

    if (!isAllowed(selected)) {
      setError("Unsupported file type");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (selected.size > MAX_SIZE) {
      setError("File exceeds 100 MB limit");
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
      <p className="muted">
        Documents, images, audio or video up to 100 MB, stored to the Databricks Volume.
      </p>

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
            accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.md,.odt,.ods,.odp,.zip"
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
