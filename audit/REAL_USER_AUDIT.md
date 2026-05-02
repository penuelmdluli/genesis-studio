# Real User Audit — 2026-05-02

## User: goodnessbaloyiberry2@gmail.com
- **Created:** 2026-05-02 07:45:37 UTC
- **Plan:** free
- **Credit balance:** 10
- **Clerk ID:** (in DB)
- **User ID:** 9988f09a-71d5-4b7e-a93e-d2af9c59b612

### Jobs (2 total)

**Job 1:** `8bfda850...` (FAILED)
- Model: wan-2.2
- Status: failed
- Created: 2026-05-02 07:52:20
- Error: "Generation timed out after 30 minutes. Credits have been refunded."
- Output: NO_VIDEO
- Credits cost: 40
- Refund: YES — 40 credits refunded at 09:20:13

**Job 2:** `dfca19e5...` (STUCK — QUEUED)
- Model: wan-2.2
- Status: **queued** (for 5+ hours)
- Created: 2026-05-02 09:23:19
- RunPod job ID: 451158a2-c586-400f-bb3c-73059077b49d-u2
- Output: NO_VIDEO
- Credits cost: 40
- Refund: **NOT YET** — job still in "queued" status
- Prompt: "Create an African baby girl aged 3 years wearing modern clothes dancing to celebrate me by ingarose"

### Credit Ledger Analysis

| Event | Amount | Running Total | Source |
|---|---|---|---|
| Signup grant | +50 | 50 | NOT in credit_transactions (deducted directly from user.credit_balance) |
| Job 1 deduction | -40 | 10 | NOT in credit_transactions |
| Job 1 refund | +40 | 50 | In credit_transactions |
| Job 2 deduction | -40 | 10 | NOT in credit_transactions |

**Ledger inconsistency:** Only the refund is recorded in `credit_transactions`. The signup grant and both deductions were applied directly to `users.credit_balance` without ledger entries. The current balance of 10 is arithmetically correct (50 - 40 + 40 - 40 = 10) but the ledger is incomplete.

### Status: STUCK JOB — OPERATOR ACTION REQUIRED

**Immediate actions needed:**
1. **Fail the stuck job** — it's been queued 5+ hours on dead RunPod Wan 2.2
2. **Refund 40 credits** — user was charged but received nothing
3. **Consider contacting the user** — they had two failed attempts in a row, likely frustrated
4. **Root cause:** Wan 2.2 RunPod endpoint is cold/dead. This user's prompts specifically request dance content which routes to Wan 2.2. The sample prompts were switched to Seedance 1.5 for onboarding, but direct generation still allows Wan 2.2 selection.

---

## User: iteverycode@gmail.com (operator test account)
- Credits: 50, Plan: free
- Jobs: 0
- Ledger: 0 entries
- Status: Clean — no action needed

## User: mdlulispm@gmail.com (operator account)
- Credits: 50,080, Plan: free (owner bypass)
- Jobs: 4 (1 completed Seedance, 3 failed Wan 2.2)
- Status: Clean — owner account

## User: mdlulipenuel@gmail.com (dev account)
- Credits: 60,556, Plan: free (owner bypass)
- Status: Clean — dev account
