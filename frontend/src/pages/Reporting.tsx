import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const TARGETS: Record<string, { annual: number; verifiable?: number; cycle: string }> = {
  CIA:  { annual: 40, cycle: 'Annual · 40 hrs' },
  CISA: { annual: 20, cycle: 'Annual · 20 hrs (120 over 3 yrs)' },
  CPA:  { annual: 20, verifiable: 10, cycle: 'Annual · 20 hrs (10 verifiable, 4 ethics over 3 yrs)' },
  CITP: { annual: 20, cycle: 'Annual · 20 hrs' },
  BABL: { annual: 20, cycle: 'Annual · 20 hrs' },
};

const CURRENT_YEAR = new Date().getFullYear();

function ProgressBar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = Math.min(100, (value / target) * 100);
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function ReportingPage() {
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(CURRENT_YEAR);

  useEffect(() => {
    api.records.summary().then(data => {
      setSummary(data);
      setLoading(false);
    });
  }, []);

  const years = [...new Set(summary.map(r => r.year))].sort((a, b) => b - a);
  const designations = [...new Set(summary.map(r => r.designation))].sort();

  function getRow(designation: string, y: number) {
    return summary.find(r => r.designation === designation && r.year === y);
  }

  if (loading) return <div className="page"><div className="loading-state">Loading…</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <span className="eyebrow">Reporting</span>
        <h1>CPE Compliance</h1>
        <p className="sub">Hours by designation and year. Targets based on official renewal requirements.</p>
      </div>

      {/* Year selector */}
      <div className="year-tabs">
        {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => (
          <button
            key={y}
            className={`year-tab ${year === y ? 'active' : ''}`}
            onClick={() => setYear(y)}
          >
            {y}{y === CURRENT_YEAR && ' ·'}
          </button>
        ))}
      </div>

      {/* Compliance cards */}
      <div className="compliance-grid">
        {designations.map(desig => {
          const row = getRow(desig, year);
          const target = TARGETS[desig];
          if (!target) return null;

          const total = Number(row?.total_hours ?? 0);
          const verifiable = Number(row?.verifiable_hours ?? 0);
          const courses = row?.course_count ?? 0;
          const isCurrentYear = year === CURRENT_YEAR;

          const totalMet = total >= target.annual;
          const verMet = !target.verifiable || verifiable >= target.verifiable;
          const onTrack = totalMet && verMet;

          const statusColor = !row ? '#334155'
            : onTrack ? '#22c55e'
            : '#f59e0b';

          return (
            <div key={desig} className="compliance-card">
              <div className="card-top">
                <div className="desig-name">{desig}</div>
                {isCurrentYear && (
                  <div className="status-dot" style={{ background: statusColor }}
                    title={onTrack ? 'On track' : row ? 'In progress' : 'No records'} />
                )}
              </div>

              <div className="card-cycle">{target.cycle}</div>

              <div className="metric-row">
                <span className="metric-label">Total hours</span>
                <span className="metric-value">{total.toFixed(1)} / {target.annual}</span>
              </div>
              <ProgressBar value={total} target={target.annual}
                color={totalMet ? '#22c55e' : '#6366f1'} />

              {target.verifiable && (
                <>
                  <div className="metric-row" style={{ marginTop: 8 }}>
                    <span className="metric-label">Verifiable</span>
                    <span className="metric-value">{verifiable.toFixed(1)} / {target.verifiable}</span>
                  </div>
                  <ProgressBar value={verifiable} target={target.verifiable}
                    color={verMet ? '#22c55e' : '#f59e0b'} />
                </>
              )}

              <div className="card-footer">
                {courses} course{courses !== 1 ? 's' : ''} logged
              </div>
            </div>
          );
        })}
      </div>

      {/* Year-over-year table */}
      {years.length > 0 && (
        <div className="yoy-section">
          <h2 className="section-title">Year-over-Year</h2>
          <div className="table-wrap">
            <table className="cpe-table">
              <thead>
                <tr>
                  <th>Year</th>
                  {designations.map(d => <th key={d}>{d}</th>)}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => {
                  const rowTotal = designations.reduce((sum, d) => {
                    const r = getRow(d, y);
                    // avoid double-counting shared hours — show per-designation
                    return sum;
                  }, 0);
                  // For total, sum unique records in that year
                  const yearTotal = summary
                    .filter(r => r.year === y)
                    .reduce((max, r) => Math.max(max, Number(r.total_hours)), 0);

                  return (
                    <tr key={y}>
                      <td className="year-cell">{y}{y === CURRENT_YEAR && <span className="current-tag">current</span>}</td>
                      {designations.map(d => {
                        const r = getRow(d, y);
                        const hrs = Number(r?.total_hours ?? 0);
                        const t = TARGETS[d]?.annual ?? 20;
                        return (
                          <td key={d} className={hrs >= t ? 'met' : hrs > 0 ? 'partial' : 'empty'}>
                            {hrs > 0 ? `${hrs.toFixed(1)} hrs` : '—'}
                          </td>
                        );
                      })}
                      <td>{summary.filter(r => r.year === y).length > 0
                        ? `${summary.filter(r => r.year === y).reduce((s, r) => s + Number(r.total_hours), 0).toFixed(1)} hrs`
                        : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
