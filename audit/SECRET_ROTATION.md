# Secret Rotation Register

| Secret | Provider | Last Rotated | Next Due | Owner | Procedure |
|---|---|---|---|---|---|
| CLERK_SECRET_KEY | Clerk | Unknown (initial) | 2026-08-01 | Operator | docs/runbooks/procedure-rotate-secrets.md |
| SUPABASE_SERVICE_ROLE_KEY | Supabase | Unknown (initial) | 2026-08-01 | Operator | Same |
| R2_ACCESS_KEY_ID | Cloudflare | Unknown (initial) | 2026-08-01 | Operator | Same |
| R2_SECRET_ACCESS_KEY | Cloudflare | Unknown (initial) | 2026-08-01 | Operator | Same |
| FAL_KEY | FAL.AI | Unknown (initial) | 2026-08-01 | Operator | Same |
| RUNPOD_API_KEY | RunPod | Unknown (initial) | 2026-08-01 | Operator | Same |
| STRIPE_SECRET_KEY | Stripe | Unknown (initial) | 2026-08-01 | Operator | Same |
| STRIPE_WEBHOOK_SECRET | Stripe | Unknown (initial) | 2026-08-01 | Operator | Same |
| YOCO_SECRET_KEY | Yoco | Unknown (initial) | 2026-08-01 | Operator | Same |
| YOCO_WEBHOOK_SECRET | Yoco | Unknown (initial) | 2026-08-01 | Operator | Same |
| CRON_SECRET | Self-managed | Unknown (initial) | 2026-08-01 | Operator | Generate UUID, update Vercel |
| RUNPOD_WEBHOOK_SECRET | Self-managed | Unknown (initial) | 2026-08-01 | Operator | Same |
| ANTHROPIC_API_KEY | Anthropic | Unknown (initial) | 2026-08-01 | Operator | Same |
| FB_PAGE_TOKEN_* | Facebook | Unknown (initial) | Every 60 days | Operator | Refresh via Graph API |
| NEWS_API_KEY | NewsAPI | Unknown (initial) | 2026-08-01 | Operator | Same |
| GEMINI_API_KEY | Google | Unknown (initial) | 2026-08-01 | Operator | Same |
| RESEND_API_KEY | Resend | Unknown (initial) | 2026-08-01 | Operator | Same |
| COMFYDEPLOY_API_KEY | ComfyDeploy | Unknown (initial) | 2026-08-01 | Operator | Same |
| UPSTASH_REDIS_REST_TOKEN | Upstash | Unknown (initial) | 2026-08-01 | Operator | Same |
| SLACK_ALERT_WEBHOOK_URL | Slack | N/A (webhook URL) | N/A | Operator | Regenerate in Slack app settings |

## Schedule
- **Quarterly**: All API keys and secrets
- **Every 60 days**: Facebook page tokens (auto-expire)
- **Immediately**: Any key suspected of being compromised
