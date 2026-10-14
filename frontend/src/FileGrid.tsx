export interface UploadedFile {
  id: number;
  file_name: string;
  volume_path: string;
  bsar_id: string;
  gjahr: string;
  poper: string;
  content_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

interface Props {
  files: UploadedFile[];
  loading: boolean;
  error: string;
}

function formatSize(bytes: number | null) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function fileExt(name: string) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()!.toUpperCase() : "FILE";
}

const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];
const VIDEO_EXT = ["mp4", "mov", "webm", "m4v"];
const AUDIO_EXT = ["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac"];

function kindOf(f: UploadedFile): "image" | "video" | "audio" | "other" {
  const type = (f.content_type || "").toLowerCase();
  const ext = f.file_name.split(".").pop()?.toLowerCase() ?? "";
  if (type.startsWith("image/") || IMAGE_EXT.includes(ext)) return "image";
  if (type.startsWith("video/") || VIDEO_EXT.includes(ext)) return "video";
  if (type.startsWith("audio/") || AUDIO_EXT.includes(ext)) return "audio";
  return "other";
}

export default function FileGrid({ files, loading, error }: Props) {
  return (
    <section className="card">
      <div className="section-head">
        <h2>Uploaded files</h2>
        <span className="muted">{files.length} total</span>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : error ? (
        <p className="msg error">{error}</p>
      ) : files.length === 0 ? (
        <p className="muted">No files uploaded yet.</p>
      ) : (
        <div className="file-grid">
          {files.map((f) => (
            <article key={f.id} className="file-card">
              <a
                className="file-preview"
                href={`/api/files/${f.id}/content`}
                target="_blank"
                rel="noreferrer"
              >
                {kindOf(f) === "image" ? (
                  <img
                    src={`/api/files/${f.id}/content`}
                    alt={f.file_name}
                    loading="lazy"
                  />
                ) : kindOf(f) === "video" ? (
                  <video src={`/api/files/${f.id}/content`} preload="metadata" muted />
                ) : kindOf(f) === "audio" ? (
                  <div className="file-preview-fallback audio">
                    <span className="file-card-icon">{fileExt(f.file_name)}</span>
                    <audio
                      src={`/api/files/${f.id}/content`}
                      controls
                      preload="none"
                      onClick={(e) => e.preventDefault()}
                    />
                  </div>
                ) : (
                  <div className="file-preview-fallback">
                    <span className="file-card-icon">{fileExt(f.file_name)}</span>
                  </div>
                )}
              </a>
              <h3 title={f.file_name}>{f.file_name}</h3>
              <dl>
                <div>
                  <dt>BSAR</dt>
                  <dd>{f.bsar_id}</dd>
                </div>
                <div>
                  <dt>GJAHR</dt>
                  <dd>{f.gjahr}</dd>
                </div>
                <div>
                  <dt>POPER</dt>
                  <dd>{f.poper}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{formatSize(f.size_bytes)}</dd>
                </div>
              </dl>
              <p className="file-date">{formatDate(f.uploaded_at)}</p>
              <p className="file-path" title={f.volume_path}>
                {f.volume_path}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
