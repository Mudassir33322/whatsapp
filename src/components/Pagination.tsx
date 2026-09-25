import React from 'react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination = React.memo(function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const pages = getPageNumbers();
  const btnBase = 'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const pgBase = 'w-8 h-8 rounded-lg text-sm font-medium transition-colors';

  return (
    <div className="flex items-center justify-center gap-1">
      <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
        className={`${btnBase} text-slate-500 hover:text-slate-700 hover:bg-slate-100`}>
        Previous
      </button>

      {pages[0] > 1 && (
        <>
          <button onClick={() => onPageChange(1)}
            className={`${pgBase} text-slate-500 hover:text-slate-700 hover:bg-slate-100`}>1</button>
          {pages[0] > 2 && <span className="w-8 h-8 flex items-center justify-center text-sm text-slate-400">...</span>}
        </>
      )}

      {pages.map(p => (
        <button key={p} onClick={() => onPageChange(p)}
          className={`${pgBase} ${p === page ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
          {p}
        </button>
      ))}

      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && <span className="w-8 h-8 flex items-center justify-center text-sm text-slate-400">...</span>}
          <button onClick={() => onPageChange(totalPages)}
            className={`${pgBase} text-slate-500 hover:text-slate-700 hover:bg-slate-100`}>{totalPages}</button>
        </>
      )}

      <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages}
        className={`${btnBase} text-slate-500 hover:text-slate-700 hover:bg-slate-100`}>
        Next
      </button>
    </div>
  );
});
