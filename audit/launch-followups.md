# Launch Followups

## BLOCKING (must complete before launch)

(Populated as Phase 5-6 execute)

## POST-LAUNCH MONTH 1

### Phase 1 deferral: FAL assembly removal
- `src/lib/genesis-brain/assembly.ts` lines 99-291 contain ~190 lines of disabled FAL assembly code inside `startAssembly()`, wrapped in `if (false as boolean)`.
- Local FFmpeg assembly via `assembly-fallback.ts` is the active path.
- Safe to delete the `if(false)` block once the team confirms FAL assembly won't be re-enabled. The `pollAssembly()` function (line 300+) and all assembly state machine logic must be preserved.

### Pre-existing test failure: brain.test.ts DEFAULT_MODEL mismatch
- `src/lib/genesis-brain/brain.test.ts:519` expects `seedance-1.5` but planner forces `wan-2.2`. Test comment says "Seedance is primary" which is outdated. Fix the test to expect `wan-2.2` or update if the default model changes.

### Payment processor consolidation (Commit 16 deferred)
- Yoco and PayFast serve overlapping SA market. Plan was to hide them behind feature flags and consolidate to Stripe + Paystack. Deferred because:
  1. Existing subscribers may have active Yoco/PayFast subscriptions
  2. Webhook handlers must remain active regardless
  3. UI changes to pricing/checkout flow need careful testing
- Action: month 1 post-launch, add analytics to measure conversion per processor, then decide

### Internal namespace reorganization (Commit 18 deferred)
- Plan was to move `src/lib/intelligence/` and `src/lib/studio/` under `src/lib/internal/`. Deferred because:
  1. 50+ import paths would need updating across the codebase
  2. High risk of breaking changes with little launch-blocking value
  3. Owner-only route gating (already done in Commit 7) achieves the security goal
- Action: month 2 post-launch, batch with other refactoring work

## POST-LAUNCH MONTH 2

## POST-LAUNCH MONTH 3+

## DEFERRED / WON'T FIX
