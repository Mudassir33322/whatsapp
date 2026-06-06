import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { Save } from 'lucide-react';

export function WorkingHoursManager({ salonId }: { salonId: string }) {
  const [hours, setHours] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHours = async () => {
    if (salonId === 'all') return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/working-hours?salonId=${salonId}`);
      const data = await res.json();
      setHours(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchHours(); }, [salonId]);

  const updateHour = (index: number, field: string, value: any) => {
    const newHours = [...hours];
    newHours[index][field] = value;
    setHours(newHours);
  };

  const saveHours = async () => {
    try {
      await fetch(`${API_URL}/api/settings/working-hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salonId, hours })
      });
      alert('Working hours updated!');
    } catch (err) { console.error(err); }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-xl font-bold mb-6">Manage Working Hours</h2>
      <div className="space-y-4">
        {hours.map((h, index) => (
          <div key={h.day} className="grid grid-cols-4 items-center gap-4 p-3 border rounded-xl">
            <span className="font-bold">{h.day}</span>
            <input type="time" value={h.start_time} onChange={e => updateHour(index, 'start_time', e.target.value)} className="p-2 border rounded-lg" />
            <input type="time" value={h.end_time} onChange={e => updateHour(index, 'end_time', e.target.value)} className="p-2 border rounded-lg" />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!h.is_open} onChange={e => updateHour(index, 'is_open', e.target.checked)} />
              Open
            </label>
          </div>
        ))}
        <button onClick={saveHours} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold w-full justify-center mt-4">
          <Save size={18} /> Save Schedule
        </button>
      </div>
    </div>
  );
}
