// Runtime feature flags controlled by environment variables.

// WHOIS domain-age trust checks are ON by default. They add ~5s per search
// (RDAP/WHOIS lookups per seller domain) but make the trust scoring smarter.
// To turn OFF: set WHOIS_ENABLED=false (or 0) in server/.env, then restart.
export function whoisEnabled(): boolean {
  const value = process.env.WHOIS_ENABLED;
  return value !== 'false' && value !== '0';
}
