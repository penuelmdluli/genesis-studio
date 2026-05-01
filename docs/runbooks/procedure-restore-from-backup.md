# Procedure: Restore from Backup (Supabase PITR)

## When This Applies
- Accidental data deletion or corruption in the production database
- Need to recover to a specific point in time

## Prerequisites
- Supabase Pro plan or higher (PITR is not available on Free tier)
- Know the approximate timestamp of the last good state

## Steps
1. Go to Supabase Dashboard > Project Settings > Database > Backups
2. Select "Point in Time Recovery" tab
3. Choose the target recovery timestamp (UTC) — pick a time just before the incident
4. Click "Restore" — this creates a NEW project with the restored database
5. Verify the restored data in the new project:
   - Spot-check key tables (`users`, `generation_jobs`, `credit_transactions`)
   - Confirm the corrupted/deleted data is present
6. Migrate the restored data back to production:
   - Use `pg_dump` on the restored project to export affected tables
   - Use `psql` to import into production, being careful not to overwrite newer valid data
7. Alternatively, if full restore is needed: update environment variables to point to the new project

## Verification
- Affected data is restored and accessible in production
- Application functions normally with restored data
- Run a quick smoke test on auth, generation, and credit flows
- Document the incident timeline and root cause
