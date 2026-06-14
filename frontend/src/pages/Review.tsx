import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, openCertificate } from '../lib/api';

const DESIGNATIONS = ['CIA', 'CISA', 'CPA', 'CITP', 'BABL'];
const DELIVERY_METHODS = [
  'Live Webinar', 'On-Demand / Self-Study', 'In-Person',
  'Conference', 'University Course', 'Other',
];

function ConfBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.85 ? '#22c55e' : value >= 0.7 ? '#f59e0b' : '#ef4444';
  return <span style={{ color, fontFamily: 'monospace', fontSize: 12 }}>{pct}% confidence</span>;
}

export default function ReviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialResults: any[] = location.state?.results ?? [];

  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [edits, setEdits] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    if (initialResults.length > 0) {
      // Load full staging data for each result
      Promise.all(initialResults.map(r => api.staging.get(r.staging_id)))
        .then(full => {
          setRows(full);
          setSelected(full[0] ?? null);
          setEdits(full[0]?.parsed_data ?? {});
        });
    } else {
      // Navigated directly — load all pending
      api.staging.list().then(data => {
        setRows(data);
        setSelected(data[0] ?? null);
        setEdits(data[0]?.parsed_data ?? {});
      });
    }
  }, []);

  function selectRow(row: any) {
    setSelected(row);
    setEdits(row.parsed_data ?? {});
    setActionMsg('');
  }

  function updateEdit(key: string, val: any) {
    setEdits((e: any) => ({ ...e, [key]: val }));
  }

  function toggleDesignation(d: string) {
    const current: string[] = edits.designations ?? [];
    const next = current.includes(d) ? current.filter(x => x !== d) : [...current, d];
    updateEdit('designations', next);
  }

  async function handleAccept() {
    if (!selected || selected.is_duplicate) return;
    setSaving(true);
    try {
      await api.staging.accept(selected.id, edits);
      setActionMsg('Accepted ✓');
      const updated = rows.map(r =>
        r.id === selected.id ? { ...r, status: 'accepted' } : r
      );
      setRows(updated);
      // Auto-advance to next pending
      const next = updated.find(r => r.id !== selected.id && r.status === 'pending');
      if (next) { setSelected(next); setEdits(next.parsed_data ?? {}); }
    } catch (e: any) {
      setActionMsg(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.staging.reject(selected.id);
      setActionMsg('Rejected');
      const updated = rows.map(r =>
        r.id === selected.id ? { ...r, status: 'rejected' } : r
      );
      setRows(updated);
      const next = updated.find(r => r.id !== selected.id && r.status === 'pending');
      if (next) { setSelected(next); setEdits(next.parsed_data ?? {}); }
    } finally {
      setSaving(false);
    }
  }

  const pending = rows.filter(r => r.status === 'pending');
  const done = rows.filter(r => r.status !== 'pending');

  return (
    <div className="page review-page">
      <div className="review-header">
        <div>
          <span className="eyebrow">Review</span>
          <h1>Staged Records <span className="count-badge">{pending.length} pending</span></h1>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/records')}>
          View Records →
        </button>
      </div>

      <div className="review-layout">
        {/* Left panel */}
        <div className="review-left">
          {pending.length === 0 && done.length === 0 && (
            <div className="empty-state">No staged records. <button className="link-btn" onClick={() => navigate('/')}>Upload certificates</button></div>
          )}

          {pending.length > 0 && (
            <div className="list-section">
              <div className="list-section-label">Pending — {pending.length}</div>
              {pending.map(row => (
                <div
                  key={row.id}
                  className={`list-row ${selected?.id === row.id ? 'active' : ''}`}
                  onClick={() => selectRow(row)}
                >
                  <div className="list-row-date">
                    {row.parsed_data?.completion_date
                      ? row.parsed_data.completion_date.slice(0, 7)
                      : <span className="muted">undated</span>}
                  </div>
                  <div className="list-row-title">{row.parsed_data?.course_title ?? row.original_filename}</div>
                  <div className="list-row-meta">
                    {(row.parsed_data?.designations ?? []).join(' · ')}
                    {row.is_duplicate && <span className="dup-badge">DUP</span>}
                    {row.confidence < 0.7 && <span className="low-badge">LOW</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="list-section">
              <div className="list-section-label muted">Processed — {done.length}</div>
              {done.map(row => (
                <div
                  key={row.id}
                  className={`list-row done ${selected?.id === row.id ? 'active' : ''}`}
                  onClick={() => selectRow(row)}
                >
                  <div className="list-row-date muted">
                    {row.parsed_data?.completion_date?.slice(0, 7) ?? '—'}
                  </div>
                  <div className="list-row-title muted">{row.parsed_data?.course_title ?? row.original_filename}</div>
                  <div className="list-row-meta">
                    <span className={row.status === 'accepted' ? 'status-accepted' : 'status-rejected'}>
                      {row.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        {selected ? (
          <div className="review-right">
            <div className="detail-header">
              <div>
                <div className="detail-filename">{selected.original_filename}</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                  <ConfBadge value={selected.confidence ?? 0} />
                  {selected.is_duplicate && (
                    <span className="dup-banner">
                      Duplicate of "{selected.duplicate_title ?? 'existing record'}" — accept disabled
                    </span>
                  )}
                </div>
              </div>
              {selected.certificate_url && (
                <button
                  className="btn-ghost small"
                  onClick={() => openCertificate('staging', selected.id)}
                >
                  Open Certificate ↗
                </button>
              )}
            </div>

            <div className="detail-fields">
              <Field label="Course Title" lowConf={selected.low_conf_fields?.includes('course_title')}>
                <input className="field-input" value={edits.course_title ?? ''} onChange={e => updateEdit('course_title', e.target.value)} />
              </Field>
              <div className="field-row-2">
                <Field label="Provider" lowConf={selected.low_conf_fields?.includes('provider')}>
                  <input className="field-input" value={edits.provider ?? ''} onChange={e => updateEdit('provider', e.target.value)} />
                </Field>
                <Field label="Completion Date" lowConf={selected.low_conf_fields?.includes('completion_date')}>
                  <input className="field-input" type="date" value={edits.completion_date ?? ''} onChange={e => updateEdit('completion_date', e.target.value)} />
                </Field>
              </div>
              <div className="field-row-2">
                <Field label="Credit Hours" lowConf={selected.low_conf_fields?.includes('credit_hours')}>
                  <input className="field-input" type="number" step="0.5" value={edits.credit_hours ?? ''} onChange={e => updateEdit('credit_hours', parseFloat(e.target.value))} />
                </Field>
                <Field label="Delivery Method">
                  <select className="field-input" value={edits.delivery_method ?? ''} onChange={e => updateEdit('delivery_method', e.target.value)}>
                    <option value="">Select…</option>
                    {DELIVERY_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Applies To" lowConf={selected.low_conf_fields?.includes('designations')}>
                <div className="check-group">
                  {DESIGNATIONS.map(d => (
                    <label key={d} className={`check-chip ${(edits.designations ?? []).includes(d) ? 'active' : ''}`}>
                      <input type="checkbox" checked={(edits.designations ?? []).includes(d)} onChange={() => toggleDesignation(d)} />
                      {d}
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="Verifiable (CPA Ontario)">
                <label className="toggle">
                  <input type="checkbox" checked={edits.is_verifiable ?? true} onChange={e => updateEdit('is_verifiable', e.target.checked)} />
                  <span>{edits.is_verifiable ? 'Verifiable' : 'Non-verifiable'}</span>
                </label>
              </Field>

              <Field label="Notes">
                <textarea className="field-input" rows={2} value={edits.notes ?? ''} onChange={e => updateEdit('notes', e.target.value)} />
              </Field>
            </div>

            <div className="detail-actions">
              {actionMsg && <span className="action-msg">{actionMsg}</span>}
              <button className="btn-reject" onClick={handleReject} disabled={saving}>
                Reject
              </button>
              <button
                className="btn-accept"
                onClick={handleAccept}
                disabled={saving || selected.is_duplicate || selected.status !== 'pending'}
              >
                {saving ? 'Saving…' : 'Accept →'}
              </button>
            </div>
          </div>
        ) : (
          <div className="review-right empty-right">
            <p className="muted">Select a record to review</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, lowConf }: { label: string; children: React.ReactNode; lowConf?: boolean }) {
  return (
    <div className={`field-wrap ${lowConf ? 'low-conf' : ''}`}>
      <label className="field-label">{label}{lowConf && <span className="low-conf-dot" title="Low confidence">⚠</span>}</label>
      {children}
    </div>
  );
}
