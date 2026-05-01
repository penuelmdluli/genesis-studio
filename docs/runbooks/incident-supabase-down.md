# Incident: Supabase Down

## Symptoms
- Health check returns `supabase: "error"`
- All authenticated routes fail
- Sign-up creates Clerk account but no user row

## Diagnosis
1. Check Supabase status: https://status.supabase.com
2. Check project: Supabase Dashboard → Project → check if paused
3. Try direct query: `curl -s https://quliaphgimytmqkwadqu.supabase.co/rest/v1/users?select=id&limit=1 -H "apikey: <anon_key>"`

## Fix
1. If Supabase outage: wait. Only video playback works (R2 direct).
2. If project paused (free tier inactivity): resume in dashboard
3. If connection pool exhausted: check for connection leaks in code

## Verification
- Health check returns `supabase: "ok"`
- Dashboard loads with user data
