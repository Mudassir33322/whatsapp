import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Skeleton } from './components/Skeleton';
import './index.css';

// Lazy-loaded route chunks for optimal bundle splitting
const SalonApp = lazy(() => import('./SalonApp'));
const AdminApp = lazy(() => import('./AdminApp'));
const CustomerApp = lazy(() => import('./customer/CustomerApp'));
const PublicBook = lazy(() => import('./PublicBook'));
const App = lazy(() => import('./App'));

window.onerror = (msg, url, line, col, err) => {
  console.error('[GLOBAL ERROR]', msg, err);
};
window.onunhandledrejection = (e) => {
  console.error('[UNHANDLED PROMISE]', e.reason);
};

function RouteLoader() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/salon/*" element={<SalonApp />} />
            <Route path="/admin/*" element={<AdminApp />} />
            <Route path="/customer/*" element={<CustomerApp />} />
            <Route path="/book" element={<PublicBook />} />
            <Route path="*" element={<App />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
