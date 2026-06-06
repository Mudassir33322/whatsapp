import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';

export function SalonProfile() {
  const [salons, setSalons] = useState<any[]>([]);
  const [selectedSalon, setSelectedSalon] = useState<any>(null);
  const [formData, setFormData] = useState({
    description: '',
    portfolio_url: '',
    rating: 5.0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/salons`)
      .then(res => res.json())
      .then(data => setSalons(data));
  }, []);

  useEffect(() => {
    if (selectedSalon) {
      setFormData({
        description: selectedSalon.description || '',
        portfolio_url: selectedSalon.portfolio_url || '',
        rating: selectedSalon.rating || 5.0
      });
    }
  }, [selectedSalon]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/salons/${selectedSalon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      alert('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update profile');
    }
    setLoading(false);
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-xl font-bold mb-6">Manage Salon Profile</h2>
      
      <div className="mb-6">
        <label className="block text-sm font-bold text-slate-700 mb-2">Select Salon</label>
        <select 
          className="w-full p-3 rounded-xl border border-slate-200"
          onChange={(e) => setSelectedSalon(salons.find(s => s.id === Number(e.target.value)))}
        >
          <option value="">Select a salon...</option>
          {salons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {selectedSalon && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700">Description</label>
            <textarea 
              className="w-full p-3 rounded-xl border border-slate-200"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700">Portfolio URL (Instagram/Gallery)</label>
            <input 
              type="url"
              className="w-full p-3 rounded-xl border border-slate-200"
              value={formData.portfolio_url}
              onChange={e => setFormData({...formData, portfolio_url: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700">Rating (1-5)</label>
            <input 
              type="number" 
              step="0.1" 
              min="1" 
              max="5"
              className="w-full p-3 rounded-xl border border-slate-200"
              value={formData.rating}
              onChange={e => setFormData({...formData, rating: Number(e.target.value)})}
            />
          </div>
          <button 
            type="submit" 
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      )}
    </div>
  );
}
