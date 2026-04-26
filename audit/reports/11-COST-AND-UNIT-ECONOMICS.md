# Genesis Studio — Cost & Unit Economics

**Audit date:** 2026-04-25

---

## 11.1 Cost-Per-Generation by Tier

### Single Video Generation (5s, 720p)

| Tier | Sub price | Credits/mo | Provider used | Credits/gen | Cost/gen (USD) | Revenue/gen (USD) | Margin |
|------|-----------|------------|---------------|-------------|----------------|-------------------|--------|
| Free | $0 | 50 | wan-2.2 (RunPod) | 40 | ~$0.062 | $0.00 | **-100% (loss)** |
| Creator | $12 | 500 | wan-2.2 / Seedance / Kling 2.6 | 40-100 | $0.06-0.18 | $0.96-2.40 | **94-97%** |
| Pro | $29 | 2,000 | All models incl. Kling 3.0, Veo 3.1 | 40-400 | $0.06-0.50 | $0.96-9.60 | **93-95%** |
| Studio | $79 | 8,000 | All models | 40-600 | $0.06-0.80 | $0.40-5.94 | **85-93%** |

*Revenue per generation = (credits charged x $0.024 credit value) x 0.839 (after VAT 15% + processor fee 3.5%)*

### Brain Studio Production (30s, 6 scenes, wan-2.2)

| Tier | Credits charged | Actual GPU/API cost | Revenue (net) | Margin |
|------|----------------|---------------------|---------------|--------|
| Free | ~260 | ~$0.47 | $0.00 (free tier) | **-100%** |
| Creator | ~260 | ~$0.47 | $5.23 | **91%** |
| Pro | ~260 | ~$0.47 | $5.23 | **91%** |
| Studio | ~260 | ~$0.47 | $5.23 | **91%** |

### Brain Studio with Hollywood Audio (Kling 2.6, 6 scenes)

| Tier | Credits charged | Actual cost | Revenue (net) | Margin |
|------|----------------|-------------|---------------|--------|
| Pro | ~620 | ~$1.30 | $12.48 | **90%** |
| Studio | ~620 | ~$1.30 | $12.48 | **90%** |

### Brain Studio with Sound Design (adds ~30 credits/scene)

| Tier | Credits charged | Actual cost | Revenue (net) | Margin |
|------|----------------|-------------|---------------|--------|
| Pro | ~440 (wan-2.2 + SFX) | ~$0.80 | $8.85 | **91%** |

---

## 11.2 Subscription Economics

### Monthly Revenue per Subscriber

| Tier | Monthly USD | After VAT (15%) | After processor (3.5%) | Net revenue |
|------|-----------|----------------|----------------------|-------------|
| Free | $0 | $0 | $0 | **$0** |
| Creator | $12 | $10.43 | $10.07 | **$10.07** |
| Pro | $29 | $25.22 | $24.34 | **$24.34** |
| Studio | $79 | $68.70 | $66.29 | **$66.29** |

### Monthly Cost per Subscriber (estimated)

| Tier | Max gens possible | Typical gens (est.) | Avg GPU cost | Infrastructure share | Total cost |
|------|-------------------|---------------------|--------------|---------------------|-----------|
| Free | 50 credits / 40 per gen = ~1 | 1 | $0.06 | $0.16 | **$0.22** |
| Creator | 500 / 40 = ~12 | 8 | $0.50 | $0.16 | **$0.66** |
| Pro | 2000 / 40 = ~50 | 20 | $1.24 | $0.16 | **$1.40** |
| Studio | 8000 / 40 = ~200 | 50 | $3.10 | $0.16 | **$3.26** |

*Infrastructure share = $155/mo fixed costs / estimated 1000 monthly users = $0.155/user*

### Net Margin per Subscriber

| Tier | Net revenue | Estimated cost | **Monthly profit** | **Margin** | **Verdict** |
|------|------------|----------------|-------------------|------------|-------------|
| Free | $0 | $0.22 | **-$0.22** | N/A | **Loss-leader** |
| Creator | $10.07 | $0.66 | **+$9.41** | 93% | **Profitable** |
| Pro | $24.34 | $1.40 | **+$22.94** | 94% | **Profitable** |
| Studio | $66.29 | $3.26 | **+$63.03** | 95% | **Profitable** |

---

## 11.3 Fixed Infrastructure Costs (from profitability.ts)

| Service | Monthly USD |
|---------|-----------|
| Supabase | $25 |
| Clerk | $25 |
| Cloudflare (CDN/R2) | $20 |
| Upstash (Redis) | $10 |
| Vercel (Pro) | $20 |
| Resend (Email) | $20 |
| Domains | $5 |
| Claude API | $30 |
| **Total** | **$155/mo** |

### Break-even Analysis

Using `calculateBreakEven()` from `profitability.ts:196`:
- Average revenue per paid user: $24.60/mo (weighted across Creator/Pro/Studio)
- Net revenue after taxes/fees: $24.60 x 0.839 = $20.64
- Average GPU cost per user: ~$5/mo
- Net per user: $15.64
- **Break-even: ceil($155 / $15.64) = 10 paid subscribers**

---

## 11.4 Credit Pack Economics

| Pack | Price | Credits | Cost/credit | Revenue/credit (net) | Margin |
|------|-------|---------|-------------|---------------------|--------|
| 500 | $10 | 500 | $0.020 | $0.0168 | Depends on usage |
| 2000 | $35 | 2,000 | $0.0175 | $0.0147 | Depends on usage |
| 10000 | $130 | 10,000 | $0.013 | $0.0109 | Depends on usage |

Credit packs are profitable as long as the customer uses cheaper models. If someone buys the 10K pack ($0.013/credit) and exclusively uses Veo 3.1 (400+ credits/gen, $0.50/gen cost), they'd generate ~25 videos at $0.0052 cost per credit — still profitable at $0.0109 net per credit.

---

## 11.5 R2 Storage Costs

**Current state**: UNKNOWN — requires R2 dashboard or API access to determine bucket size.

**Projections (Cloudflare R2 pricing)**:
- Storage: $0.015/GB/month (first 10GB free)
- Class A operations (writes): $4.50/million
- Class B operations (reads): $0.36/million
- Egress: **Free** (R2's key advantage)

| Scale | Est. videos | Est. storage | Monthly cost |
|-------|-------------|-------------|-------------|
| Current (~12K videos) | 12,000 | ~120GB (10MB avg) | ~$1.65 |
| 10x (120K videos) | 120,000 | ~1.2TB | ~$18 |
| 100x (1.2M videos) | 1,200,000 | ~12TB | ~$180 |

---

## 11.6 Honest Verdict

| Tier | Verdict | Reasoning |
|------|---------|-----------|
| **Free** | **Loss-leader (intentional)** | $0 revenue, ~$0.22 cost per user. Expected — drives signups and explore feed content. Auto-publish with branding gives marketing value. |
| **Creator ($12)** | **Profitable** | 93% margin. Each Creator subscriber generates ~$9.41/mo profit. Healthy. |
| **Pro ($29)** | **Profitable** | 94% margin. Each Pro subscriber generates ~$22.94/mo profit. Best absolute margin. |
| **Studio ($79)** | **Profitable** | 95% margin. Each Studio subscriber generates ~$63.03/mo profit. Highest per-user profit. |
| **Credit Packs** | **Profitable** | Even the cheapest pack (10K at $0.013/credit) is profitable unless users exclusively run Veo 3.1. |

### Key Insight
The credit system is **dramatically overpriced relative to actual GPU costs**. A Wan 2.2 generation costs ~$0.06 but charges 40 credits = $0.96 — that's a **16x markup**. This is healthy for a SaaS but means:
1. **Aggressive competitors could undercut significantly** on price
2. **Free tier is very limited** (50 credits = ~1 video/month)
3. **Heavy users on Studio plan get great value** (8000 credits at $0.0099/credit)

### Risk: FAL Model Costs
FAL.AI models (Kling, Veo) charge per-second API fees. If a user on Pro tier ($29) exclusively uses Veo 3.1:
- 2000 credits / 400 per gen = 5 Veo generations
- Cost: 5 x $0.50 = $2.50
- Revenue: $24.34
- Still profitable (90% margin)

The pricing is well-calibrated to remain profitable even with expensive models.
