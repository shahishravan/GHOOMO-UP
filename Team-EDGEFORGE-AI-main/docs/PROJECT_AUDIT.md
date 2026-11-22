# GhoomoUP repository audit

## Executive summary

This checkout is a zero-build, single-page tourism prototype originally branded GhoomoBihar. It already contains useful responsive UI, vendor Supabase authentication, a server-verified admin session, Netlify AI functions, tourism feedback, local listing moderation and WhatsApp contact flows. The marketplace records and moderation state are browser-local; this is not a shared production marketplace.

Phase 1 reuses those flows, replaces active destination data and visitor-facing content with Uttar Pradesh destinations, prevents inherited Bihar seed listings from loading, and adds `/scan/:slug` routing. Inert Bihar seed/fallback code remains in the source and is not part of the active experience. The project does not claim that any QR code is installed at a physical site.

## Repository inventory

| Area | Files | Audit finding |
| --- | --- | --- |
| Frontend | `index.html` | One large HTML document containing markup, CSS and application JavaScript; no bundler or framework. |
| Destination data and artwork | `assets/destinations.js`, `assets/*-illustration.svg`, `assets/ghoomoup-mark.svg` | New structured active destination records and original illustrative SVG artwork. Other image assets are inherited Bihar material and are not used by the active UP experience. |
| Serverless functions | `netlify/functions/admin-auth.js`, `chat.js`, `listing-assistant.js` | Admin session gateway and two Groq API proxies. No listing or inquiry API exists. |
| Hosting/routing | `netlify.toml` | Static root publish, functions directory, security headers and the `/scan/*` app rewrite. |
| Supabase | `supabase/tourism-feedback.sql`; inline client setup in `index.html` | Supabase Auth is used for provider accounts; the feedback table and aggregate RPC are in Supabase. No listings or inquiries schema is present. |
| Tests | `tests/*.test.js` | Node smoke tests for admin auth, retries, feedback, impact, planner, brand and destination/QR foundation. No package manifest or test runner is declared. |
| Environment/setup | `.env.example`, `scripts/generate-admin-secrets.js`, `ADMIN-SECURITY-SETUP.md` | Groq and admin secrets are expected in Netlify environment variables; local secret generation is available. The Supabase publishable key is client-side by design and is not a service-role secret. |
| Project documentation | `README.md`, `DATA-ARCHITECTURE.md`, `DISTRICT-EXPANSION-ROADMAP.md`, `FUTURE-SCOPE.md`, `JUDGE-DEMO-GUIDE.md`, `PROJECT_RULES.md`, `.gsd/`, `.agent/`, `.gemini/` | A large set of inherited Bihar and hackathon process documents. The GhoomoUP README and new `docs/` describe the active product; remaining planning/demo documents are not runtime modules and need a later documentation pass. |

No `package.json`, lockfile, build config, front-end framework, dedicated router, migration for listings, or browser automation dependency was found.

## Verified module findings

### Frontend

- Header, landing page, destination detail, service categories, provider/vendor flows, optional traveler profile, AI chat, QR preview, feedback, vendor dashboard and admin UI are implemented in `index.html`.
- Destination cards and details are data-driven from `assets/destinations.js`.
- The public detail view filters listings to `status === "approved"`.
- Provider submissions, inquiries, traveler profile and moderation changes use `localStorage`; they do not sync across browsers.
- The inherited Bihar seed records and local knowledge fallback remain as inactive source code. The app starts with an empty `DEFAULT_LISTINGS` array and does not call the legacy fallback; only destination data in `assets/destinations.js` drives the active experience. Existing Bihar photos remain in the repository but are not referenced by active destination data.
- The new destination illustrations are SVG artwork, not documentary photographs.

### Authentication and data

- Provider email/password authentication uses the existing Supabase JS client and an existing Supabase project URL/publishable key in `index.html`. The key is public; database policies and account authorization must enforce access.
- The admin endpoint hashes and verifies credentials in Netlify and issues an expiring signed `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
- Supabase is used for the `tourism_feedback` table and `get_tourism_feedback_signals()` aggregate. There is no central provider-listing, moderation or inquiry table.
- Public listing approval is enforced by frontend rendering; because records are local-only, this is a prototype moderation boundary, not a server-enforced production authorization boundary.

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
| Approval/dashboard records and tourist inquiries persist only in the current browser | Existing design limitation; production listings and inquiries need a shared database and server-side authorization. |
| AI gateway wildcard CORS and no request rate limiting | Existing hardening work; address before production. |
| Supabase/Google CDN/Groq services depend on external configuration and network access | No live service response is claimed by this audit. |

## Environment and dependencies

- Runtime: browser HTML/CSS/JavaScript; Netlify Functions use Node.js built-ins and HTTPS.
- No npm dependency installation or build command is required by this repository.
- Server environment: `GROQ_API_KEY`, `ADMIN_USER_ID_HASH`, `ADMIN_PASSWORD_SALT`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, and `ADMIN_ALLOWED_ORIGINS`.
- Supabase Auth additionally depends on the configured public project URL/key, provider email-confirmation settings and deployed database policies.
- The default admin origin in examples is illustrative. Set it to the actual GhoomoUP site origin before deployment.

## Scope and evidence

This audit is based on the checked-out files, source inspection and smoke/browser tests documented in [TESTING_REPORT.md](./TESTING_REPORT.md). No credentials were printed, no secret was added, and no deployment or physical QR installation was attempted.
