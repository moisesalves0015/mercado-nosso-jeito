import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: {
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.35)',
    icon: '✓',
    text: '#10b981',
  },
  error: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.35)',
    icon: '✕',
    text: '#ef4444',
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.35)',
    icon: '⚠',
    text: '#f59e0b',
  },
  info: {
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.35)',
    icon: 'ℹ',
    text: '#3b82f6',
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    if (timeouts.current[id]) {
      clearTimeout(timeouts.current[id]);
      delete timeouts.current[id];
    }
  }, []);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const duration = toast.duration ?? 4000;
    setToasts(prev => [...prev.slice(-4), { ...toast, id }]); // max 5 toasts
    timeouts.current[id] = setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const success = useCallback((title: string, message?: string) =>
    showToast({ type: 'success', title, message }), [showToast]);
  const error = useCallback((title: string, message?: string) =>
    showToast({ type: 'error', title, message, duration: 6000 }), [showToast]);
  const warning = useCallback((title: string, message?: string) =>
    showToast({ type: 'warning', title, message }), [showToast]);
  const info = useCallback((title: string, message?: string) =>
    showToast({ type: 'info', title, message }), [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(110%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes toastFadeOut {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(110%); }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
        .toast-item {
          animation: toastSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          pointer-events: auto;
        }
        .toast-close-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          opacity: 0.5;
          transition: opacity 0.2s;
          line-height: 1;
          font-size: 14px;
          flex-shrink: 0;
        }
        .toast-close-btn:hover { opacity: 1; }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '16px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '360px',
          width: 'calc(100vw - 32px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(toast => {
          const colors = TOAST_COLORS[toast.type];
          const duration = toast.duration ?? 4000;
          return (
            <div
              key={toast.id}
              className="toast-item"
              style={{
                background: 'rgba(10, 15, 30, 0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${colors.border}`,
                borderRadius: '14px',
                padding: '14px 16px',
                boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)`,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Progress bar */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '2px',
                  background: colors.text,
                  opacity: 0.5,
                  animation: `toastProgress ${duration}ms linear forwards`,
                }}
              />
              {/* Content */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colors.text,
                    fontWeight: 800,
                    fontSize: '14px',
                    flexShrink: 0,
                    marginTop: '1px',
                  }}
                >
                  {colors.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                    {toast.title}
                  </div>
                  {toast.message && (
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '3px', lineHeight: 1.4 }}>
                      {toast.message}
                    </div>
                  )}
                </div>
                <button
                  className="toast-close-btn"
                  onClick={() => onRemove(toast.id)}
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
