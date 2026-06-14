import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, openCertificate } from '../lib/api';

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (id) api.records.get(id).then(r => { setRecord(r); setEdits(r); });
  }, [id]);

  function updateEdit(key: string, val: any) {
    setEdits((e: any) => ({ ...e, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.records.update(id!, edits);
      setRecord({ ...record, ...edits });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!record) return <div className="page"><div className="loading-state">Loading…</div></div>;

  return (
    <div className="page detail-page">
      <div className="detail-nav">
        <button className="link-btn" onClick={() => navigate('/records')}>← Records</button>
        {saved && <span className="saved-flash">Saved ✓</span>}
      </div>

      <div className="detail-top">
        <div>
          <span className="eyebrow">{record.provider}</span>
          <h1>{record.course_title}</h1>
          <div className="desig-chips" style={{ marginTop: 8 }}>
            {(record.designations ?? []).map((d: any) => (
              <span key={d.designation} className="desig-chip large">{d.designation}</span>
            ))}
          </div>
        </div>
        <div className="detail-top-actions">
          {record.certificate_url && (
            <button
              className="btn-ghost"
              onClick={() => openCertificate('record', record.id)}
            >
              Open Certificate ↗
            </button>
          )}
          {!editing && (
            <button className="btn-primary small" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <DetailField label="Completion Date">
          {editing
            ? <input className="field-input" type="date" value={edits.completion_date ?? ''} onChange={e => updateEdit('completion_date', e.target.value)} />
            : <span>{record.completion_date ? new Date(record.completion_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</span>
          }
        </DetailField>

        <DetailField label="Credit Hours">
          {editing
            ? <input className="field-input" type="number" step="0.5" value={edits.credit_hours ?? ''} onChange={e => updateEdit('credit_hours', parseFloat(e.target.value))} />
            : <span className="big-number">{record.credit_hours} <span className="big-number-unit">hrs</span></span>
          }
        </DetailField>

        <DetailField label="Delivery Method">
          {editing
            ? <select className="field-input" value={edits.delivery_method ?? ''} onChange={e => updateEdit('delivery_method', e.target.value)}>
                {['Live Webinar','On-Demand / Self-Study','In-Person','Conference','University Course','Other'].map(m => <option key={m}>{m}</option>)}
              </select>
            : <span>{record.delivery_method ?? '—'}</span>
          }
        </DetailField>

        <DetailField label="Verifiable (CPA Ontario)">
          {editing
            ? <label className="toggle">
                <input type="checkbox" checked={edits.is_verifiable ?? true} onChange={e => updateEdit('is_verifiable', e.target.checked)} />
                <span>{edits.is_verifiable ? 'Verifiable' : 'Non-verifiable'}</span>
              </label>
            : <span className={record.is_verifiable ? 'ver-yes' : 'ver-no'}>{record.is_verifiable ? 'Verifiable' : 'Non-verifiable'}</span>
          }
        </DetailField>

        <DetailField label="Original Filename" span={2}>
          <span className="mono">{record.original_filename ?? '—'}</span>
        </DetailField>

        {record.notes && (
          <DetailField label="Notes" span={2}>
            {editing
              ? <textarea className="field-input" rows={3} value={edits.notes ?? ''} onChange={e => updateEdit('notes', e.target.value)} />
              : <span>{record.notes}</span>
            }
          </DetailField>
        )}
      </div>

      {/* Designation breakdown */}
      {record.designations?.length > 0 && (
        <div className="desig-section">
          <h2 className="section-title">Designation Breakdown</h2>
          <div className="desig-breakdown">
            {record.designations.map((d: any) => (
              <div key={d.designation} className="desig-row">
                <span className="desig-chip large">{d.designation}</span>
                <span className="desig-category">{d.category ?? 'Uncategorized'}</span>
                <span className="desig-hours">{d.hours_claimed} hrs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <div className="edit-actions">
          <button className="btn-ghost" onClick={() => { setEditing(false); setEdits(record); }}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      <div className="record-meta">
        <span>Logged {new Date(record.created_at).toLocaleDateString()}</span>
        {record.confidence && <span className="sep">·</span>}
        {record.confidence && <span>Parsed at {Math.round(record.confidence * 100)}% confidence</span>}
      </div>
    </div>
  );
}

function DetailField({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className="detail-field" style={span ? { gridColumn: `span ${span}` } : {}}>
      <div className="detail-field-label">{label}</div>
      <div className="detail-field-value">{children}</div>
    </div>
  );
}
