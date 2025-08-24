// frontend/src/lib/api.ts
export const API_BASE =
  (import.meta.env.VITE_API_BASE || '/').replace(/\/+$/, '') + '/';

export async function apiGet(path: string, init: RequestInit = {}) {
  const res = await fetch(API_BASE + path.replace(/^\/+/, ''), {
    headers: { Accept: 'application/json' },
    ...init
  });
  return res;
}
