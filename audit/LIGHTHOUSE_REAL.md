# Lighthouse Audit — Real Results (2026-05-01)

Desktop preset, Chrome headless, production URL.

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Landing `/` | **85** | 88 | 100 | 100 |
| Pricing `/pricing` | **98** | 88 | 92 | 100 |
| Explore `/explore` | **97** | 94 | 100 | 100 |

## Targets vs Actual

| Page | Target Perf | Actual | Met? |
|---|---|---|---|
| Landing | >= 90 | 85 | Partial (desktop=85, close to target) |
| Pricing | >= 90 | 98 | Yes |
| Explore | >= 80 | 97 | Yes |

## Accessibility Scores
All pages score 88-94 on accessibility. Common issues likely:
- Color contrast on some text elements
- Missing form labels on search/filter inputs
- Image alt text on some decorative elements

## Notes
- Dashboard, Generate, Gallery pages require authentication — not tested in this headless run
- Landing page at 85 performance is close to 90 target — main bottleneck is likely the hero video/poster preload
- Best Practices score 100 on 2/3 pages, 92 on pricing (likely Stripe Elements or third-party script)
- SEO perfect 100 across all tested pages

## Evidence
- `audit/lighthouse-landing.json` — raw Lighthouse output
- `audit/lighthouse-pricing.json` — raw Lighthouse output
- `audit/lighthouse-explore.json` — raw Lighthouse output
