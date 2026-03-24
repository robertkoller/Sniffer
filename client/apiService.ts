import { ScentDetails } from './types';

const SERVER_URL = 'http://localhost:3001';

export async function searchCologne(query: string): Promise<ScentDetails | null> {
  const res = await fetch(`${SERVER_URL}/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Server error ${res.status}`);
  }
  return res.json() as Promise<ScentDetails>;
}

export async function identifyCologneFromImage(base64Image: string): Promise<string> {
  const res = await fetch(`${SERVER_URL}/api/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Server error ${res.status}`);
  }
  const data = await res.json() as { name: string };
  return data.name;
}
