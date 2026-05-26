import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal, View } from 'react-native';
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
      <Modal
        transparent
        visible={toasts.length > 0}
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View style={{ flex: 1 }} pointerEvents="box-none">
          <View style={{ position: 'absolute', top: 64, left: 16, right: 16 }}>
            {toasts.map(t => (
              <ToastItem key={t.id} {...t} onDismiss={() => dismiss(t.id)} />
            ))}
          </View>
        </View>
      </Modal>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
