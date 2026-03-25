import { useCallback, useEffect, useRef, useState } from 'react';
import type { Toast } from '../types';

export const getToastDurationMs = (type: Toast['type']): number =>
  type === 'success' ? 4000 : 7000;

export const useToastQueue = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimeoutsRef = useRef<Map<number, number>>(new Map());
  const nextToastIdRef = useRef(1);

  const clearToastTimeout = useCallback((id: number) => {
    const timeoutId = toastTimeoutsRef.current.get(id);
    if (typeof timeoutId === 'number') {
      window.clearTimeout(timeoutId);
      toastTimeoutsRef.current.delete(id);
    }
  }, []);

  const clearAllToastTimeouts = useCallback(() => {
    toastTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    toastTimeoutsRef.current.clear();
  }, []);

  const removeToast = useCallback((id: number) => {
    clearToastTimeout(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, [clearToastTimeout]);

  const clearToasts = useCallback(() => {
    clearAllToastTimeouts();
    setToasts([]);
  }, [clearAllToastTimeouts]);

  const addToast = useCallback((type: Toast['type'], title: string, message: string) => {
    const id = nextToastIdRef.current++;

    setToasts((prev) => [...prev, { id, type, title, message }]);

    const timeoutId = window.setTimeout(() => {
      toastTimeoutsRef.current.delete(id);
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, getToastDurationMs(type));

    toastTimeoutsRef.current.set(id, timeoutId);
  }, []);

  useEffect(() => () => {
    clearAllToastTimeouts();
  }, [clearAllToastTimeouts]);

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
  };
};
