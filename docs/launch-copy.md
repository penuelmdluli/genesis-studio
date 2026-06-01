# Genesis Studio Launch Copy

All copy below is ready to paste. URL: https://ivideostudio.ai

---

## 1. Twitter/X Launch Thread

**Tweet 1 (Hook + Link):**

I built an AI video studio with 12 models, dance transfer, multi-scene short films, and music video generation.

It's live. 100 free credits, no credit card needed.

https://ivideostudio.ai

**Tweet 2 (Features):**

What you can do with Genesis Studio:

- Text-to-video with 12 different AI models
- Dance transfer (Mimic Studio) — upload a reference, the AI copies the moves
- Multi-scene short films (Brain Studio) — stitch scenes into a coherent story
- Music video generation from a single prompt

All running on serverless GPUs.

**Tweet 3 (South Africa angle):**

Built this from South Africa.

We accept ZAR payments through Yoco because creators here shouldn't need a USD credit card to use AI tools.

If you're a creator anywhere in Africa, this was built with you in mind.

**Tweet 4 (Free tier):**

The free tier gives you 100 credits. No credit card. No trial that expires.

If you want more:
- Creator: $12/mo
- Pro: $29/mo
- Studio: $79/mo

But you can do a lot with 100 credits before you ever pay anything.

**Tweet 5 (CTA):**

If you make content — short films, music videos, social clips, anything visual — try it.

I want to know what you build.

https://ivideostudio.ai

---

## 2. Reddit r/SideProject Post

**Title:** I built an AI video creation platform with 12 models, dance transfer, and multi-scene short films — now live

**Body:**

Hey everyone,

I've been building Genesis Studio (https://ivideostudio.ai) for the past few months and it's now live.

**What it is:** An AI video creation platform that bundles 12 different AI models into one interface. You can do text-to-video, dance transfer (upload a reference video and the AI replicates the choreography), multi-scene short films where you stitch scenes into a coherent narrative, and music video generation.

**Tech stack:**

- Cloudflare Workers for the backend (serverless, edge-deployed)
- Cloudflare D1 for the database
- Cloudflare R2 for video/asset storage
- AI models run on serverless GPUs
- Yoco for ZAR payments (I'm based in South Africa and wanted local payment support)

**Why I built it:** Most AI video tools give you one model and one workflow. I wanted a studio where creators could pick the right model for the job and combine multiple scenes into something that actually tells a story. Brain Studio (the multi-scene feature) is what I'm most proud of.

**Pricing:** There's a free tier with 100 credits, no credit card required. Paid plans start at $12/mo if you need more. I tried to keep it accessible — especially for creators in markets where $30/mo tools are out of reach.

**What I'd love feedback on:**

- Is the onboarding clear enough?
- Does the pricing feel right?
- Any features you'd expect that are missing?

Happy to answer questions about the tech or the business side. This is a solo/small team project and I'm learning as I go.

---

## 3. Reddit r/SaaS Post

**Title:** Launched my AI video platform — 12 models, free tier, ZAR payments. Here's what I learned about pricing.

**Body:**

I just launched Genesis Studio (https://ivideostudio.ai), an AI video creation platform. Wanted to share some pricing and positioning decisions in case they're useful to others here.

**The product:** AI video creation with 12 models, dance transfer, multi-scene short films, and music video generation. Think of it as a studio rather than a single-trick tool.

**Pricing structure:**

- Free: 100 credits, no credit card
- Creator: $12/mo
- Pro: $29/mo
- Studio: $79/mo

**Why these numbers:**

1. **The free tier is real.** 100 credits is enough to actually make something, not just see a demo. I want people to hit a genuine "I need more" moment before they pay. Gated trials with credit cards convert higher short-term but I think they hurt trust — especially in emerging markets where people are skeptical of SaaS charges.

2. **$12 entry point, not $9.** I tested both. $12 signals "this does something serious" without being a big commitment. The $3 difference barely affects conversion but meaningfully affects unit economics when your costs are GPU compute.

3. **ZAR payments via Yoco.** I'm based in South Africa. A huge number of potential users here can't easily pay in USD. Adding local payment rails was a deliberate decision to serve a market that most AI tools ignore entirely.

**Market positioning:** I'm not competing with Runway or Pika on single-clip quality. I'm competing on workflow — the ability to use multiple models, build multi-scene narratives, and do things like dance transfer that most platforms don't offer at all. The "studio" framing is intentional.

**Lessons so far:**

- GPU costs are brutal. Serverless helps (no idle spend) but you still need to be very careful about which models you offer on free tier.
- The African creator market is underserved and growing fast. If you can solve payments, there's real demand.
- Bundling multiple AI capabilities beats selling them individually. People want a toolkit, not a single feature.

100 free credits, no credit card: https://ivideostudio.ai

Happy to go deeper on any of this.

---

## 4. Hacker News "Show HN" Post

**Title:** Show HN: Genesis Studio -- AI video platform with 12 models, dance transfer, multi-scene films

**Description:**

Genesis Studio (https://ivideostudio.ai) is an AI video creation platform that bundles 12 AI models into a single interface. The main capabilities are text-to-video, dance transfer (motion replication from reference video), multi-scene short film generation, and music videos.

The interesting engineering problems:

- Running 12 different AI video models behind a unified API on serverless GPUs. Each model has different input requirements, generation times, and output formats. The orchestration layer normalizes all of this.

- "Brain Studio" is the multi-scene feature. It handles scene planning, per-scene model selection, and stitching. The challenge is maintaining visual consistency across scenes generated by different models.

- The whole platform runs on Cloudflare Workers + D1 + R2. No traditional servers. Edge-deployed globally.

- Payment processing includes Yoco integration for South African Rand, since this is built in South Africa and a significant portion of the target users are in markets where USD payment is a barrier.

Free tier: 100 credits, no credit card required. Paid plans from $12/mo.

I'm interested in feedback on the multi-scene generation approach and the model orchestration architecture in particular.

---

## 5. LinkedIn Post

I just launched Genesis Studio, an AI video creation platform built in South Africa.

It gives creators access to 12 AI models for text-to-video, dance transfer, multi-scene short films, and music video generation. One interface, multiple creative workflows.

Why this matters to me: AI video tools are advancing rapidly, but access is not evenly distributed. Most platforms price in USD, require international credit cards, and are designed for markets where $30/month is a casual expense.

Genesis Studio supports ZAR payments through Yoco. It has a free tier with 100 credits and no credit card required. Paid plans start at $12/month.

This is not about competing with Silicon Valley on model quality. It is about making AI video creation accessible to the millions of creators across Africa and emerging markets who are building media businesses, telling stories, and growing audiences right now, with or without these tools.

The creator economy in Africa is real. The talent is here. The demand is here. What has been missing is infrastructure that meets people where they are.

If you are a creator, a filmmaker, or someone experimenting with AI video, I would genuinely appreciate you trying it and telling me what works and what does not.

https://ivideostudio.ai

---

## 6. Product Hunt Listing

**Tagline (56 chars):**
AI video studio with 12 models. Create, don't wait.

**Description (253 chars):**
Genesis Studio bundles 12 AI video models into one platform. Text-to-video, dance transfer, multi-scene short films, and music videos. 100 free credits, no credit card. Built in South Africa with ZAR payment support. https://ivideostudio.ai

**First Comment (Maker's Story):**

Hey Product Hunt! I'm the maker of Genesis Studio.

I built this because I wanted a single place where creators could access multiple AI video models without juggling five different tools and subscriptions.

The feature I'm most proud of is Brain Studio -- you describe a multi-scene short film and the platform plans the scenes, picks the right model for each one, and stitches them together. It's the closest thing I've found to "describe a story, get a video."

Dance transfer (Mimic Studio) is the other one people love. Upload a reference dance video and the AI transfers those moves. It's wild to watch.

I'm based in South Africa, so I added ZAR payments through Yoco. It felt wrong building an AI platform and then making it hard for people in my own country to pay for it.

There's a free tier with 100 credits, no credit card needed. I'd rather you try it and tell me it's not for you than never try it because of a paywall.

Would love your feedback on what works and what's missing. I'm building this in public and every piece of input shapes what comes next.

https://ivideostudio.ai

**5 Topics:**

1. Artificial Intelligence
2. Video Generation
3. SaaS
4. Creator Tools
5. Made in Africa
