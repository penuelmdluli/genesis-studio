# Procedure: Handle Chargeback (Stripe / PayFast)

## When This Applies
- Stripe sends a `charge.dispute.created` webhook event
- PayFast notifies of a dispute via ITN or email

## Steps
1. Identify the user and transaction from the dispute details (customer email, charge ID)
2. Pull usage data: query `generation_jobs` and `credit_transactions` for the user during the disputed period
3. Gather evidence:
   - Account creation date and login history (Clerk)
   - Credits purchased vs credits consumed
   - Videos generated (with timestamps)
   - Terms of Service acceptance timestamp
4. **Stripe**: Submit evidence via Dashboard > Disputes or API `POST /v1/disputes/{id}` with evidence object
5. **PayFast**: Respond to PayFast's dispute email with evidence within the deadline
6. Suspend the user's account if chargeback appears fraudulent (Clerk > suspend user)
7. Deduct credits equivalent to the disputed amount if not already done

## Verification
- Dispute response submitted before the deadline (usually 7-21 days)
- User account suspended if fraud suspected
- Log the dispute in the internal incidents channel for tracking
