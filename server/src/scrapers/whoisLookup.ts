import { getCachedDomainAge, cacheDomainAge } from '../db';

// RDAP is the modern JSON replacement for WHOIS — no packages needed.
// Returns the domain age in days, or null if it can't be determined.
export async function getDomainAgeDays(domain: string): Promise<number | null> {
  // Check cache first
  const cached = getCachedDomainAge(domain);
  if (cached !== undefined) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`https://rdap.org/domain/${domain}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      cacheDomainAge(domain, null);
      return null;
    }

    const data = await res.json() as {
      events?: Array<{ eventAction: string; eventDate: string }>;
    };

    const registered = data.events?.find(e => e.eventAction === 'registration');
    if (!registered?.eventDate) {
      cacheDomainAge(domain, null);
      return null;
    }

    const regDate = new Date(registered.eventDate);
    const ageDays = Math.floor((Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24));
    cacheDomainAge(domain, ageDays);
    return ageDays;
  } catch {
    cacheDomainAge(domain, null);
    return null;
  }
}
