import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';

export function AddSalon({ onAdded }: { onAdded: () => void }) {
  const [formData, setFormData] = useState({ 
    name: '', 
    owner_phone: '', 
    country_id: 1,  // Default to Pakistan
    city_id: 1,     // Default to Karachi
    area_id: null,
    address: '',
    description: '',
    established_year: new Date().getFullYear()
  });
  const [countries, setCountries] = useState([]);
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(true);

  useEffect(() => {
    // Load countries
    fetch(`${API_URL}/api/locations/countries`)
      .then(res => res.json())
      .then(data => setCountries(data))
      .catch(err => console.error('Failed to load countries:', err));
  }, []);

  useEffect(() => {
    // Load cities when country changes
    if (formData.country_id) {
      fetch(`${API_URL}/api/locations/cities/${formData.country_id}`)
        .then(res => res.json())
        .then(data => setCities(data))
        .catch(err => console.error('Failed to load cities:', err));
    }
  }, [formData.country_id]);

  useEffect(() => {
    // Load areas when city changes
    if (formData.city_id) {
      fetch(`${API_URL}/api/locations/areas/${formData.city_id}`)
        .then(res => res.json())
        .then(data => setAreas(data))
        .catch(err => console.error('Failed to load areas:', err));
    }
  }, [formData.city_id]);

  useEffect(() => {
    const initLocations = async () => {
      try {
        const countriesRes = await fetch(`${API_URL}/api/locations/countries`);
        const countriesData = await countriesRes.json();
        setCountries(countriesData);

        const pakistan = countriesData.find((c: any) => c.code === 'PK');
        if (pakistan) {
          setFormData(prev => ({...prev, country_id: pakistan.id}));
          const citiesRes = await fetch(`${API_URL}/api/locations/cities/${pakistan.id}`);
          const citiesData = await citiesRes.json();
          setCities(citiesData);

          const karachi = citiesData.find((c: any) => c.name.toLowerCase() === 'karachi');
          if (karachi) {
            setFormData(prev => ({...prev, city_id: karachi.id}));
            const areasRes = await fetch(`${API_URL}/api/locations/areas/${karachi.id}`);
            const areasData = await areasRes.json();
            setAreas(areasData);
          }
        }
        setLoadingLocations(false);
      } catch (err) {
        console.error('Failed to initialize locations:', err);
        setLoadingLocations(false);
      }
    };
    initLocations();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/salons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      alert('Salon added successfully!');
      onAdded();
    } catch (err) {
      console.error(err);
      alert('Failed to add salon');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200 space-y-6">
      <h2 className="text-xl font-bold">Add New Salon</h2>
      
      {/* Location Section */}
      <div className="space-y-4">
        <div className="bg-slate-50 p-4 rounded-xl">
          <h3 className="font-semibold mb-2">Location</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
              <select
                value={formData.country_id}
                onChange={(e) => setFormData({...formData, country_id: Number(e.target.value), city_id: 1, area_id: null})}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                disabled={loadingLocations}
              >
                <option value="">Select Country</option>
                {countries.map(country => (
                  <option key={country.id} value={country.id}>
                    {country.name} {country.code === 'PK' && '(Default)'}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <select
                value={formData.city_id}
                onChange={(e) => setFormData({...formData, city_id: Number(e.target.value), area_id: null})}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                disabled={loadingLocations || !formData.country_id}
              >
                <option value="">Select City</option>
                {cities.map(city => (
                  <option key={city.id} value={city.id}>
                    {city.name} {city.name.toLowerCase() === 'karachi' && '(Default)'}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Area</label>
              <select
                value={formData.area_id || ''}
                onChange={(e) => setFormData({...formData, area_id: e.target.value ? Number(e.target.value) : null})}
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                disabled={loadingLocations || !formData.city_id}
              >
                <option value="">Select Area</option>
                {areas.map(area => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
      
      {/* Salon Details */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Salon Name</label>
          <input 
            type="text" 
            placeholder="Salon Name" 
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500" 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            required 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Owner Phone</label>
          <input 
            type="tel" 
            placeholder="Owner Phone (e.g. 923001234567)" 
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500" 
            onChange={e => setFormData({...formData, owner_phone: e.target.value})} 
            required 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Established Year</label>
          <input 
            type="number" 
            placeholder="Established Year" 
            min="1900" 
            max={new Date().getFullYear()}
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500" 
            onChange={e => setFormData({...formData, established_year: e.target.value ? Number(e.target.value) : undefined})} 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
          <input 
            type="text" 
            placeholder="Full Address" 
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500" 
            onChange={e => setFormData({...formData, address: e.target.value})} 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea 
            placeholder="Describe your salon..." 
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500" 
            onChange={e => setFormData({...formData, description: e.target.value})} 
          />
        </div>
      </div>
      
      <button 
        type="submit" 
        className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
        disabled={loading}
      >
        {loading ? 'Adding Salon...' : 'Add Salon'}
      </button>
    </form>
  );
}
