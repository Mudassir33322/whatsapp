import { useState, useEffect } from 'react';
import { Star, MessageSquareText, Loader2 } from 'lucide-react';
import { authHeaders } from './api';

interface Review {
  id: number;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
}



function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
      ))}
    </div>
  );
}

export function SalonReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReviews = async () => {
    try {
      const r = await fetch('/api/salon/reviews', { headers: authHeaders() });
      if (!r.ok) throw new Error('Failed to fetch reviews');
      setReviews(await r.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReviews(); }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  if (error) return <div className="flex items-center justify-center min-h-[60vh]"><div className="bg-red-50 text-red-700 px-6 py-4 rounded-xl border border-red-200 text-sm font-medium">{error}</div></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquareText className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
      </div>

      {!reviews.length ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <MessageSquareText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No reviews yet</p>
          <p className="text-gray-300 text-xs mt-1">Reviews from your customers will appear here once they share feedback via WhatsApp</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900 text-sm">{r.customer_name}</p>
                  <Stars rating={r.rating} />
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(r.created_at)}</span>
              </div>
              {r.comment && (
                <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
