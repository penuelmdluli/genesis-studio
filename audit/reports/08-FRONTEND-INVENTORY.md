# Genesis Studio — Frontend Inventory

**Audit date:** 2026-04-25

---

## Page Routes

### Public Routes
| Path | Purpose | Auth Gate | Notes |
|------|---------|-----------|-------|
| `/` | Landing page (hero, community feed, pricing, CTA) | None | 680 lines, client component |
| `/explore` | Public video gallery (trending, latest, audio, brain films) | None | Pagination, tabs |
| `/explore/[id]` | Individual video detail viewer | None | Server-rendered with OG metadata |
| `/sign-in` | Clerk sign-in | None (redirects if signed in) | |
| `/sign-up` | Clerk sign-up | None | Shows "50 free credits" offer |
| `/about`, `/terms`, `/privacy`, `/contact` | Static legal/info pages | None | |
| `/blog`, `/blog/[slug]` | Blog | None | |
| `/changelog` | Version history | None | |
| `/docs` | API documentation | None | |
| `/tutorials` | Tutorials | None | |

### Protected Dashboard Routes (Clerk auth required)
| Path | Purpose | Notes |
|------|---------|-------|
| `/dashboard` | Main dashboard: quick actions, stats, pending jobs | |
| `/generate` | Video generation form: model select, prompt, resolution, duration | 1000+ lines |
| `/gallery` | Video library: grid/list view, search, filter, delete, download | |
| `/brain` | Brain Studio: multi-scene AI director | 1000+ lines, complex workflow |
| `/motion-control` | Motion transfer (MimicMotion) | |
| `/talking-avatar` | Lip-sync avatar generation | |
| `/voiceover` | TTS generation with 12 voices | |
| `/captions` | Auto-captioning with language support | |
| `/upscale` | Video upscaling (480p→4K) | |
| `/thumbnails` | AI thumbnail generation | |
| `/images` | Image generation | |
| `/edit` | Video editor | |
| `/pricing` | Plans + credit packs (monthly/annual, USD/ZAR) | |
| `/settings` | Account settings | |
| `/collections` | Video collection management | |
| `/api-keys` | API key management | |
| `/studio` | Content Engine / automation | |
| `/studio/setup` | Facebook page setup for auto-posting | |

### Owner-Only Routes
| Path | Purpose | Notes |
|------|---------|-------|
| `/admin` | Admin stats: users, jobs, revenue, GPU metrics | Gated by `isOwner` flag |
| `/intelligence` | Content intelligence & AI learning dashboard | Owner-only |
| `/dev-dashboard` | Developer dashboard | Owner-only in production |

---

## Major Components (>100 lines)

| Component | Lines | Purpose |
|-----------|-------|---------|
| `src/components/ui/video-player.tsx` | 512 | Full-featured video player: play/pause, volume, fullscreen, captions, sync, seek |
| `src/components/layout/sidebar.tsx` | 391 | Dashboard sidebar: Create/Enhance/Audio/Image/Edit/Manage/Automate sections |
| `src/components/explore/share-modal.tsx` | 373 | Share modal: copy link, social share, embed code |
| `src/components/explore/recreate-modal.tsx` | 360 | Regenerate video with customization |
| `src/components/explore/video-viewer-modal.tsx` | 304 | Full-screen video viewer |
| `src/components/explore/video-card.tsx` | 297 | Explore feed card with lazy loading, hover-to-play |
| `src/components/ui/motion.tsx` | 285 | Framer Motion animation utilities |
| `src/components/ui/credit-upsell.tsx` | 189 | Credit upsell modal |
| `src/components/ui/command-palette.tsx` | 185 | Cmd+K command palette |
| `src/components/ui/notification-center.tsx` | 182 | Notification drawer |
| `src/components/chat/chatbot.tsx` | 174 | Floating AI chat assistant |
| `src/components/ui/skeleton.tsx` | 150 | Loading skeletons |
| `src/components/ui/modal.tsx` | 141 | Base modal component |
| `src/components/onboarding/tour.tsx` | 123 | 4-step onboarding tour |
| `src/components/layout/navbar.tsx` | 119 | Top nav with Clerk UserButton |

---

## State Management

**Primary Store:** Zustand (`src/hooks/use-store.ts`, ~5000 lines)

Key state:
- `user` — UserState (plan, credits, isOwner)
- `form` — GenerateFormState (model, prompt, resolution, duration, etc.)
- `activeJobs` — Generation jobs in progress
- `videos` — User's generated videos
- `notifications` — App notifications (max 50)
- UI state: `sidebarOpen`, `mobileMenuOpen`, `creditPurchaseOpen`

Default generation form:
- Model: `wan-2.2`, Resolution: `720p`, Duration: `5s`, FPS: `24`

---

## Observations

### Strengths
- Clean dark theme with glass-morphism styling
- Responsive design with mobile action bar
- PWA support (service worker + manifest)
- Lazy video loading with IntersectionObserver
- Command palette (Cmd+K) for power users
- Cookie consent banner for GDPR
- Data saver mode toggle

### Potential Issues
- **No middleware.ts**: Auth is per-route in dashboard layout, not enforced via middleware
- **Large page files**: `/generate` and `/brain` pages are 1000+ lines — could benefit from component extraction
- **No error boundaries per page**: Global `error.tsx` exists but no per-page error handling
- **Missing loading states on some pages**: Some pages may show blank while data loads
- **Footer links to nonexistent pages**: Footer links to `/docs`, `/tutorials` — these may be placeholder pages
