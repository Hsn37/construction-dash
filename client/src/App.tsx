import { Routes, Route } from 'react-router-dom';
import { useState, useEffect, CSSProperties } from 'react';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import Dashboard from './pages/Dashboard';
import Entries from './pages/Entries';
import SaleemLedger from './pages/SaleemLedger';
import AddEntry from './pages/AddEntry';
import Categories from './pages/Categories';
import ImageUpload from './pages/ImageUpload';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function validateToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/categories`, {
      headers: { 'X-Auth-Token': token },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function AuthModal({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) return;

    setError('');
    setLoading(true);

    const valid = await validateToken(trimmed);

    if (valid) {
      localStorage.setItem('auth_token', trimmed);
      onAuth();
    } else {
      setError('Invalid token. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>Authentication Required</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Enter the access token to continue.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter access token"
            autoFocus
            style={{ marginBottom: '1rem' }}
          />
          {error && (
            <p style={{ color: 'var(--danger, #e53e3e)', fontSize: '0.875rem', marginBottom: '1rem', marginTop: '-0.5rem' }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Validating...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [hasAuth, setHasAuth] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setChecking(false);
      return;
    }
    validateToken(token).then((valid) => {
      if (valid) {
        setHasAuth(true);
      } else {
        localStorage.removeItem('auth_token');
      }
      setChecking(false);
    });
  }, []);

  if (checking) return null;

  if (!hasAuth) {
    return <AuthModal onAuth={() => setHasAuth(true)} />;
  }

  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/entries" element={<Entries />} />
          <Route path="/saleem" element={<SaleemLedger />} />
          <Route path="/add" element={<AddEntry />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/upload" element={<ImageUpload />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const modalStyle: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 'var(--radius-lg)',
  padding: '2rem',
  width: '100%',
  maxWidth: 400,
  boxShadow: 'var(--shadow-lg)',
};
