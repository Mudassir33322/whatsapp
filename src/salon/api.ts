import { API_URL } from '../config';

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('salon-token');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json'
  };
}

export const salonFetch = (path: string, options: RequestInit = {}) => {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...options.headers,
    },
  });
};
