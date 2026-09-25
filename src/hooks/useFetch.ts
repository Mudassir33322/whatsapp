import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFetchOptions {
  url: string;
  token?: string;
  immediate?: boolean;
}

export function useFetch<T = any>({ url, token, immediate = true }: UseFetchOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (overrideUrl?: string, options?: RequestInit) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    
    setLoading(true);
    setError(null);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers as Record<string, string> || {}),
      };
      
      const res = await fetch(overrideUrl || url, {
        ...options,
        headers,
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
        console.error('[useFetch]', err);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [url, token]);

  useEffect(() => {
    if (immediate) execute();
    return () => controllerRef.current?.abort();
  }, []);

  const abort = useCallback(() => controllerRef.current?.abort(), []);

  return { data, loading, error, execute, setData, abort };
}
