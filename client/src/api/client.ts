import type { Expense, Advance, Category } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['X-Auth-Token'] = token;
  }
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function getExpenses(): Promise<Expense[]> {
  return request<Expense[]>('/api/expenses');
}

export async function getAdvances(): Promise<Advance[]> {
  return request<Advance[]>('/api/advances');
}

export async function getCategories(): Promise<Category[]> {
  return request<Category[]>('/api/categories');
}

export async function postCategories(body: {
  action: 'add' | 'update' | 'delete';
  id?: string;
  label?: string;
}): Promise<Category[]> {
  return request<Category[]>('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function postAdvance(body: {
  date: string;
  amount: number;
  note?: string;
}): Promise<{ success: boolean; id: string }> {
  return request<{ success: boolean; id: string }>('/api/advances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function postTranscribe(audioBlob: Blob): Promise<{ text: string }> {
  const fd = new FormData();
  fd.append('audio', audioBlob, 'recording.webm');
  return request<{ text: string }>('/api/transcribe', {
    method: 'POST',
    body: fd,
  });
}

export async function postParse(
  text: string,
  categories: string[]
): Promise<{ rows: any[] }> {
  return request<{ rows: any[] }>('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, categories }),
  });
}

export async function postCommit(rows: any[]): Promise<{ success: boolean; ids: string[] }> {
  return request<{ success: boolean; ids: string[] }>('/api/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function postUploadImage(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append('image', file);
  return request<{ url: string }>('/api/upload', {
    method: 'POST',
    body: fd,
  });
}

/**
 * Build a proxied image URL for a Filen cloud path.
 * Use this as <img src={fileUrl(path)} />
 */
export function fileUrl(cloudPath: string): string {
  return `${API_BASE}/api/files?path=${encodeURIComponent(cloudPath)}`;
}
