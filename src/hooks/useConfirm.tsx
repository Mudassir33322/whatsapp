import { useState, useCallback, useRef } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: 'danger' | 'normal';
  asyncAction?: () => Promise<void>;
}

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const [loading, setLoading] = useState(false);

  const confirm = useCallback((title: string, message: string, confirmText?: string, confirmVariant: 'danger' | 'normal' = 'danger', asyncAction?: () => Promise<void>) => {
    return new Promise<boolean>((resolve) => {
      setOptions({ title, message, confirmText, confirmVariant, asyncAction });
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    try {
      if (options?.asyncAction) {
        setLoading(true);
        await options.asyncAction();
      }
    } finally {
      resolveRef.current?.(true);
      setLoading(false);
      setOptions(null);
      resolveRef.current = null;
    }
  }, [options]);

  const handleConfirmAsync = useCallback(async (action: () => Promise<void>) => {
    return new Promise<boolean>((resolve) => {
      setLoading(true);
      setOptions(prev => prev ? { ...prev, asyncAction: async () => { await action(); resolve(true); } } : null);
      resolveRef.current = () => resolve(false);
    });
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    setLoading(false);
    setOptions(null);
    resolveRef.current = null;
  }, []);

  const confirmDialog = options ? (
    <ConfirmDialog
      open
      title={options.title}
      message={options.message}
      confirmText={options.confirmText}
      confirmVariant={options.confirmVariant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      loading={loading}
    />
  ) : null;

  return { confirm, confirmDialog, setLoading, handleConfirmAsync };
}
