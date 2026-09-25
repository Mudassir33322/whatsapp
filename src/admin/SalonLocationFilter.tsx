import { useState, useEffect } from 'react';
import { API_URL } from '../config';

export default function SalonLocationFilter({
  salonFilter, setSalonFilter, salons: propSalons, setSalons, adminFetch,
}: {
  salonFilter: string;
  setSalonFilter: (v: string) => void;
  salons?: any[];
  setSalons?: (salons: any[]) => void;
  adminFetch?: (url: string, opts?: any) => Promise<Response>;
}) {
  const [internalSalons, setInternalSalons] = useState<any[]>([]);
  const fetcher = adminFetch ? adminFetch : ((url: string, opts?: any) => fetch(API_URL + url, { ...opts, credentials: 'include' }));

  useEffect(() => {
    const ac = new AbortController();
    fetcher('/api/admin/salons', { signal: ac.signal })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!ac.signal.aborted) { setInternalSalons(data); if (setSalons) setSalons(data); } })
      .catch((e: any) => { if (e?.name !== 'AbortError') console.error('[SalonLocationFilter] Failed to load salons:', e); });
    return () => ac.abort();
  }, []);

  const displaySalons = propSalons && propSalons.length > 0 ? propSalons : internalSalons;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={salonFilter} onChange={e => setSalonFilter(e.target.value)}
        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]">
        <option value="">All Salons</option>
        {displaySalons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  );
}