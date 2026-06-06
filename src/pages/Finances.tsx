import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  Plus, 
  Loader2, 
  AlertCircle,
  Search,
  ShoppingCart,
  PieChart as PieIcon,
  Filter,
  Trash2,
  Edit3,
  CheckCircle,
  X,
  FileText,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { API_URL } from '../config';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  minStock: number;
  unit: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
}

interface Revenue {
    id: string;
    bookingId: string;
    amount: number;
    date: string;
}

export function Finances() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ revenue: 0, expenses: 0, profit: 0 });
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'catalog' | 'expenses' | 'revenue' | 'history' | 'reports'>('overview');
  const [catalogTab, setCatalogTab] = useState<'services' | 'products'>('services');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'service' | 'product' | 'expense'>('service');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    price: '',
    duration: '',
    stock: '',
    minStock: '',
    unit: 'pcs',
    description: '',
    amount: '',
    category: 'Supplies'
  });

  const openAddModal = (type: 'service' | 'product' | 'expense') => {
    setEditingId(null);
    setFormData({ id: '', name: '', price: '', duration: '', stock: '', minStock: '', unit: 'pcs', description: '', amount: '', category: 'Supplies' });
    setModalType(type);
    setIsModalOpen(true);
  };

  const openEditModal = (type: 'service' | 'product' | 'expense', item: any) => {
    setEditingId(item.id);
    setModalType(type);
    setFormData({
      id: item.id,
      name: item.name || '',
      price: String(item.price || ''),
      duration: String(item.duration || ''),
      stock: String(item.stock || ''),
      minStock: String(item.minStock || ''),
      unit: item.unit || 'pcs',
      description: item.description || '',
      amount: String(item.amount || ''),
      category: item.category || 'Supplies'
    });
    setIsModalOpen(true);
  };


  const fetchData = async (signal?: AbortSignal) => {
    try {
      const [finRes, servRes, prodRes, expRes, revRes] = await Promise.all([
        fetch(`${API_URL}/api/finances`, { signal }),
        fetch(`${API_URL}/api/services`, { signal }),
        fetch(`${API_URL}/api/products`, { signal }),
        fetch(`${API_URL}/api/expenses`, { signal }),
        fetch(`${API_URL}/api/revenue`, { signal })
      ]);
      
      if (signal?.aborted) return;
      
      if (!finRes.ok || !servRes.ok || !prodRes.ok || !expRes.ok || !revRes.ok) {
         throw new Error('API request failed');
      }

      const data = await Promise.all([
        finRes.json(),
        servRes.json(),
        prodRes.json(),
        expRes.json(),
        revRes.json()
      ]);

      setSummary(data[0]);
      setServices(data[1]);
      setProducts(data[2]);
      setExpenses(data[3]);
      setRevenues(data[4]);
      setLoading(false);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to fetch data', err);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = `${API_URL}/api/${modalType}s`;
    const isEdit = !!editingId;
    const body = modalType === 'service'
      ? { id: formData.id, name: formData.name, price: Number(formData.price), duration: Number(formData.duration) }
      : modalType === 'product'
      ? { id: formData.id, name: formData.name, price: Number(formData.price), stock: Number(formData.stock), minStock: Number(formData.minStock), unit: formData.unit }
      : { description: formData.description, amount: Number(formData.amount), category: formData.category, date: new Date().toISOString() };

    try {
      if (isEdit && modalType === 'expense') {
        // Expenses: delete old + add new (no PUT endpoint)
        await fetch(`${API_URL}/api/expenses/${editingId}`, { method: 'DELETE' });
        await fetch(`${API_URL}/api/expenses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else {
        await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      setIsModalOpen(false);
      setEditingId(null);
      fetchData();
    } catch (err) {
      console.error('Failed to save data', err);
    }
  };


  const handleDelete = async (type: string, id: string) => {
    let endpoint = 'expenses';
    if (type === 'service') endpoint = 'services';
    else if (type === 'product') endpoint = 'products';
    else if (type === 'revenue' || type === 'income') endpoint = 'revenue';
    
    if (!confirm(`Delete this ${type}?`)) return;
    try {
      await fetch(`${API_URL}/api/${endpoint}/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleSellProduct = async (product: Product) => {
    const qty = prompt(`How many ${product.name} sold?`, '1');
    if (!qty || isNaN(Number(qty))) return;
    
    try {
      // 1. Update stock
      await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...product, stock: product.stock - Number(qty) })
      });
      
      // 2. Add revenue
      await fetch(`${API_URL}/api/revenue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bookingId: 'SALE', 
          amount: product.price * Number(qty), 
          date: new Date().toISOString() 
        })
      });
      
      fetchData();
      alert('Sale recorded successfully!');
    } catch (err) {
      console.error('Sale failed', err);
    }
  };

  // Group by month
  const getMonthlyStats = () => {
      const stats: Record<string, { revenue: number, expenses: number }> = {};
      
      revenues.forEach(r => {
          const m = format(parseISO(r.date), 'MMMM yyyy');
          if (!stats[m]) stats[m] = { revenue: 0, expenses: 0 };
          stats[m].revenue += r.amount;
      });

      expenses.forEach(e => {
          const m = format(parseISO(e.date), 'MMMM yyyy');
          if (!stats[m]) stats[m] = { revenue: 0, expenses: 0 };
          stats[m].expenses += e.amount;
      });

      return Object.entries(stats).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Finance & Catalog</h2>
          <p className="text-slate-500 mt-1">Manage services, products, and financial health.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => openAddModal('service')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
          <button 
            onClick={() => openAddModal('product')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-bold shadow-sm"
          >
            <Package className="w-4 h-4" />
            Add Product
          </button>
          <button 
            onClick={() => openAddModal('expense')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-black transition-all font-bold shadow-lg"
          >
            <TrendingDown className="w-4 h-4" />
            New Expense
          </button>
        </div>

      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-16 h-16 text-emerald-600" />
          </div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Total Revenue</p>
          <h3 className="text-4xl font-black text-slate-900 mt-2">Rs. {summary.revenue.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
            <TrendingDown className="w-16 h-16 text-rose-600" />
          </div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Expenses</p>
          <h3 className="text-4xl font-black text-slate-900 mt-2">Rs. {summary.expenses.toLocaleString()}</h3>
        </div>

        <div className="bg-indigo-600 p-8 rounded-[32px] shadow-2xl shadow-indigo-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform text-white">
            <DollarSign className="w-16 h-16" />
          </div>
          <p className="text-xs font-black text-indigo-200 uppercase tracking-[0.2em]">Net Profit</p>
          <h3 className="text-4xl font-black text-white mt-2">Rs. {summary.profit.toLocaleString()}</h3>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-50 px-4">
          {['overview', 'catalog', 'expenses', 'revenue', 'history', 'reports'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-8 py-6 text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab === 'revenue' ? 'Income' : tab === 'history' ? 'Ledger' : tab}
              {activeTab === tab && <motion.div layoutId="tab-active" className="absolute bottom-0 left-8 right-8 h-1 bg-indigo-600 rounded-t-full" />}
            </button>
          ))}
        </div>

        <div className="p-10">
          {activeTab === 'catalog' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-2xl w-fit">
                <button 
                  onClick={() => setCatalogTab('services')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${catalogTab === 'services' ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100/50' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Services Offered
                </button>
                <button 
                  onClick={() => setCatalogTab('products')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${catalogTab === 'products' ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100/50' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Product Inventory
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {catalogTab === 'services' ? (
                  services.map(s => (
                    <div key={s.id} className="p-6 bg-slate-50 border border-slate-100 rounded-[32px] group hover:border-indigo-200 transition-all">
                       <div className="flex justify-between items-start mb-6">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                             <ShoppingCart className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div className="flex gap-1">
                             <button onClick={() => openEditModal('service', s)} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><Edit3 className="w-4 h-4" /></button>
                             <button onClick={() => handleDelete('service', s.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors"><Trash2 className="w-5 h-5" /></button>
                          </div>
                       </div>
                       <h4 className="text-xl font-bold text-slate-900">{s.name}</h4>
                       <div className="mt-4 flex items-center justify-between">
                          <p className="text-2xl font-black text-slate-900">Rs. {s.price}</p>
                          <span className="text-xs font-bold text-slate-400 uppercase">{s.duration} mins</span>
                       </div>
                    </div>
                  ))

                ) : (
                  products.map(p => (
                    <div key={p.id} className="p-6 bg-slate-50 border border-slate-100 rounded-[32px] group hover:border-indigo-200 transition-all">
                       <div className="flex justify-between items-start mb-6">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                             <Package className="w-6 h-6 text-emerald-600" />
                          </div>
                          <div className="flex gap-1">
                             <button onClick={() => handleSellProduct(p)} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100">Sell</button>
                             <button onClick={() => openEditModal('product', p)} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><Edit3 className="w-4 h-4" /></button>
                             <button onClick={() => handleDelete('product', p.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors"><Trash2 className="w-5 h-5" /></button>
                          </div>
                       </div>
                       <h4 className="text-xl font-bold text-slate-900">{p.name}</h4>
                       <div className="mt-4 flex items-center justify-between">
                          <p className="text-2xl font-black text-slate-900">Rs. {p.price}</p>
                          <div className="text-right">
                             <p className="text-sm font-bold text-slate-900">{p.stock} <span className="text-xs text-slate-400">{p.unit}</span></p>
                             {p.stock <= p.minStock && <p className="text-[9px] font-black text-rose-500 uppercase">Low Stock</p>}
                          </div>
                       </div>
                    </div>
                  ))

                )}
                
                <button 
                  onClick={() => { setModalType(catalogTab === 'services' ? 'service' : 'product'); setIsModalOpen(true); }}
                  className="p-6 border-2 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center text-slate-300 hover:text-indigo-600 hover:border-indigo-200 transition-all group"
                >
                   <Plus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                   <span className="text-sm font-bold">Add New {catalogTab === 'services' ? 'Service' : 'Product'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-slate-50">
                    <th className="pb-6 text-xs font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="pb-6 text-xs font-black text-slate-400 uppercase tracking-widest">Description</th>
                    <th className="pb-6 text-xs font-black text-slate-400 uppercase tracking-widest">Category</th>
                    <th className="pb-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                    <th className="pb-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>

                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {expenses.map(exp => (
                    <tr key={exp.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-6 text-sm font-bold text-slate-500">{new Date(exp.date).toLocaleDateString()}</td>
                      <td className="py-6 text-sm font-bold text-slate-900">{exp.description}</td>
                      <td className="py-6">
                        <span className="px-4 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-full">{exp.category}</span>
                      </td>
                      <td className="py-6 text-sm font-black text-slate-900 text-right">Rs. {exp.amount.toLocaleString()}</td>
                      <td className="py-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditModal('expense', exp)} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete('expense', exp.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}

          {activeTab === 'revenue' && (
            <div className="overflow-x-auto">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold">Income History</h3>
                <p className="text-xs text-slate-400 font-bold uppercase">Showing all received payments</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-slate-50">
                    <th className="pb-6 text-xs font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="pb-6 text-xs font-black text-slate-400 uppercase tracking-widest">Source</th>
                    <th className="pb-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                    <th className="pb-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {revenues.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(rev => (
                    <tr key={rev.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-6 text-sm font-bold text-slate-500">{new Date(rev.date).toLocaleDateString()}</td>
                      <td className="py-6 text-sm font-bold text-slate-900">{rev.bookingId === 'SALE' ? 'Product Sale' : 'Service Booking'}</td>
                      <td className="py-6 text-sm font-black text-emerald-600 text-right">Rs. {rev.amount.toLocaleString()}</td>
                      <td className="py-6 text-right">
                        <button onClick={() => handleDelete('revenue', rev.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">Detailed Audit Ledger</h3>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg border border-emerald-100 uppercase">Income</span>
                  <span className="px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-black rounded-lg border border-rose-100 uppercase">Expense</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-slate-100">
                      <th className="pb-4 text-xs font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
                      <th className="pb-4 text-xs font-black text-slate-400 uppercase tracking-widest">Description</th>
                      <th className="pb-4 text-xs font-black text-slate-400 uppercase tracking-widest">Category</th>
                      <th className="pb-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                      <th className="pb-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {[
                      ...revenues.map(r => ({ ...r, type: 'income', desc: r.bookingId === 'SALE' ? 'Product Sale' : 'Service Booking' })),
                      ...expenses.map(e => ({ ...e, type: 'expense', desc: e.description }))
                    ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item: any) => (
                      <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-5 text-sm font-bold text-slate-500">
                          {format(parseISO(item.date), 'dd MMM, hh:mm a')}
                        </td>
                        <td className="py-5 text-sm font-bold text-slate-900">{item.desc}</td>
                        <td className="py-5">
                          <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${item.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {item.category || item.type}
                          </span>
                        </td>
                        <td className={`py-5 text-sm font-black text-right ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.type === 'income' ? '+' : '-'} Rs. {item.amount.toLocaleString()}
                        </td>
                        <td className="py-5 text-right">
                          <button onClick={() => handleDelete(item.type === 'income' ? 'revenue' : 'expense', item.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-12">
               <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                     <FileText className="w-6 h-6 text-indigo-600" />
                     <h3 className="text-2xl font-bold text-slate-900">Monthly Performance Report</h3>
                  </div>
                  <button
                    onClick={() => {
                      const rows = [
                        ['Date', 'Description', 'Category', 'Type', 'Amount (Rs)'],
                        ...revenues.map(r => [new Date(r.date).toLocaleDateString(), r.bookingId === 'SALE' ? 'Product Sale' : 'Service Booking', 'Income', 'Income', r.amount]),
                        ...expenses.map(e => [new Date(e.date).toLocaleDateString(), e.description, e.category, 'Expense', e.amount])
                      ];
                      const csv = rows.map(r => r.join(',')).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url;
                      a.download = `autozap-report-${new Date().toISOString().split('T')[0]}.csv`;
                      a.click(); URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                  >
                    <Calendar className="w-4 h-4" />
                    Download CSV
                  </button>
               </div>
               
               <div className="grid grid-cols-1 gap-8">
                  {getMonthlyStats().map(([month, data]) => (
                    <div key={month} className="p-8 bg-slate-50 border border-slate-100 rounded-[32px] group hover:bg-white hover:border-indigo-100 transition-all">
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                          <div>
                             <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">{month}</p>
                             <h4 className="text-xl font-bold text-slate-900">Financial Summary</h4>
                          </div>
                          <div className="flex flex-wrap gap-8">
                             <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue</p>
                                <p className="text-xl font-black text-emerald-600">Rs. {data.revenue.toLocaleString()}</p>
                             </div>
                             <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expenses</p>
                                <p className="text-xl font-black text-rose-600">Rs. {data.expenses.toLocaleString()}</p>
                             </div>
                             <div className="md:border-l md:pl-8 border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Profit</p>
                                <p className={`text-xl font-black ${data.revenue - data.expenses >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                   Rs. {(data.revenue - data.expenses).toLocaleString()}
                                </p>
                             </div>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 py-10">
               <div className="space-y-6">
                  <h4 className="text-2xl font-bold text-slate-900">Financial Insights</h4>
                  <p className="text-slate-500 leading-relaxed">Your business is showing positive growth. Revenue is up 15% this month, primarily driven by Haircut and Facial services.</p>
                  <div className="space-y-4 pt-6">
                     <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <span className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Top Service</span>
                        <span className="font-black text-emerald-900">Haircut</span>
                     </div>
                     <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <span className="text-sm font-bold text-indigo-800 uppercase tracking-wider">Efficiency</span>
                        <span className="font-black text-indigo-900">92%</span>
                     </div>
                  </div>
               </div>
               <div className="flex items-center justify-center bg-slate-50 rounded-[40px] border border-slate-100 p-10">
                  <PieIcon className="w-32 h-32 text-indigo-200" />
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-xl overflow-hidden shadow-2xl"
            >
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <h3 className="text-2xl font-bold text-slate-900">
                    {editingId
                      ? `Edit ${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`
                      : modalType === 'service' ? 'Add Service' : modalType === 'product' ? 'Add Product' : 'New Expense'}
                 </h3>
                 <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-600 transition-all">
                    <X className="w-6 h-6" />
                 </button>
              </div>
              <form onSubmit={handleSubmit} className="p-10 space-y-6">
                 {modalType === 'service' && (
                   <>
                     <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Service Name</label>
                        <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" placeholder="e.g. Skin Polish" />
                     </div>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Price (Rs)</label>
                           <input required type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Duration (Min)</label>
                           <input required type="number" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
                        </div>
                     </div>
                   </>
                 )}

                 {modalType === 'product' && (
                   <>
                     <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Product Name</label>
                        <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" placeholder="e.g. Hair Wax" />
                     </div>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Sale Price</label>
                           <input required type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Unit</label>
                           <input required type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" placeholder="pcs / ml" />
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Initial Stock</label>
                           <input required type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Min Stock Alert</label>
                           <input required type="number" value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
                        </div>
                     </div>
                   </>
                 )}

                 {modalType === 'expense' && (
                   <>
                     <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                        <input required type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" placeholder="e.g. Shop Rent" />
                     </div>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Amount (Rs)</label>
                           <input required type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                           <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold appearance-none cursor-pointer">
                              <option>Supplies</option>
                              <option>Rent</option>
                              <option>Utilities</option>
                              <option>Salaries</option>
                              <option>Other</option>
                           </select>
                        </div>
                     </div>
                   </>
                 )}

                 <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg mt-4 hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 active:scale-95">
                    Save to Dashboard
                 </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
