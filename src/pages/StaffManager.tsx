import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { Trash2, UserPlus, Save, X } from 'lucide-react';

export function StaffManager({ salonId }: { salonId: string }) {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', role: 'Barber', salary_type: 'fixed', base_salary: 0, commission_rate: 0 });

  const fetchStaff = async () => {
    if (salonId === 'all') return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/staff?salonId=${salonId}`);
      const data = await res.json();
      setStaff(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchStaff(); }, [salonId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/api/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, salonId })
      });
      setIsFormOpen(false);
      fetchStaff();
    } catch (err) { console.error(err); }
  };

  const deleteStaff = async (id: number) => {
    if (!confirm('Are you sure?')) return;
    try {
      await fetch(`${API_URL}/api/staff/${id}`, { method: 'DELETE' });
      fetchStaff();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Manage Staff</h2>
        <button onClick={() => setIsFormOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold">
          <UserPlus size={16} /> Add Staff
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-4">
          <input type="text" placeholder="Name" className="p-2 rounded-lg border" onChange={e => setFormData({...formData, name: e.target.value})} />
          <input type="text" placeholder="Role" className="p-2 rounded-lg border" onChange={e => setFormData({...formData, role: e.target.value})} />
          <select className="p-2 rounded-lg border" onChange={e => setFormData({...formData, salary_type: e.target.value})}>
            <option value="fixed">Fixed</option>
            <option value="commission">Commission</option>
          </select>
          <input type="number" placeholder="Salary/Rate" className="p-2 rounded-lg border" onChange={e => setFormData({...formData, base_salary: Number(e.target.value)})} />
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold">Save</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {staff.map(s => (
          <div key={s.id} className="flex justify-between items-center p-3 border rounded-xl">
            <div>
              <p className="font-bold">{s.name}</p>
              <p className="text-sm text-slate-500">{s.role} • {s.salary_type}</p>
            </div>
            <button onClick={() => deleteStaff(s.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
