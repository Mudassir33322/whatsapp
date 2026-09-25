import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton = React.memo(function Skeleton({ className = '', variant = 'rectangular', width, height }: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-slate-200/70';
  
  const variantClasses = {
    text: 'rounded-md h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };

  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1rem' : '100%'),
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
});

export const CardSkeleton = React.memo(function CardSkeleton() {
  return (
    <div className="bg-white/80 rounded-2xl border border-slate-100 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="80%" />
    </div>
  );
});

export const TableRowSkeleton = React.memo(function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-slate-50">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton variant="text" width={i === 0 ? '80%' : '60%'} />
        </td>
      ))}
    </tr>
  );
});

export const DashboardCardSkeleton = React.memo(function DashboardCardSkeleton() {
  return (
    <div className="bg-white/80 rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
      <Skeleton variant="rectangular" width={48} height={48} className="rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="70%" />
        <Skeleton variant="text" width="40%" height={24} />
      </div>
    </div>
  );
});
