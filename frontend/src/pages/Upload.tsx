import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

type Status = 'pending' | 'uploading' | 'done' | 'error';
interface Item { name: string; status: Status; message?: string }

const STATUS_LABEL: Record<Status, string> = {
  pending: 'Queued',
  uploading: 'Parsing…',
  done: 'Done',
  error: 'Failed',
};

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  function update(i: number, patch: Partial<Item>) {
    setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter(f => /\.(pdf|zip)$/i.test(f.name));
    if (files.length === 0) {
      setError('Only PDF and ZIP files are supported');
      return;
    }
    setError('');
    setUploading(true);
    setItems(files.map(f => ({ name: f.name, status: 'pending' })));

    const allResults: any[] = [];
    let failures = 0;

    for (let i = 0; i < files.length; i++) {
      update(i, { status: 'uploading' });
      try {
        const result = await api.upload(files[i]);
        allResults.push(...result.results);
        update(i, { status: 'done', message: `${result.count} record${result.count === 1 ? '' : 's'}` });
      } catch (e: any) {
        failures++;
        update(i, { status: 'error', message: e.message ?? 'Upload failed' });
      }
    }

    setUploading(false);

    if (allResults.length > 0 && failures === 0) {
      navigate('/review', { state: { results: allResults } });
    } else if (allResults.length > 0) {
      setError(`${failures} of ${files.length} files failed. Successfully parsed records are in the review queue.`);
    } else {
      setError('No files could be parsed');
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!uploading && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  const doneCount = items.filter(i => i.status === 'done' || i.status === 'error').length;

  return (
    <div className="page">
      <div className="page-header">
        <span className="eyebrow">CPE Parser</span>
        <h1>Upload Certificates</h1>
        <p className="sub">Drop one or more PDFs, or a ZIP of certificates. Each file is parsed, deduplicated, and staged for your review.</p>
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
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {uploading ? (
          <>
            <div className="spinner" />
            <p className="drop-label">Parsing {doneCount + 1 > items.length ? items.length : doneCount + 1} of {items.length}…</p>
            <p className="drop-hint">Claude is extracting and classifying each record</p>
          </>
        ) : (
          <>
            <div className="drop-icon">⬆</div>
            <p className="drop-label">Drop PDFs or a ZIP here</p>
            <p className="drop-hint">or click to browse — select multiple files, max 50MB each</p>
          </>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '8px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
              <span
                style={{
                  flexShrink: 0,
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  color: it.status === 'error' ? 'var(--red)' : 'var(--text)',
                }}
              >
                {STATUS_LABEL[it.status]}{it.message ? ` · ${it.message}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {!uploading && error && items.some(i => i.status === 'done') && (
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/review')}>
          Go to review
        </button>
      )}

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
