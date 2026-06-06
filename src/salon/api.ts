export function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${localStorage.getItem('salon-token')}`,
    'Content-Type': 'application/json'
  };
}
