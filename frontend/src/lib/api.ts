const BASE = '/api';

function authHeaders(): Record<string, string> {
  const user = import.meta.env.VITE_AUTH_USER ?? 'admin';
  const pass = import.meta.env.VITE_AUTH_PASS ?? '';
  if (!pass) return {};
  return {
    Authorization: `Basic ${btoa(`${user}:${pass}`)}`,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
  }
  return res.json();
}

export const api = {
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ results: any[]; count: number }>('/upload', {
      method: 'POST',
      body: fd,
    });
  },

  staging: {
    list: () => request<any[]>('/staging'),
    get: (id: string) => request<any>(`/staging/${id}`),
    accept: (id: string, overrides?: any) =>
      request(`/staging/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrides ?? {}),
      }),
    reject: (id: string, reason?: string) =>
      request(`/staging/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }),
  },

  records: {
    list: () => request<any[]>('/records'),
    summary: () => request<any[]>('/records/summary'),
    get: (id: string) => request<any>(`/records/${id}`),
    update: (id: string, data: any) =>
      request(`/records/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
  },
};
