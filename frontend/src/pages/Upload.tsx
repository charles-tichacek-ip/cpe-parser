import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function handleFile(file: File) {
    setError('');
    setUploading(true);
    try {
      const result = await api.upload(file);
      navigate('/review', { state: { results: result.results } });
    } catch (e: any) {
      setError(e.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="page">
      <div className="page-header">
        <span className="eyebrow">CPE Parser</span>
        <h1>Upload Certificates</h1>
        <p className="sub">Drop a single PDF or a ZIP of certificates. Each file is parsed, deduplicated, and staged for your review.</p>
      </div>

      <div
        className={`dropzone ${dragging ? 'dragging' : ''} ${uploading ? 'loading' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.zip"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {uploading ? (
          <>
            <div className="spinner" />
            <p className="drop-label">Parsing certificates…</p>
            <p className="drop-hint">Claude is extracting and classifying each record</p>
          </>
        ) : (
          <>
            <div className="drop-icon">⬆</div>
            <p className="drop-label">Drop PDF or ZIP here</p>
            <p className="drop-hint">or click to browse — max 50MB</p>
          </>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="upload-notes">
        <div className="note-item">
          <span className="note-dot" />
          <span>Duplicate certificates are flagged automatically — nothing is committed without your approval</span>
        </div>
        <div className="note-item">
          <span className="note-dot" />
          <span>ZIP files are unzipped and each PDF is parsed individually</span>
        </div>
        <div className="note-item">
          <span className="note-dot" />
          <span>Low-confidence fields are highlighted in the review screen</span>
        </div>
      </div>
    </div>
  );
}
