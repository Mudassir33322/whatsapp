import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState = React.memo(function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
          <Icon className="w-6 h-6 text-slate-400" />
        </div>
      )}
      <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
      {description && <p className="text-xs text-slate-400 max-w-sm">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
});
