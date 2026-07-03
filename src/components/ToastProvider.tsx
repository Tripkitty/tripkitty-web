import { createContext, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

export type ToastType = 'error' | 'success' | 'info';

type ToastItem = { id: number; type: ToastType; message: string; leaving: boolean };

type ToastValue = {
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
};

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastValue | null>(null);

const SHOW_MS = 4000;
const LEAVE_MS = 250;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    // Сначала помечаем leaving для анимации ухода, удаляем после её окончания.
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), LEAVE_MS);
  }, []);

  const show = useCallback(
    (message: string, type: ToastType) => {
      const id = nextId.current++;
      setToasts((ts) => [...ts, { id, type, message, leaving: false }]);
      setTimeout(() => dismiss(id), SHOW_MS);
    },
    [dismiss],
  );

  const value = useMemo<ToastValue>(
    () => ({
      error: (m: string) => show(m, 'error'),
      success: (m: string) => show(m, 'success'),
      info: (m: string) => show(m, 'info'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={'toast ' + t.type + (t.leaving ? ' leaving' : '')}
            onClick={() => dismiss(t.id)}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
