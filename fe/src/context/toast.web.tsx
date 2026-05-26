// @refresh reset
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ToastItem, type ToastType } from '@/components/ui/Toast';

interface ToastData {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastPortal({ toasts, dismiss }: { toasts: ToastData[]; dismiss: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 64,
        left: 16,
        right: 16,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem {...t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>,
    document.body
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success', title?: string) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type, title }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastPortal toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
