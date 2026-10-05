# Supabase preparation

The migration in `migrations/` was applied to the configured project on October 3, 2026 and verified through all 13 expected tables plus a temporary FAQ CRUD lifecycle.

Access model:

- Supabase Auth owns identities in `auth.users`.
- An active matching `admin_users` row grants dashboard access.
- Viewers can read knowledge; editors and admins can manage it.
- Audit records are append-only to authenticated editors/admins.
- No anonymous table policies are created.
- Backend service-role access bypasses RLS and must only be used in trusted server code.

Apply migrations only after creating a Supabase project and reviewing them in a staging environment, using the Supabase CLI workflow (`supabase link`, then `supabase db push`).
