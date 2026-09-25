import { useState, useEffect, useMemo, useRef } from 'react';
import { Store, Plus, Pencil, Trash2, Key, X, Loader2, Download, Search, ChevronDown } from 'lucide-react';
import { useAdminAuth } from './AdminAuthContext';
import { exportToExcel } from '../utils/export';
import { EmptyState } from '../components/EmptyState';
import SalonLocationFilter from './SalonLocationFilter';
import { useConfirm } from '../hooks/useConfirm';

interface Salon {
  id: number;
  name: string;
  owner_name: string;
  phone: string;
  email: string;
  country: string;
  city: string;
  area: string;
  address: string;
  description: string;
  status: string;
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400',
  inactive: 'bg-rose-500/20 text-rose-400',
  pending: 'bg-amber-500/20 text-amber-400',
};

export function AdminSalons() {
  const { admin, adminFetch } = useAdminAuth();
  const { confirm, confirmDialog } = useConfirm();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ mode: string; salon?: Salon } | null>(null);
  const [pwdModal, setPwdModal] = useState<Salon | null>(null);
  const [saving, setSaving] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salonFilter, setSalonFilter] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterCities, setFilterCities] = useState<{ id: number; name: string }[]>([]);
  const [filterAreas, setFilterAreas] = useState<{ id: number; name: string }[]>([]);
  const [admins, setAdmins] = useState<{ id: number; name: string; email: string; role: string }[]>([]);
  const [countries, setCountries] = useState<{ id: number; name: string }[]>([]);
  const [cities, setCities] = useState<{ id: number; name: string }[]>([]);
  const [areas, setAreas] = useState<{ id: number; name: string }[]>([]);
  const [countrySearch, setCountrySearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [areaSearch, setAreaSearch] = useState('');
  const [countriesLoaded, setCountriesLoaded] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const countryRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingFilterCities, setLoadingFilterCities] = useState(false);
  const [loadingFilterAreas, setLoadingFilterAreas] = useState(false);
  const [locationError, setLocationError] = useState('');
  const isSuperAdmin = admin?.role === 'super_admin';
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: number) => setSelectedIds((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleSelectAll = () => setSelectedIds((prev) => (prev.size === filteredSalons.length ? new Set() : new Set(filteredSalons.map((s) => s.id))));
  const clearSelection = () => setSelectedIds(new Set());
  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await confirm('Delete Selected', `Delete ${selectedIds.size} salon(s)? This action cannot be undone.`, 'Delete');
    if (!confirmed) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map((id) => adminFetch(`/api/admin/salons/${id}`, { method: 'DELETE' })));
      setSelectedIds(new Set());
      await loadSalons();
    } catch (e: any) { setError(e.message); } finally { setBulkDeleting(false); }
  };

  const fetchWithTimeout = async (url: string, init?: RequestInit, ms = 15000): Promise<Response> => {
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), ms);
    const originalSignal = init?.signal;
    if (originalSignal) {
      originalSignal.addEventListener('abort', () => ctrl.abort(), { once: true });
    }
    try {
      const res = await adminFetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  };
  const filteredSalons = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return salons.filter(s => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.owner_name.toLowerCase().includes(q) || s.phone.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchesSalon = !salonFilter || String(s.id) === salonFilter;
      return matchesSearch && matchesStatus && matchesSalon;
    });
  }, [salons, searchTerm, statusFilter, salonFilter]);
  const [form, setForm] = useState({
    name: '', owner_name: '', phone: '', owner_phone: '', email: '', password: '',
    country_id: '', city_id: '', area_id: '', address: '', description: '',
    assigned_admin_id: '',
  });

  const loadSalons = async (signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams();
      if (filterCountry) params.set('country_id', filterCountry);
      if (filterCity) params.set('city_id', filterCity);
      if (filterArea) params.set('area_id', filterArea);
      if (salonFilter) params.set('salon_id', salonFilter);
      const qs = params.toString();
      const res = await adminFetch(`/api/admin/salons${qs ? '?' + qs : ''}`, { signal });
      if (!res.ok) throw new Error('Failed to load salons');
      setSalons(await res.json());
    } catch (e: any) { if (e?.name !== 'AbortError') setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { const ac = new AbortController(); loadSalons(ac.signal); return () => ac.abort(); }, [filterCountry, filterCity, filterArea, salonFilter]);

  useEffect(() => {
    const ac = new AbortController();
    if (filterCountry) {
      setLoadingFilterCities(true);
      setLocationError('');
      fetchWithTimeout(`/api/admin/locations/cities/${filterCountry}`, { signal: ac.signal })
        .then(r => { if (!r.ok) throw new Error('Failed to load cities'); return r.json(); })
        .then(setFilterCities)
        .catch((e) => { if (e?.name !== 'AbortError') setLocationError(e?.message || 'Failed to load cities'); })
        .finally(() => setLoadingFilterCities(false));
      setFilterCity('');
      setFilterArea('');
      setFilterAreas([]);
    } else {
      setFilterCities([]);
      setFilterCity('');
      setFilterArea('');
      setFilterAreas([]);
    }
    return () => ac.abort();
  }, [filterCountry]);

  useEffect(() => {
    const ac = new AbortController();
    if (filterCity) {
      setLoadingFilterAreas(true);
      setLocationError('');
      fetchWithTimeout(`/api/admin/locations/areas/${filterCity}`, { signal: ac.signal })
        .then(r => { if (!r.ok) throw new Error('Failed to load areas'); return r.json(); })
        .then(setFilterAreas)
        .catch((e) => { if (e?.name !== 'AbortError') setLocationError(e?.message || 'Failed to load areas'); })
        .finally(() => setLoadingFilterAreas(false));
      setFilterArea('');
    } else {
      setFilterAreas([]);
      setFilterArea('');
    }
    return () => ac.abort();
  }, [filterCity]);

  useEffect(() => {
    const ac = new AbortController();
    if (!countriesLoaded) {
      adminFetch('/api/admin/locations/countries', { signal: ac.signal }).then(r => r.ok ? r.json() : []).then(c => { setCountries(c); setCountriesLoaded(true); }).catch((err) => {
        if (err?.name === 'AbortError') return;
        console.error('[AdminSalons] Failed to load countries:', err);
      });
    }
    return () => ac.abort();
  }, [countriesLoaded]);

  useEffect(() => {
    const ac = new AbortController();
    if (form.country_id) {
      setLoadingCities(true);
      setLocationError('');
      fetchWithTimeout(`/api/admin/locations/cities/${form.country_id}`, { signal: ac.signal })
        .then(r => { if (!r.ok) throw new Error('Failed to load cities'); return r.json(); })
        .then(setCities)
        .catch((e) => { if (e?.name !== 'AbortError') setLocationError(e?.message || 'Failed to load cities'); })
        .finally(() => setLoadingCities(false));
      setForm(f => ({ ...f, city_id: '', area_id: '' }));
      setAreas([]);
    }
    return () => ac.abort();
  }, [form.country_id]);

  useEffect(() => {
    const ac = new AbortController();
    if (form.city_id) {
      setLoadingAreas(true);
      setLocationError('');
      fetchWithTimeout(`/api/admin/locations/areas/${form.city_id}`, { signal: ac.signal })
        .then(r => { if (!r.ok) throw new Error('Failed to load areas'); return r.json(); })
        .then(setAreas)
        .catch((e) => { if (e?.name !== 'AbortError') setLocationError(e?.message || 'Failed to load areas'); })
        .finally(() => setLoadingAreas(false));
      setForm(f => ({ ...f, area_id: '' }));
    }
    return () => ac.abort();
  }, [form.city_id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) setOpenDropdown(o => o === 'country' ? null : o);
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setOpenDropdown(o => o === 'city' ? null : o);
      if (areaRef.current && !areaRef.current.contains(e.target as Node)) setOpenDropdown(o => o === 'area' ? null : o);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      if (isSuperAdmin) {
        try {
          const res = await adminFetch('/api/admin/admins', { signal: ac.signal });
          if (res.ok) setAdmins(await res.json());
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
          console.error('[AdminSalons] Failed to load admins:', err);
        }
      }
    })();
    return () => ac.abort();
  }, [isSuperAdmin]);

  const openAdd = () => {
    setForm({ name: '', owner_name: '', phone: '', owner_phone: '', email: '', password: '', country_id: '', city_id: '', area_id: '', address: '', description: '', assigned_admin_id: '' });
    setModal({ mode: 'add' });
  };

  const openEdit = (s: Salon & { country_id?: number; city_id?: number; area_id?: number }) => {
    setForm({
      name: s.name, owner_name: s.owner_name, phone: s.phone, owner_phone: (s as any).owner_phone || '', email: s.email, password: '',
      country_id: String(s.country_id || ''), city_id: String(s.city_id || ''), area_id: String(s.area_id || ''),
      address: s.address, description: s.description,
      assigned_admin_id: String((s as any).assigned_admin_id || ''),
    });
    setModal({ mode: 'edit', salon: s });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Salon name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    if (!form.phone.trim()) errs.phone = 'Phone is required';
    if (!form.country_id) errs.country_id = 'Country is required';
    if (!form.city_id) errs.city_id = 'City is required';
    if (!form.area_id) errs.area_id = 'Area is required';
    if (!modal?.mode?.includes('edit') && !form.password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (saving) return;
    if (!validate()) return;
    setSaving(true);
    const isEdit = modal?.mode === 'edit';
    const body: any = { name: form.name.trim(), owner_name: form.owner_name.trim(), phone: form.phone.trim(), owner_phone: form.owner_phone.trim(), email: form.email.trim(), address: form.address.trim(), description: form.description.trim() };
    body.country_id = +form.country_id;
    body.city_id = +form.city_id;
    body.area_id = +form.area_id;
    if (isSuperAdmin && form.assigned_admin_id) body.assigned_admin_id = +form.assigned_admin_id;
    if (!isEdit) body.password = form.password;
    if (isEdit && !modal?.salon?.id) { setSaving(false); return; }
    const salonId = modal?.salon?.id;
    const url = isEdit ? `/api/admin/salons/${salonId}` : '/api/admin/salons';
    try {
      const res = await adminFetch(url, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Failed to save');
      await loadSalons();
      setModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await adminFetch(`/api/admin/salons/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error('Failed to update status');
      setSalons(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    } catch (e: any) { setError(e.message); }
  };

  const resetPassword = async () => {
    if (!pwdModal || !newPwd) return;
    try {
      const res = await adminFetch(`/api/admin/salons/${pwdModal.id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword: newPwd }) });
      if (!res.ok) throw new Error('Failed to reset password');
      setPwdModal(null); setNewPwd('');
    } catch (e: any) { setError(e.message); }
  };

  const del = async (id: number) => {
    const confirmed = await confirm('Delete Salon', 'Are you sure you want to delete this salon? This action cannot be undone.', 'Delete');
    if (!confirmed) return;
    try {
      const res = await adminFetch(`/api/admin/salons/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setSalons(prev => prev.filter(s => s.id !== id));
    } catch (e: any) { setError(e.message); }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700/50 rounded-lg w-32 mb-2" />
          <div className="h-4 bg-slate-700/50 rounded w-56" />
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="h-10 bg-slate-700/50 rounded-xl w-72" />
          <div className="h-10 bg-slate-700/50 rounded-xl w-36" />
          <div className="h-10 bg-slate-700/50 rounded-xl w-36" />
          <div className="h-10 bg-slate-700/50 rounded-xl w-36" />
          <div className="h-10 bg-slate-700/50 rounded-xl w-36" />
        </div>
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden animate-pulse">
          <div className="p-4 border-b border-slate-700">
            <div className="h-4 bg-slate-700 rounded w-full" />
          </div>
          <div className="space-y-2 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="h-4 bg-slate-700 rounded w-28" />
                <div className="h-4 bg-slate-700 rounded w-24" />
                <div className="h-4 bg-slate-700 rounded w-36" />
                <div className="h-4 bg-slate-700 rounded w-28" />
                <div className="h-4 bg-slate-700 rounded w-40" />
                <div className="h-5 bg-slate-700 rounded w-16" />
                <div className="h-4 bg-slate-700 rounded w-12 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-white">Salons</h1><p className="text-sm text-slate-400 mt-1">Manage all registered salons</p></div>
        <div className="flex gap-2">
          {salons.length > 0 && (
            <button type="button" onClick={() => exportToExcel(salons.map(s => ({ Name: s.name, Owner: s.owner_name, Phone: s.phone, Email: s.email, Country: s.country, City: s.city, Area: s.area, Address: s.address, Status: s.status })), 'Salons_Export', 'Salons')} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors"><Download className="w-4 h-4" /> Excel</button>
          )}
          <button type="button" onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> Add Salon</button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 text-rose-400 rounded-xl text-sm">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by name, owner, phone or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
        <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-auto sm:min-w-[140px]">
          <option value="">All Countries</option>
          {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterCity} onChange={e => setFilterCity(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-auto sm:min-w-[140px] disabled:opacity-50" disabled={!filterCountry}>
          <option value="">All Cities</option>
          {filterCities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterArea} onChange={e => setFilterArea(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-auto sm:min-w-[140px] disabled:opacity-50" disabled={!filterCity}>
          <option value="">All Areas</option>
          {filterAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <SalonLocationFilter
          salonFilter={salonFilter}
          setSalonFilter={setSalonFilter}
          salons={salons}
          adminFetch={adminFetch}
        />
        {searchTerm && <span className="text-xs text-slate-500">{filteredSalons.length} of {salons.length}</span>}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-indigo-600/15 border border-indigo-500/30 rounded-xl">
          <span className="text-sm text-indigo-200 font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={clearSelection} className="px-3 py-1.5 text-sm text-slate-300 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">Clear</button>
            <button type="button" onClick={bulkDelete} disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              <Trash2 className="w-4 h-4" /> {bulkDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 w-10">
                  <input type="checkbox" checked={filteredSalons.length > 0 && selectedIds.size === filteredSalons.length} onChange={toggleSelectAll}
                    className="w-4 h-4 rounded cursor-pointer accent-indigo-500" />
                </th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Bookings</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredSalons.length === 0 ? (
                <tr><td colSpan={9}><div className="px-6 py-8"><EmptyState icon={Store} title={salons.length === 0 ? 'No salons yet' : 'No salons match your search'} description={salons.length === 0 ? 'Add your first salon to get started' : 'Try adjusting your search terms'} /></div></td></tr>
              ) : filteredSalons.map(s => (
                <tr key={s.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-3 py-3.5">
                    <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} className="w-4 h-4 rounded cursor-pointer accent-indigo-500" />
                  </td>
                  <td className="px-5 py-3.5 font-medium text-white whitespace-nowrap">{s.name}</td>
                  <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">{s.owner_name}</td>
                  <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">{s.email}</td>
                  <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">{s.phone}</td>
                  <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">{s.country}, {s.city}, {s.area}</td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <select value={s.status} onChange={e => updateStatus(s.id, e.target.value)} className={`text-xs font-medium rounded-full px-2.5 py-0.5 border-0 cursor-pointer appearance-none ${statusColors[s.status] || 'bg-slate-500/20 text-slate-400'}`}>
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                      <option value="pending">pending</option>
                    </select>
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-300 whitespace-nowrap">-</td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg"><Pencil className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setPwdModal(s)} className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg"><Key className="w-4 h-4" /></button>
                      <button type="button" onClick={() => del(s.id)} className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{modal.mode === 'edit' ? 'Edit Salon' : 'Add Salon'}</h2>
              <button type="button" onClick={() => setModal(null)} className="p-1 text-slate-400 hover:text-white rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            {locationError && <div className="mb-4 p-3 bg-amber-500/10 text-amber-400 rounded-xl text-xs border border-amber-500/20">{locationError}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Salon Name *</label>
                <input placeholder="Salon Name" value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(e => ({ ...e, name: '' })); }} className={`w-full px-3 py-2 bg-slate-700 border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-rose-500' : 'border-slate-600'}`} />
                {errors.name && <p className="text-rose-400 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Owner Name</label>
                <input placeholder="Owner Name" value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Phone *</label>
                <input placeholder="Phone" value={form.phone} onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(e => ({ ...e, phone: '' })); }} className={`w-full px-3 py-2 bg-slate-700 border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.phone ? 'border-rose-500' : 'border-slate-600'}`} />
                {errors.phone && <p className="text-rose-400 text-xs mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Owner Phone</label>
                <input placeholder="Owner Phone" value={form.owner_phone} onChange={e => setForm(f => ({ ...f, owner_phone: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Email *</label>
                <input placeholder="Email" value={form.email} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(e => ({ ...e, email: '' })); }} className={`w-full px-3 py-2 bg-slate-700 border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.email ? 'border-rose-500' : 'border-slate-600'}`} />
                {errors.email && <p className="text-rose-400 text-xs mt-1">{errors.email}</p>}
              </div>
              {!modal.mode?.includes('edit') && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Password *</label>
                  <input placeholder="Password" type="password" value={form.password} onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(e => ({ ...e, password: '' })); }} className={`w-full px-3 py-2 bg-slate-700 border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.password ? 'border-rose-500' : 'border-slate-600'}`} />
                  {errors.password && <p className="text-rose-400 text-xs mt-1">{errors.password}</p>}
                </div>
              )}

              {/* Country */}
              <div className="col-span-2" ref={countryRef}>
                <label className="block text-sm font-medium text-slate-300 mb-1">Country *</label>
                <div className="relative">
                  <div onClick={() => { setOpenDropdown(openDropdown === 'country' ? null : 'country'); setCountrySearch(''); }} className={`w-full px-3 py-2 bg-slate-700 border rounded-lg text-sm text-white cursor-pointer flex items-center justify-between ${errors.country_id ? 'border-rose-500' : 'border-slate-600'}`}>
                    <span className={form.country_id && countries.find(c => c.id === +form.country_id) ? 'text-white' : 'text-slate-400'}>{form.country_id ? countries.find(c => c.id === +form.country_id)?.name || 'Select Country' : 'Select Country'}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                  {openDropdown === 'country' && (
                    <div className="absolute z-50 mt-1 w-full bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      <div className="sticky top-0 bg-slate-700 p-1">
                        <input autoFocus placeholder="Search country..." value={countrySearch} onChange={e => setCountrySearch(e.target.value)} className="w-full px-2 py-1.5 bg-slate-600 rounded text-sm text-white placeholder-slate-400 outline-none" />
                      </div>
                      {countries.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())).map(c => (
                        <div key={c.id} onClick={() => { setForm(f => ({ ...f, country_id: String(c.id) })); setErrors(e => ({ ...e, country_id: '' })); setOpenDropdown(null); }} className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-500/20 ${form.country_id === String(c.id) ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-200'}`}>{c.name}</div>
                      ))}
                      {countries.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())).length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No countries found</div>}
                    </div>
                  )}
                </div>
                {errors.country_id && <p className="text-rose-400 text-xs mt-1">{errors.country_id}</p>}
              </div>

              {/* City */}
              <div className="col-span-2" ref={cityRef}>
                <label className="block text-sm font-medium text-slate-300 mb-1">City *</label>
                <div className="relative">
                  <div onClick={() => { if (!form.country_id) return; setOpenDropdown(openDropdown === 'city' ? null : 'city'); setCitySearch(''); }} className={`w-full px-3 py-2 bg-slate-700 border rounded-lg text-sm text-white cursor-pointer flex items-center justify-between ${errors.city_id ? 'border-rose-500' : 'border-slate-600'} ${!form.country_id ? 'opacity-50' : ''}`}>
                    <span className={form.city_id && cities.find(c => c.id === +form.city_id) ? 'text-white' : 'text-slate-400'}>{form.city_id ? cities.find(c => c.id === +form.city_id)?.name || 'Select City' : form.country_id ? 'Select City' : 'Select country first'}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                  {openDropdown === 'city' && form.country_id && (
                    <div className="absolute z-50 mt-1 w-full bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      <div className="sticky top-0 bg-slate-700 p-1">
                        <input autoFocus placeholder="Search city..." value={citySearch} onChange={e => setCitySearch(e.target.value)} className="w-full px-2 py-1.5 bg-slate-600 rounded text-sm text-white placeholder-slate-400 outline-none" />
                      </div>
                      {loadingCities ? (
                        <div className="px-3 py-3 text-center text-slate-400 text-xs">Loading cities...</div>
                      ) : cities.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase())).map(c => (
                        <div key={c.id} onClick={() => { setForm(f => ({ ...f, city_id: String(c.id) })); setErrors(e => ({ ...e, city_id: '' })); setOpenDropdown(null); }} className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-500/20 ${form.city_id === String(c.id) ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-200'}`}>{c.name}</div>
                      ))}
                      {!loadingCities && cities.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase())).length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No cities found</div>}
                    </div>
                  )}
                </div>
                {errors.city_id && <p className="text-rose-400 text-xs mt-1">{errors.city_id}</p>}
              </div>

              {/* Area */}
              <div className="col-span-2" ref={areaRef}>
                <label className="block text-sm font-medium text-slate-300 mb-1">Area *</label>
                <div className="relative">
                  <div onClick={() => { if (!form.city_id) return; setOpenDropdown(openDropdown === 'area' ? null : 'area'); setAreaSearch(''); }} className={`w-full px-3 py-2 bg-slate-700 border rounded-lg text-sm text-white cursor-pointer flex items-center justify-between ${errors.area_id ? 'border-rose-500' : 'border-slate-600'} ${!form.city_id ? 'opacity-50' : ''}`}>
                    <span className={form.area_id && areas.find(a => a.id === +form.area_id) ? 'text-white' : 'text-slate-400'}>{form.area_id ? areas.find(a => a.id === +form.area_id)?.name || 'Select Area' : form.city_id ? 'Select Area' : 'Select city first'}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                  {openDropdown === 'area' && form.city_id && (
                    <div className="absolute z-50 mt-1 w-full bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      <div className="sticky top-0 bg-slate-700 p-1">
                        <input autoFocus placeholder="Search area..." value={areaSearch} onChange={e => setAreaSearch(e.target.value)} className="w-full px-2 py-1.5 bg-slate-600 rounded text-sm text-white placeholder-slate-400 outline-none" />
                      </div>
                      {loadingAreas ? (
                        <div className="px-3 py-3 text-center text-slate-400 text-xs">Loading areas...</div>
                      ) : areas.filter(a => a.name.toLowerCase().includes(areaSearch.toLowerCase())).map(a => (
                        <div key={a.id} onClick={() => { setForm(f => ({ ...f, area_id: String(a.id) })); setErrors(e => ({ ...e, area_id: '' })); setOpenDropdown(null); }} className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-500/20 ${form.area_id === String(a.id) ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-200'}`}>{a.name}</div>
                      ))}
                      {!loadingAreas && areas.filter(a => a.name.toLowerCase().includes(areaSearch.toLowerCase())).length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No areas found</div>}
                    </div>
                  )}
                </div>
                {errors.area_id && <p className="text-rose-400 text-xs mt-1">{errors.area_id}</p>}
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Address</label>
                <input placeholder="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {isSuperAdmin && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Assign Admin</label>
                  <select value={form.assigned_admin_id} onChange={e => setForm(f => ({ ...f, assigned_admin_id: e.target.value }))} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Assign Admin (optional)</option>
                    {admins.filter(a => a.role === 'admin' || a.role === 'support').map(a => <option key={a.id} value={a.id}>{a.name} ({a.email})</option>)}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setModal(null)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium">Cancel</button>
              <button type="button" onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {pwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPwdModal(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Reset Password</h2>
              <button type="button" onClick={() => setPwdModal(null)} className="p-1 text-slate-400 hover:text-white rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Enter new password" className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setPwdModal(null)} className="flex-1 px-4 py-2.5 border border-slate-600 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700 transition-all">Cancel</button>
                <button type="button" onClick={resetPassword} disabled={!newPwd} className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium">Reset</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}