import { ScentDetails, NearbyStore } from './types';

export const SERVER_URL = import.meta.env.VITE_SERVER_URL as string ?? 'http://localhost:3001';

// Auth (shared with the Sniffy mobile app)

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture: string | null;
}

export function googleSignInUrl(): string {
  return `${SERVER_URL}/api/auth/google/start?return=${encodeURIComponent(window.location.origin + '/')}`;
}

export async function fetchMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${SERVER_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Session expired');
  const json = await res.json() as { user: AuthUser };
  return json.user;
}

export async function signOutServer(token: string): Promise<void> {
  await fetch(`${SERVER_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

export async function searchCologne(query: string): Promise<ScentDetails | null> {
  const res = await fetch(`${SERVER_URL}/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Server error ${res.status}`);
  }
  return res.json() as Promise<ScentDetails>;
}

export async function getSettings(): Promise<{ whoisEnabled: boolean; aiSearchEnabled: boolean }> {
  const res = await fetch(`${SERVER_URL}/api/settings`);
  return res.json() as Promise<{ whoisEnabled: boolean; aiSearchEnabled: boolean }>;
}

export async function setWhoisEnabled(enabled: boolean): Promise<void> {
  await fetch(`${SERVER_URL}/api/settings/whois`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
}

export async function setAiSearchEnabled(enabled: boolean): Promise<void> {
  await fetch(`${SERVER_URL}/api/settings/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
}

export async function getNearbyStores(lat: number, lng: number, brand: string): Promise<NearbyStore[]> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), brand });
  const res = await fetch(`${SERVER_URL}/api/stores/nearby?${params}`);
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json() as Promise<NearbyStore[]>;
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
