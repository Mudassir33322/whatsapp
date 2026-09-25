import { useState, useCallback, useRef } from 'react';

interface UseMutationOptions {
  token?: string;
}

export function useMutation<T = any, B = any>({ token }: UseMutationOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const mutate = useCallback(async (
    url: string, 
    method: string = 'POST', 
    body?: B,
    extraHeaders?: Record<string, string>
  ) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    
    setLoading(true);
    setError(null);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
      };
      
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      
      const result = await res.json();
      setData(result);
      return result;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'An error occurred');
        console.error('[useMutation]', err);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const abort = useCallback(() => controllerRef.current?.abort(), []);
  const reset = useCallback(() => { setData(null); setError(null); setLoading(false); }, []);

  return { data, loading, error, mutate, setData, abort, reset };
}
