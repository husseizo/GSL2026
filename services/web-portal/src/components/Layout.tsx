import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={{ width: 220, borderRight: '1px solid #ddd', padding: 16 }}>
        <h2 style={{ fontSize: 16 }}>AIOS Portal</h2>
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 24 }}>
          <li><NavLink to="/" end style={navStyle}>Executive Dashboard</NavLink></li>
          <li><NavLink to="/branches" style={navStyle}>Branch Dashboard</NavLink></li>
          <li><NavLink to="/users" style={navStyle}>User Management</NavLink></li>
          <li><NavLink to="/system-health" style={navStyle}>System Health</NavLink></li>
        </ul>
        <h2 style={{ fontSize: 14, marginTop: 24, color: '#666' }}>Knowledge Platform</h2>
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
          <li><NavLink to="/knowledge/sources" style={navStyle}>Source Registry</NavLink></li>
          <li><NavLink to="/knowledge/ingestion-runs" style={navStyle}>Ingestion Runs</NavLink></li>
          <li><NavLink to="/knowledge/quarantine" style={navStyle}>Quarantine Queue</NavLink></li>
          <li><NavLink to="/knowledge/documents" style={navStyle}>Document Viewer</NavLink></li>
          <li><NavLink to="/knowledge/claims" style={navStyle}>Candidate Claims</NavLink></li>
          <li><NavLink to="/knowledge/structured-facts" style={navStyle}>Structured Facts</NavLink></li>
          <li><NavLink to="/knowledge/conflicts" style={navStyle}>Conflict Queue</NavLink></li>
          <li><NavLink to="/knowledge/approvals" style={navStyle}>Approval Queue</NavLink></li>
          <li><NavLink to="/knowledge/search" style={navStyle}>Published Knowledge Search</NavLink></li>
          <li><NavLink to="/knowledge/snapshot" style={navStyle}>Snapshot Status</NavLink></li>
          <li><NavLink to="/knowledge/evaluation-results" style={navStyle}>Evaluation Results</NavLink></li>
          <li><NavLink to="/knowledge/audit" style={navStyle}>Audit History</NavLink></li>
        </ul>
        <button onClick={handleLogout} style={{ marginTop: 32 }}>Log out</button>
      </nav>
      <main style={{ flex: 1, padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}

const navStyle = ({ isActive }: { isActive: boolean }) => ({
  display: 'block',
  padding: '8px 0',
  textDecoration: 'none',
  color: isActive ? '#0066cc' : '#333',
  fontWeight: isActive ? 600 : 400,
});
