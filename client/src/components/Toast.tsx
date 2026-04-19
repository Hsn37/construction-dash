import { createContext, useContext, useState, useCallback, ReactNode, CSSProperties } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (text: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, type: ToastType = 'success') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={containerStyle}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              ...toastStyle,
              background: t.type === 'error' ? 'var(--danger)' : t.type === 'success' ? 'var(--success)' : 'var(--primary)',
            }}
          >
            {t.type === 'success' && <span style={{ marginRight: 6 }}>&#10003;</span>}
            {t.type === 'error' && <span style={{ marginRight: 6 }}>&#10007;</span>}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const containerStyle: CSSProperties = {
  position: 'fixed',
  top: 16,
  right: 16,
  zIndex: 10000,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  pointerEvents: 'none',
};

const toastStyle: CSSProperties = {
  color: '#fff',
  padding: '0.75rem 1.25rem',
  borderRadius: 'var(--radius)',
  fontSize: '0.875rem',
  fontWeight: 500,
  boxShadow: 'var(--shadow-lg)',
  animation: 'slideIn 0.25s ease',
  pointerEvents: 'auto',
};
