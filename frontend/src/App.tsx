import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import './index.css';
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
  );
}
