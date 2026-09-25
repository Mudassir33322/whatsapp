import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: 'danger' | 'normal';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ConfirmDialog = React.memo(function ConfirmDialog({ open, title, message, confirmText = 'Confirm', confirmVariant = 'danger', onConfirm, onCancel, loading }: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {confirmVariant === 'danger' && (
          <div className="w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>
        )}
        <h3 className="text-lg font-semibold text-white text-center mb-2">{title}</h3>
        <p className="text-sm text-slate-400 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={loading}
            className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
              confirmVariant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}>
            {loading ? 'Please wait...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
});