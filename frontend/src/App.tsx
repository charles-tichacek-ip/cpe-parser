import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import './index.css';
import { PASS_KEY } from './lib/api';

const API = import.meta.env.VITE_API_URL ?? '';

function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(!!sessionStorage.getItem(PASS_KEY));
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  if (unlocked) return <>{children}</>;

  async function attempt() {
    setChecking(true);
    try {
      const res = await fetch(`${API}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: input }),
      });
      if (res.ok) {
        sessionStorage.setItem(PASS_KEY, input);
        setUnlocked(true);
      } else {
        setError(true);
        setInput('');
      }
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '40px 48px', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 300 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--indigo)' }}>CPE Parser</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>Enter password</div>
        <input
          className="field-input"
          type="password"
          value={input}
          onChange={e => { setInput(e.target.value); setError(false); }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          autoFocus
          placeholder="Password"
        />
        {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>Incorrect password</div>}
        <button className="btn-primary" onClick={attempt} disabled={checking}>{checking ? 'Checking…' : 'Unlock'}</button>
      </div>
    </div>
  );
}
import UploadPage from './pages/Upload';
import ReviewPage from './pages/Review';
import RecordsPage from './pages/Records';
import ReportingPage from './pages/Reporting';
import DetailPage from './pages/Detail';

function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">CPE Parser</div>
        <div className="sidebar-logo-name">Certificate Log</div>
        <div className="sidebar-logo-tagline">Parse · Process · Prioritize</div>
      </div>
      <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">⬆</span> Upload
      </NavLink>
      <NavLink to="/review" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">◎</span> Review
      </NavLink>
      <NavLink to="/records" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">▤</span> Records
      </NavLink>
      <NavLink to="/reporting" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">◈</span> Reporting
      </NavLink>
    </nav>
  );
}

export default function App() {
  return (
    <PasswordGate>
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/records/:id" element={<DetailPage />} />
            <Route path="/reporting" element={<ReportingPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
    </PasswordGate>
  );
}
