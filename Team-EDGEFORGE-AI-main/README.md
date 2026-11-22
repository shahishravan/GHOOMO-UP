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

## What is in the prototype

- Responsive homepage, destination detail pages and local service categories.
- Public listing display is restricted to records marked approved.
- Clear empty states; the UP experience does not contain fictional seed providers.
- Provider sign-up/sign-in through Supabase Auth and a listing-draft assistant.
- Admin sign-in through a Netlify Function and signed `HttpOnly` session cookie.
- GhoomoUP concierge backed by a Netlify Function/Groq, with a local destination fallback.
- Supabase tourism feedback table and privacy-safe aggregate RPC.
- Optional traveler profile; it is not required for browsing.
- WhatsApp and telephone contact paths. Inquiry/profile/listing records are currently browser-local.

See [the repository audit](docs/PROJECT_AUDIT.md), [architecture](docs/EXISTING_ARCHITECTURE.md), [module decisions](docs/KEEP_MODIFY_REPLACE_NEW.md), [testing report](docs/TESTING_REPORT.md), and [data architecture](DATA-ARCHITECTURE.md).

## Technology

- HTML, CSS and vanilla JavaScript; no front-end framework or build step.
- Netlify static hosting and Netlify Functions.
- Supabase Auth and Postgres for tourism feedback.
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

The Supabase URL and publishable client key are configured in the frontend and are public client values. Do not expose a Supabase `service_role` key or database password.

For Netlify deployment:

1. Use the repository root as the base and publish directory (`.`).
2. Keep `netlify/functions` as the Functions directory.
3. Configure the environment variables above and the Supabase Auth redirect URL for the deployed domain.
4. Run `supabase/tourism-feedback.sql` in the configured Supabase project and verify its RLS policies.
5. Test `/scan/varanasi`, `/scan/ayodhya`, and `/scan/prayagraj` on the deployed site.

## Tests

Run all repository smoke tests from the project root:

```powershell
Get-ChildItem tests\*.test.js | ForEach-Object { node $_.FullName }
```

These cover admin auth, retries, AI function input validation, feedback/RLS wiring, direct-local-impact disclosures, destination schema, scan routes, branding and the trip outline. Live Supabase, Netlify and Groq success requires deployed credentials and network access; tests do not claim those external services are live.

## Known limitations and Phase 2

- Provider listings, approval changes, traveler profiles and inquiries are stored in the current browser's `localStorage`; they are not shared across devices.
- A tourist inquiry is not a reservation. The app does not process payments.
- Admin listing management is not a centralized production moderation system while listing records remain local.
- Supabase, Groq and the external QR image renderer require network access and site configuration.
- AI gateway CORS is currently permissive and rate limiting is not implemented.
- No physical QR installation or scan analytics is provided.

Phase 2 should add a shared Supabase listings/inquiries schema with ownership and server-enforced approval, moderation audit history, production provider verification and review, restricted AI CORS/rate limits, observability, content-source review and operational QR deployment tracking.

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
├── tests/
├── netlify.toml
└── README.md
```
