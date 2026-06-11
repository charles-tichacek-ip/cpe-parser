import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const DESIGNATIONS = ['CIA', 'CISA', 'CPA', 'CITP', 'BABL'];
const CURRENT_YEAR = new Date().getFullYear();

export default function RecordsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterDesig, setFilterDesig] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterVerifiable, setFilterVerifiable] = useState('');
  const [downloading, setDownloading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.records.list().then(data => {
      setRecords(data);
      setLoading(false);
    });
  }, []);

  const years = [...new Set(
    records
      .map(r => r.completion_date?.slice(0, 4))
      .filter(Boolean)
  )].sort((a, b) => Number(b) - Number(a));

  const filtered = records.filter(r => {
    if (filterDesig && !r.designations?.some((d: any) => d.designation === filterDesig)) return false;
    if (filterYear && r.completion_date?.slice(0, 4) !== filterYear) return false;
    if (filterVerifiable === 'yes' && !r.is_verifiable) return false;
    if (filterVerifiable === 'no' && r.is_verifiable) return false;
    return true;
  });

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(r => r.id)));
    }
  }

  async function handleDownloadZip() {
    if (selected.size === 0) return;
    setDownloading(true);
    try {
      const ids = [...selected];
      const res = await fetch('/api/records/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cpe-certificates-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDownloading(false);
    }
  }

  function handleExportCSV() {
    const rows = filtered.map(r => [
      r.completion_date ?? '',
      r.provider ?? '',
      r.course_title ?? '',
      r.credit_hours ?? '',
      r.delivery_method ?? '',
      (r.designations ?? []).map((d: any) => d.designation).join('|'),
      r.is_verifiable ? 'Yes' : 'No',
      r.notes ?? '',
    ]);
    const header = 'Date,Provider,Course,Hours,Method,Designations,Verifiable,Notes';
    const csv = [header, ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cpe-records-${CURRENT_YEAR}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="page"><div className="loading-state">Loading records…</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Records</span>
          <h1>CPE Log <span className="count-badge">{records.length} total</span></h1>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={handleExportCSV}>Export CSV</button>
          <button
            className={`btn-primary small ${selected.size === 0 ? 'disabled' : ''}`}
            onClick={handleDownloadZip}
            disabled={selected.size === 0 || downloading}
          >
            {downloading ? 'Zipping…' : `Download ZIP (${selected.size})`}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select className="filter-select" value={filterDesig} onChange={e => setFilterDesig(e.target.value)}>
          <option value="">All designations</option>
          {DESIGNATIONS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="filter-select" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          <option value="">All years</option>
          {years.map(y => <option key={y}>{y}</option>)}
        </select>
        <select className="filter-select" value={filterVerifiable} onChange={e => setFilterVerifiable(e.target.value)}>
          <option value="">Verifiable &amp; non</option>
          <option value="yes">Verifiable only</option>
          <option value="no">Non-verifiable only</option>
        </select>
        <span className="filter-count">{filtered.length} shown</span>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="records-table">
          <thead>
            <tr>
              <th className="check-col">
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                />
              </th>
              <th>Date</th>
              <th>Course</th>
              <th>Provider</th>
              <th>Hours</th>
              <th>Designations</th>
              <th>Verifiable</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="empty-row">No records match your filters</td></tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} className={selected.has(r.id) ? 'row-selected' : ''}>
                <td className="check-col">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleSelect(r.id)}
                  />
                </td>
                <td className="date-cell">
                  {r.completion_date
                    ? new Date(r.completion_date).toLocaleDateString('en-CA', { year: 'numeric', month: 'short' })
                    : <span className="muted">—</span>}
                </td>
                <td className="title-cell">{r.course_title}</td>
                <td className="provider-cell">{r.provider}</td>
                <td className="hours-cell">{r.credit_hours}</td>
                <td>
                  <div className="desig-chips">
                    {(r.designations ?? []).map((d: any) => (
                      <span key={d.designation} className="desig-chip">{d.designation}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={r.is_verifiable ? 'ver-yes' : 'ver-no'}>
                    {r.is_verifiable ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>
                  <button className="link-btn" onClick={() => navigate(`/records/${r.id}`)}>
                    View →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals footer */}
      {filtered.length > 0 && (
        <div className="totals-bar">
          <span>{filtered.reduce((s, r) => s + Number(r.credit_hours ?? 0), 0).toFixed(1)} total hours</span>
          <span className="sep">·</span>
          <span>{filtered.filter(r => r.is_verifiable).reduce((s, r) => s + Number(r.credit_hours ?? 0), 0).toFixed(1)} verifiable</span>
        </div>
      )}
    </div>
  );
}
