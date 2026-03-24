// Large marketplaces — functional but may sell gray market / third-party fakes
const MARKETPLACE_DOMAINS = new Set([
  'amazon.com', 'walmart.com', 'target.com', 'ebay.com', 'costco.com', 'groupon.com',
]);

// Known authorized/major fragrance retailers — high trust
const TRUSTED_DOMAINS = new Set([
  // Department stores
  'sephora.com',
  'nordstrom.com',
  'macys.com',
  'bloomingdales.com',
  'neimanmarcus.com',
  'saksfifthavenue.com',
  'dillards.com',
  'belk.com',
  'ulta.com',
  // Dedicated fragrance retailers
  'fragrancenet.com',
  'fragrancex.com',
  'perfumania.com',
  'fragrancebuy.ca',
  'beautycounter.com',
  'jomashop.com',
  'fragranceshop.com',
  // Brand official sites
  'dior.com',
  'tomford.com',
  'chanel.com',
  'ysl.com',
  'yslbeauty.com',
  'versace.com',
  'giorgioarmani.com',
  'armani.com',
  'calvinklein.com',
  'gucci.com',
  'prada.com',
  'burberry.com',
  'hermes.com',
  'creedfragrances.com',
  'bvlgari.com',
  'givenchy.com',
  'lancome.com',
  'carolinaherrera.com',
  'valentino.com',
  'montblanc.com',
  'jimmychoo.com',
]);

export function scoreSellerTrust(url: string): { score: number; isTrusted: boolean } {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');

    if (TRUSTED_DOMAINS.has(hostname)) {
      return { score: 90, isTrusted: true };
    }

    if (MARKETPLACE_DOMAINS.has(hostname)) {
      // Marketplaces are legitimate but may carry 3rd-party sellers — mid trust
      return { score: 65, isTrusted: false };
    }

    // Heuristic scoring for unknown sites
    // Shorter domain names tend to be more established brands
    const domainLabel = hostname.split('.')[0];
    let score = 50;

    if (domainLabel.length <= 8)  score = 58;
    else if (domainLabel.length <= 14) score = 48;
    else score = 38;

    // Slight penalty for non-.com TLDs (gray market often uses .net, .co, etc.)
    if (!hostname.endsWith('.com')) score -= 5;

    return { score: Math.max(25, score), isTrusted: false };
  } catch {
    return { score: 30, isTrusted: false };
  }
}
