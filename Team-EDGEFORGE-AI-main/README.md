# GhoomoUP

**Uttar Pradesh's heritage, one scan away.**

GhoomoUP is a mobile-first tourism discovery experience built around:

```text
SCAN → BROWSE → CONNECT
```

Visitors can open a destination page from a QR URL, explore destination information and approved local services, then contact a provider by WhatsApp or phone. Browsing does not require an app, a tourist account, a payment or a booking engine.

## Active destinations

| Destination | District | URL |
| --- | --- | --- |
| Varanasi | Varanasi | `/scan/varanasi` |
| Ayodhya | Ayodhya | `/scan/ayodhya` |
| Prayagraj | Prayagraj | `/scan/prayagraj` |

Destination records live in `assets/destinations.js`, separate from UI code. The same record shape can support Agra, Mathura-Vrindavan, Lucknow and Sarnath after local content and provider review. The current SVG destination artwork is illustrative, not documentary photography.

**QR previews are not proof of installation.** No physical QR placement is represented by this repository.

## Marketplace features

- Responsive homepage, destination detail pages and local service categories.
- Central Supabase-backed listings filtered by destination and category; only active, approved services are public.
- Vendor email verification, login/logout, password recovery, business profile, private drafts, photo upload, listing edits and moderation feedback.
- Admin review through a Netlify Function; the signed `HttpOnly` session is checked against an active `admin_roles` record before privileged database access.
- Private Supabase Storage photos with vendor-owned upload paths and public signed access only for approved listings.
- Inquiry and WhatsApp-click events. Contact clicks are not bookings.
- GhoomoUP concierge backed by a Netlify Function/Groq, with a local destination fallback.
- Supabase tourism feedback table and privacy-safe aggregate RPC.
- Optional traveler profile; it is not required for browsing.
- WhatsApp and telephone contact paths. QR routes continue to open `/scan/<slug>`.

See [the repository audit](docs/PROJECT_AUDIT.md), [architecture](docs/EXISTING_ARCHITECTURE.md), [marketplace API and database setup](docs/MARKETPLACE_API.md), [module decisions](docs/KEEP_MODIFY_REPLACE_NEW.md), [testing report](docs/TESTING_REPORT.md), and [data architecture](DATA-ARCHITECTURE.md).

## Technology

- HTML, CSS and vanilla JavaScript; no front-end framework or build step.
- Netlify static hosting and Netlify Functions.
- Supabase Auth, Postgres with RLS, and private Supabase Storage.
- Groq API for optional live AI responses.

This repository has no `package.json`. Node.js is used to run the smoke tests and is needed by Netlify Functions.

## Run locally

To preview the homepage and static UI:

```powershell
python -m http.server 8080
```

Open `http://localhost:8080`. A basic static server does not rewrite nested `/scan/*` URLs and does not provide Netlify Functions; use Netlify Dev to test those integrations:

```powershell
netlify dev
```

## Environment and deployment

Copy `.env.example` to a local `.env` only for local Netlify development. Never commit real values.

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Server-side key for the concierge and listing assistant. |
| `ADMIN_USER_ID_HASH` | SHA-256 hash of the private admin user ID. |
| `ADMIN_PASSWORD_SALT` | Random salt used for admin password verification. |
| `ADMIN_PASSWORD_HASH` | Scrypt password hash. |
| `ADMIN_SESSION_SECRET` | Key used to sign the expiring admin cookie. |
| `ADMIN_ALLOWED_ORIGINS` | Comma-separated allowed admin login origins; set this to the deployed GhoomoUP origin. |
| `SUPABASE_URL` | Supabase project URL for the server-side admin marketplace function. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by Netlify for admin operations; never expose it to browsers. |

The Supabase URL and publishable client key are configured in the frontend and are public client values. Do not expose a Supabase `service_role` key or database password.

For Netlify deployment:

1. Use the repository root as the base and publish directory (`.`).
2. Keep `netlify/functions` as the Functions directory.
3. Configure the environment variables above and the Supabase Auth redirect URL for the deployed domain.
4. Inspect the target schema. Apply `supabase/tourism-feedback.sql` only if `tourism_feedback` is absent, then apply `supabase/migrations/20261122030000_marketplace.sql`. The marketplace migration stops if its tables already exist; reconcile them rather than running a duplicate schema.
5. Add the configured admin identifier hash to `admin_roles` and confirm email-verification and recovery redirect URLs.
6. Test `/scan/varanasi`, `/scan/ayodhya`, and `/scan/prayagraj` and the vendor/admin flows on the deployed site.

## Tests

Run all repository smoke tests from the project root:

```powershell
Get-ChildItem tests\*.test.js | ForEach-Object { node $_.FullName }
```

These cover admin auth, retries, AI function input validation, feedback/RLS wiring, marketplace schema and admin authorization, direct-local-impact disclosures, destination schema, scan routes, branding and the trip outline. Live Supabase, Netlify and Groq success requires configured credentials and network access; local smoke checks do not claim those external services are live.

## Known limitations and hardening

- Marketplace migrations and live Supabase policies have not been applied or verified against a linked Supabase project in this environment.
- Inquiry submissions store tourist names, phone numbers and notes for the listing owner/admin. Keep access limited and define a retention policy before production.
- A tourist inquiry is not a reservation. The app does not process payments.
- Admin roles must be provisioned explicitly, and the admin API requires the Netlify service-role environment variable.
- Supabase, Groq and the external QR image renderer require network access and site configuration.
- AI gateway CORS is currently permissive and rate limiting is not implemented.
- No physical QR installation or scan analytics is provided.

Next hardening steps are immutable moderation history, inquiry retention/consent controls, AI rate limits and restricted CORS, operational monitoring, content-source review and QR deployment tracking.

## Repository

```text
.
├── assets/
│   ├── destinations.js
│   ├── ghoomoup-mark.svg
│   └── *-illustration.svg
├── docs/
│   ├── EXISTING_ARCHITECTURE.md
│   ├── KEEP_MODIFY_REPLACE_NEW.md
│   ├── PROJECT_AUDIT.md
│   └── TESTING_REPORT.md
├── index.html
├── netlify/
│   └── functions/
├── supabase/
│   └── migrations/
├── docs/
├── tests/
├── netlify.toml
└── README.md
```
