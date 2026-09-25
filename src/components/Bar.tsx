import React from 'react';

interface BarProps {
  value: number;
  max: number;
  label?: string;
  display?: string;
  color?: string;
  className?: string;
}

export const Bar = React.memo(function Bar({ value, max, label, display, color, className = '' }: BarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className={className}>
      {(label || display !== undefined) && (
        <div className="flex items-center justify-between text-xs mb-1">
          {label && <span className="text-slate-400 truncate">{label}</span>}
          <span className="text-slate-300 font-medium shrink-0 ml-2">{display !== undefined ? display : value}</span>
        </div>
      )}
      <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color || 'var(--color-primary, #6366f1)' }}
        />
      </div>
    </div>
  );
});
