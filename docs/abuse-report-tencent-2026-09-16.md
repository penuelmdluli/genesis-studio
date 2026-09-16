# Abuse report — Tencent Cloud (43.157.207.161)

**Status: SENT 2026-09-16 via Resend (id 87bdcdd9-bac3-4ca1-b251-b8f6ede144bf), from support@ivideostudio.ai to abuse@tencent.com, cc qcloud_net_duty@tencent.com.**

- **To:** abuse@tencent.com
- **Cc:** qcloud_net_duty@tencent.com
- **From:** support@ivideostudio.ai (confirm before sending)
- **Subject:** Abuse report: automated fraudulent account creation from 43.157.207.161 (15–16 Sep 2026 UTC)

---

Dear Tencent Cloud Abuse Team,

We operate iVideo Studio (https://ivideostudio.ai), an AI video generation service based in South Africa. We are reporting sustained automated abuse originating from an IP address in your range.

**Source address**

- IP: `43.157.207.161`
- Range: `43.157.192.0 – 43.157.255.255` (ACEVILLEPTELTD-SG), listed abuse contact `abuse@tencent.com`

**What is happening**

An automated client is mass-registering fraudulent accounts on our service to harvest the free trial credits attached to each new account. Those credits pay for GPU video generation, so each fraudulent account is a direct financial loss to us.

Between **2026-09-15 22:27 UTC and 2026-09-16 05:19 UTC** we recorded **41 fraudulent registrations** in this campaign. The accounts share an unmistakable signature:

- randomly generated Gmail local parts (`ckgqs696@`, `gvopx647@`, `mxaaw930@`, `jqtvx728@`, `ncrmk395@`), plus addresses at non-existent domains
- a small pool of recycled display names reused across dozens of accounts
- registrations arriving in bursts, one every one to two minutes
- an identical browser signature on every request: `Mozilla/5.0 (Linux; Android 15; 25062RN2DY Build/AQ3A.250226.002)`

Roughly 20 paid GPU generations were consumed before we contained it.

**Log extract (UTC, from our registration records)**

```
2026-09-16 04:32:07  register  ckgqs696@gmail.com  43.157.207.161  Android 15; 25062RN2DY
2026-09-16 04:34:04  register  gvopx647@gmail.com  43.157.207.161  Android 15; 25062RN2DY
2026-09-16 04:35:13  register  mxaaw930@gmail.com  43.157.207.161  Android 15; 25062RN2DY
```

Per-request IP logging was deployed partway through the campaign, so these three registrations are the ones captured with the source address attached. The remaining 38 accounts from the same period carry the identical browser signature and behavioural pattern. Full logs are available on request.

**Continuation after blocking**

After we blocked `43.157.207.161`, the same client resumed within minutes from `140.213.114.235` (an Indonesian mobile network), presenting the identical browser signature. This suggests the actor is routing traffic through your infrastructure rather than operating from it directly, which may indicate a proxy or VPN service running on the address.

**What we have done**

We have blocked the address range and the client signature, suspended all fraudulent accounts, and now require email confirmation before any credits are issued. No further accounts are being created successfully. We are not seeking compensation.

**What we ask**

Please investigate `43.157.207.161` for breach of your acceptable use policy and take whatever action you consider appropriate to stop automated fraudulent registration originating from it.

We are happy to supply complete timestamped logs, the full account list, or any other evidence your team needs. Please reference this report in any reply.

Kind regards,

Sabelo Mdluli
iVideo Studio — https://ivideostudio.ai
support@ivideostudio.ai

---

## Before sending

1. Confirm the sending mailbox (`support@ivideostudio.ai` reaches you and can receive their reply).
2. Tencent also accepts reports through the console abuse form; email to `abuse@tencent.com` is the documented route and is what this draft targets.
3. Expect either no reply or a ticket acknowledgement. Datacentre providers act on this more often than mobile carriers do, which is why we are not reporting `140.213.114.235`.
