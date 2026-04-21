import { NavLink, Outlet } from 'react-router-dom';
import { CSSProperties, useState } from 'react';
import { useRole } from '../App';

const allNavLinks = [
  { to: '/', label: 'Dashboard', adminOnly: false },
  { to: '/entries', label: 'Entries', adminOnly: false },
  { to: '/saleem', label: 'Saleem Sahab Ledger', adminOnly: false },
  { to: '/add', label: 'Add Entry', adminOnly: true },
  { to: '/categories', label: 'Categories', adminOnly: true },
  { to: '/upload', label: 'Upload', adminOnly: true },
];

export default function Layout() {
  const role = useRole();
  const navLinks = allNavLinks.filter((l) => !l.adminOnly || role === 'admin');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @media (min-width: 769px) {
          .nav-links { display: flex !important; position: static !important; background: none !important; border: none !important; box-shadow: none !important; padding: 0 !important; flex-direction: row !important; }
          .nav-hamburger { display: none !important; }
        }
      `}</style>
      <nav style={navStyle}>
        <div style={navInnerStyle}>
          <span style={logoStyle}>
            <img src="/logo.svg" alt="" style={{ width: 28, height: 28, verticalAlign: 'middle', marginRight: '0.5rem' }} />
            Construction Tracker
          </span>
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            style={hamburgerStyle}
            aria-label="Menu"
          >
            {menuOpen ? '\u2715' : '\u2630'}
          </button>
          <div
            className="nav-links"
            style={{
              ...linksStyle,
              ...(menuOpen ? mobileLinksOpen : mobileLinksHidden),
            }}
          >
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setMenuOpen(false)}
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
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  minHeight: 56,
};

const logoStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: '1.125rem',
  color: 'var(--primary)',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const hamburgerStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '1.5rem',
  cursor: 'pointer',
  color: 'var(--text)',
  padding: '0.25rem',
};

const linksStyle: CSSProperties = {
  gap: '0.25rem',
  alignItems: 'center',
};

const mobileLinksHidden: CSSProperties = {
  display: 'none',
};

const mobileLinksOpen: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  padding: '0.5rem 0',
  gap: '0.25rem',
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
