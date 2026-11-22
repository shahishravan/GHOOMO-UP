# GhoomoUP repository audit

## Executive summary

This checkout began as a zero-build, single-page tourism prototype originally branded GhoomoBihar. Phase 1 converted the visitor experience to GhoomoUP. Phase 2 now adds a Supabase marketplace migration, RLS, private image storage, vendor-owned profiles/listings and a server-verified Netlify admin API. The migration and live policies have not been applied to or inspected in a linked Supabase project in this environment.

The app retains the Phase 1 `/scan/:slug` routing and active Uttar Pradesh destination data. Phase 2 uses the existing Supabase Auth and Netlify architecture for a shared marketplace. Inert Bihar seed/fallback code remains in the source and is not part of the active experience. The project does not claim that any QR code is installed at a physical site.

## Repository inventory

| Area | Files | Audit finding |
| --- | --- | --- |
| Frontend | `index.html` | One large HTML document containing markup, CSS and application JavaScript; no bundler or framework. |
| Destination data and artwork | `assets/destinations.js`, `assets/*-illustration.svg`, `assets/ghoomoup-mark.svg` | New structured active destination records and original illustrative SVG artwork. Other image assets are inherited Bihar material and are not used by the active UP experience. |
| Serverless functions | `netlify/functions/admin-auth.js`, `admin-marketplace.js`, `chat.js`, `listing-assistant.js` | Signed admin session, protected server-side review API and two Groq API proxies. |
| Hosting/routing | `netlify.toml` | Static root publish, functions directory, security headers and the `/scan/*` app rewrite. |
| Supabase | `supabase/tourism-feedback.sql`, `supabase/migrations/20261122030000_marketplace.sql` | Existing feedback table is extended, not recreated. Marketplace schema, storage, and RLS are defined in the new migration. |
| Tests | `tests/*.test.js` | Node smoke tests include marketplace migration/RLS invariants and admin API authorization. No package manifest or runner is declared. |
| Environment/setup | `.env.example`, `scripts/generate-admin-secrets.js`, `ADMIN-SECURITY-SETUP.md` | Supabase service-role access is server-only and required by the admin Function. The publishable key stays client-side. |
| Project documentation | `README.md`, `DATA-ARCHITECTURE.md`, `DISTRICT-EXPANSION-ROADMAP.md`, `FUTURE-SCOPE.md`, `JUDGE-DEMO-GUIDE.md`, `PROJECT_RULES.md`, `.gsd/`, `.agent/`, `.gemini/` | A large set of inherited Bihar and hackathon process documents. The GhoomoUP README and new `docs/` describe the active product; remaining planning/demo documents are not runtime modules and need a later documentation pass. |

No `package.json`, lockfile, build config, front-end framework, dedicated router, or browser automation dependency was found.

## Verified module findings

### Frontend

- Header, landing page, destination detail, service categories, provider/vendor flows, optional traveler profile, AI chat, QR preview, feedback, vendor dashboard and admin UI are implemented in `index.html`.
- Destination cards and details are data-driven from `assets/destinations.js`.
- Public cards load from `public_listings`, a database view restricted to approved and active listings. QR routes continue to filter by the matching destination code.
- Provider profile/listing changes and tourist inquiries use Supabase. Only the optional traveler prefill profile and tourism-feedback offline queue remain browser-local.
- The inherited Bihar seed records and local knowledge fallback remain as inactive source code. The app starts with an empty `DEFAULT_LISTINGS` array and does not call the legacy fallback; only destination data in `assets/destinations.js` drives the active experience. Existing Bihar photos remain in the repository but are not referenced by active destination data.
- The new destination illustrations are SVG artwork, not documentary photographs.

### Authentication and data

- Provider email/password authentication uses Supabase Auth. The publishable key is public; RLS enforces data access.
- The admin endpoint issues a signed `HttpOnly`, `Secure`, `SameSite=Strict` cookie. The marketplace Function verifies it and an active `admin_roles` row before using the server-only service key.
- Supabase retains `tourism_feedback` and its aggregate RPC, and now defines sites, vendors, listings, listing images, QR records, inquiries and admin roles.
- Public listing access is guarded by RLS and the approved-only view. Vendor writes are owner-scoped; vendor status changes use a database RPC and cannot set approval.

### Backend and AI

- `chat.js` proxies to Groq and applies a server-side GhoomoUP prompt. The UI has a local destination-knowledge fallback.
- `listing-assistant.js` generates a constrained listing draft from a provider-supplied brief. It does not save or approve a listing.
- Both functions require `GROQ_API_KEY`. Live upstream AI behavior cannot be validated without a configured key and reachable service.
- The two AI functions currently return wildcard CORS headers. Restrict origins and add abuse controls before production.

### QR discovery

- Netlify rewrites `/scan/*` to `index.html`; the client resolves active destination IDs/slugs, opens the matching detail and safely presents an unavailable state for unknown or inactive destinations.
- The preview currently asks an external QR image service to render the URL. If that service is unavailable, the UI shows an explicit preview error rather than a fake, non-scannable QR.
- No physical deployment, installed code, QR inventory or scan analytics were found.

## Existing bugs and limitations identified

| Finding | Status |
| --- | --- |
| Old QR fallback drew a decorative, non-functional image that looked like a real QR | Fixed: fallback now reports that the preview could not load. |
| Old destination QR used a hash fragment rather than a shareable site route | Fixed: links use `/scan/<slug>` and Netlify rewrites the route. |
| Unknown destination keys fell back to the old Jamui destination | Fixed: invalid/inactive destinations do not resolve and show a safe message. |
| A three-column destination-info layout and fixed-width cards overflowed on narrow mobile screens | Fixed and browser-checked at 320px. |
| Provider submissions were described as live before review | Fixed: copy now says private/pending until approved. |
| Database migration has not been run against the target Supabase project | Deployment prerequisite: inspect remote schema, apply feedback SQL if absent, then apply marketplace migration. |
| Admin moderation stores only the latest reviewer, timestamp and feedback | Add an immutable moderation-history table before production audit requirements. |
| AI gateway wildcard CORS and no request rate limiting | Existing hardening work; address before production. |
| Supabase/Google CDN/Groq services depend on external configuration and network access | No live service response is claimed by this audit. |

## Environment and dependencies

- Runtime: browser HTML/CSS/JavaScript; Netlify Functions use Node.js built-ins and HTTPS.
- No npm dependency installation or build command is required by this repository.
- Server environment: `GROQ_API_KEY`, admin secret variables, `ADMIN_ALLOWED_ORIGINS`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Supabase Auth additionally depends on the configured public project URL/key, email verification/recovery redirects and the deployed migration.
- The default admin origin in examples is illustrative. Set it to the actual GhoomoUP site origin before deployment.

## Scope and evidence

This audit is based on the checked-out files, source inspection and smoke/browser tests documented in [TESTING_REPORT.md](./TESTING_REPORT.md). No credentials were printed, no secret was added, and no deployment or physical QR installation was attempted.
