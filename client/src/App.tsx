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

function AuthModal({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      localStorage.setItem('auth_token', password.trim());
      onAuth();
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
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [hasAuth, setHasAuth] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) setHasAuth(true);
  }, []);

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
