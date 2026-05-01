# Operator Sign-Off Checklist

## Functional
- [ ] Sign up as a brand-new user from scratch on production
- [ ] Generate one video using Seedance 1.5
- [ ] Generate one video using Kling 2.6
- [ ] Pay for Creator tier with a real card, get receipt, see credits
- [ ] Connect a Facebook page, schedule a post, see it publish
- [ ] Submit a support request via contact form

## Security
- [ ] Dev routes return 404 in production (`curl -I https://genesisstudio.app/api/dev/trending-topics`)
- [ ] No `.env` or `.git` exposed (`curl -I https://genesisstudio.app/.env`)
- [ ] All secrets stored in Vercel, none in git history
- [ ] HSTS header present on all responses

## Reliability
- [ ] Force a generation failure → credits refunded
- [ ] Stale-job reaper: plant a stale row, verify it gets reaped within 6 hours

## Cost
- [ ] Review FAL.AI dashboard for unexpected charges
- [ ] Review RunPod dashboard for unexpected charges
- [ ] Confirm per-user daily cap is working

## Observability
- [ ] Health check returns all deps "ok" (`curl -s https://genesisstudio.app/api/health`)
- [ ] Slack alerts channel exists and receives messages

## Compliance
- [ ] `/privacy` page loads
- [ ] `/terms` page loads
- [ ] Cookie consent banner appears on first visit
- [ ] Data export works (Settings → Export My Data)

## Documentation
- [ ] All runbooks present in `docs/runbooks/`
- [ ] Architecture diagram reviewed
- [ ] Operator playbook reviewed
- [ ] Developer guide tested (clone-to-running)

## Final Gate
- [ ] Scorecard reviewed and accepted
- [ ] Risk register reviewed
- [ ] PR approved and ready to merge
- [ ] Personally clicked through onboarding + generate + gallery flows

---

Operator signature: __________________   Date: __________
