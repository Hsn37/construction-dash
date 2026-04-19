import { CSSProperties } from 'react';

const spinnerStyle: CSSProperties = {
  display: 'inline-block',
  width: 32,
  height: 32,
  border: '3px solid var(--border)',
  borderTopColor: 'var(--primary)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const wrapperStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '3rem',
};

export default function LoadingSpinner() {
  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={wrapperStyle}>
        <div style={spinnerStyle} />
      </div>
    </>
  );
}
