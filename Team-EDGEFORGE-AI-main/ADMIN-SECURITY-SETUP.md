# Secure admin setup

GhoomoUP admin authentication uses the existing Netlify function rather than Supabase Auth. The browser sends credentials over HTTPS to `netlify/functions/admin-auth.js`. The function verifies salted password hashes and returns a signed, expiring `HttpOnly`, `Secure`, `SameSite=Strict` cookie.

The moderation endpoint, `netlify/functions/admin-marketplace.js`, verifies the cookie signature/expiry and checks for a matching active `admin_roles` record before it uses the Supabase service-role key. Vendors cannot call admin operations from their dashboard or set their own listing to approved.

## Required configuration

Configure these values in Netlify environment variables, never in the frontend or source control:

| Variable | Purpose |
| --- | --- |
| `ADMIN_USER_ID_HASH` | SHA-256 hash of the admin user ID; also used to provision the database role |
| `ADMIN_PASSWORD_SALT` | Random salt used by scrypt |
| `ADMIN_PASSWORD_HASH` | scrypt output for the password and configured salt |
| `ADMIN_SESSION_SECRET` | Random signing key for the session cookie |
| `ADMIN_ALLOWED_ORIGINS` | Exact comma-separated trusted site origins |
| `SUPABASE_URL` | Supabase project URL for the server function |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for protected moderation operations |

Set Supabase browser URL and publishable/anon key through the existing frontend configuration. Never use the service-role key in browser code.

After inspecting and applying the marketplace migration, provision the administrator hash in Supabase SQL Editor:

```sql
insert into public.admin_roles (admin_identifier_hash, role)
values ('<ADMIN_USER_ID_HASH>', 'admin');
```

Use the value already configured in Netlify; do not commit it. An active matching row is required. Set `is_active = false` to revoke database authorization without changing the cookie signing secret.

## Boundaries

- The cookie is inaccessible to frontend JavaScript. As with any website, a device owner can inspect values they personally type and their own browser requests.
- Admin session authorization is separate from vendor Supabase Auth.
- Database RLS remains active. Admin read/write operations are performed server-side after role verification; the service role bypasses RLS and must remain tightly scoped to this function.
- Keep origin checks, safe response errors and request bounds in place. Configure rate limiting at the hosting/WAF layer before public production use.
- Contact and inquiry records may contain tourist PII; protect them from public reads and establish retention procedures before launch.

## Deployment checklist

1. Inspect the live schema before applying the additive migration; do not assume the deployed project matches this checkout.
2. Confirm Supabase email-verification and password-recovery redirects include the deployed GhoomoUP origin.
3. Configure the environment variables above and redeploy Netlify.
4. Provision and verify the admin role hash.
5. Test unauthorized, inactive-role, approved and rejected moderation calls in the deployed environment.

No live Netlify or Supabase project was configured for the current development session, so deployment-side configuration remains unverified.
