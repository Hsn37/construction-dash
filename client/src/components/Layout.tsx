import { NavLink, Outlet } from 'react-router-dom';
import { CSSProperties } from 'react';

const navLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/entries', label: 'Entries' },
  { to: '/saleem', label: 'Saleem Ledger' },
  { to: '/add', label: 'Add Entry' },
  { to: '/categories', label: 'Categories' },
  { to: '/upload', label: 'Upload' },
];

export default function Layout() {
  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <nav style={navStyle}>
        <div style={navInnerStyle}>
          <span style={logoStyle}>Construction Tracker</span>
          <div style={linksStyle}>
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                style={({ isActive }) => ({
                  ...linkStyle,
                  ...(isActive ? activeLinkStyle : {}),
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
      <main style={mainStyle}>
        <div className="container">
          <Outlet />
        </div>
      </main>
    </>
  );
}

const navStyle: CSSProperties = {
  background: '#fff',
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 0,
  zIndex: 100,
  boxShadow: 'var(--shadow-sm)',
};

const navInnerStyle: CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: '0 1rem',
  display: 'flex',
  alignItems: 'center',
  gap: '2rem',
  height: 56,
  overflowX: 'auto',
};

const logoStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: '1.125rem',
  color: 'var(--primary)',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const linksStyle: CSSProperties = {
  display: 'flex',
  gap: '0.25rem',
  alignItems: 'center',
};

const linkStyle: CSSProperties = {
  padding: '0.375rem 0.75rem',
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  textDecoration: 'none',
  borderRadius: 'var(--radius-sm)',
  transition: 'all 0.15s ease',
  whiteSpace: 'nowrap',
};

const activeLinkStyle: CSSProperties = {
  background: 'var(--primary-light)',
  color: 'var(--primary)',
};

const mainStyle: CSSProperties = {
  padding: '1.5rem 0 3rem',
};
