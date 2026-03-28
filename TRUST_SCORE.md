# Trust Scoring

Every seller returned by Sniffer gets a **credibility score** from 0–100. The score is computed deterministically from multiple signals — no AI involved. Scores ≥ 80 are marked `isTrusted: true`.

## Scoring breakdown

### Base score
All sellers start at **50**.

### Retailer classification
| Retailer type | Adjustment | Examples |
|---|---|---|
| Premium authorized retailer | +40 | Sephora, Nordstrom, Macy's, Bloomingdale's, Neiman Marcus, Ulta, Perfumania |
| Brand official site | +40 | dior.com, chanel.com, tomford.com, creedfragrances.com |
| Gray market discounter | +5 (net) | Jomashop, FragranceNet, FragranceX |
| Large marketplace | +10 | Amazon, eBay, Walmart, Target |
| Unknown | ±0 | Scored by heuristics below |

Gray market = legit products, often parallel imports, but not authorized dealers. Real fragrances, possibly lower prices, but no brand warranty.

### HTTPS
| Protocol | Adjustment |
|---|---|
| HTTPS | +5 |
| HTTP | −20 |

### TLD (top-level domain)
| TLD | Adjustment |
|---|---|
| .com | +5 |
| .xyz, .top, .shop, .ru, .tk, .biz, etc. | −10 |
| Other | ±0 |

### Suspicious domain keywords
If the domain contains: `cheap`, `discount`, `outlet`, `replica`, `fake`, `knockoff`, `imitation`, `counterfeit` → **−25**

### Domain structure
| Signal | Adjustment |
|---|---|
| More than 2 hyphens in domain label | −10 |
| Domain label contains digits | −5 |

### Price sanity (vs. reference price)
The reference price is the **median** of all collected prices for the same fragrance in the same search. It normalises out the variation between cheap and expensive sellers.

| Price ratio vs. median | Adjustment |
|---|---|
| < 50% of median | −30 (likely fake or wrong item) |
| 50–80% of median | −10 (suspiciously cheap) |
| ≥ 80% | ±0 |
| < 60% AND score already < 60 | additional −10 (consistency penalty) |

### Product text signals
| Signal | Adjustment |
|---|---|
| "tester", "no box", "unboxed" | −10 |
| "replica", "inspired by", "our version", "dupe" | −40 |
| "return policy", "free returns" | +5 |
| No contact info mentioned (for longer text) | −10 |

### Brand mismatch
If the fragrance is a **luxury brand** and the seller domain is an unknown site (not a known retailer/marketplace) that doesn't contain the brand name → **−10**.

Luxury brands include: Dior, Chanel, Gucci, Prada, Hermès, Creed, Tom Ford, Versace, Burberry, Givenchy, YSL, Armani, Valentino, and others.

### Final clamp
Score is clamped to **0–100** and rounded to the nearest integer.

---

## Typical scores by retailer type

| Retailer | Typical score | isTrusted |
|---|---|---|
| Sephora, Nordstrom, Dior.com | 95–100 | ✅ |
| Macy's, Ulta, Bloomingdale's | 95–100 | ✅ |
| Amazon, eBay | 65–70 | ❌ |
| Jomashop, FragranceNet | 60–65 | ❌ |
| Unknown .com site | 45–60 | ❌ |
| Suspicious/sketchy domain | 0–35 | ❌ |
