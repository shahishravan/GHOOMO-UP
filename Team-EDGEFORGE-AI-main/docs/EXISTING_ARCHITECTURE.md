# Existing architecture

## Runtime shape

GhoomoUP remains a static single-page application with serverless helpers:

```text
Mobile browser
  ├─ index.html (markup, CSS and UI/controller code)
  ├─ assets/destinations.js (active UP destination records)
  ├─ assets/marketplace-api.js (Supabase marketplace client)
  ├─ Supabase Auth + Postgres RLS + private listing-image Storage
  ├─ Netlify Functions
  │    ├─ admin-auth → signed admin session cookie
  │    ├─ admin-marketplace → role-checked moderation API
  │    ├─ chat → Groq completion
  │    └─ listing-assistant → Groq listing draft
  └─ WhatsApp / telephone deep links
```

There is no front-end build step or npm manifest. Netlify hosts the functions and rewrites destination scan routes to the app document.

## Visitor flow

```text
QR URL (/scan/:slug)
  → active destination lookup
  → destination information and service-category filters
  → approved, active Supabase listings for that destination
  → optional inquiry or direct WhatsApp / telephone contact
```

Tourists can browse without an account. There is no payment step, booking engine or live GPS navigation. An inquiry is not a reservation. The optional inquiry form stores contact details in Supabase for that listing's owner/admin; WhatsApp remains the primary contact channel.

## Destination model

`assets/destinations.js` exports `window.GHOOMOUP_DESTINATIONS`. Each record contains `id`, `name`, `district`, `slug`, `description`, `tourismCategory`, `active` and `image`, plus presentation fields. Varanasi, Ayodhya and Prayagraj are active; Agra, Mathura-Vrindavan, Lucknow and Sarnath are future rollout candidates. The database migration seeds matching `sites` and planned QR-route records without claiming physical installation.

## Data ownership and trust boundary

| Data | Current store | Access |
| --- | --- | --- |
| Destination content | Static data file + Supabase `sites` | Frontend presentation and database association; only active database sites can receive listings. |
| Public directory | `public.public_listings` view | Anonymous read of approved, active listing details and public contact fields only. |
| Provider profiles | Supabase Auth + `vendors` | Owner-only profile management; contact fields are exposed publicly only for approved listings. |
| Provider listings/moderation | Supabase `listings` + RLS | Vendor owns profile/listings; status changes use a database workflow and cannot be self-approved. |
| Listing photographs | Private `listing-images` bucket + `listing_images` | Owner upload/read; signed reads are allowed to the public only for approved listings. |
| Inquiries/contact events | Supabase `inquiries` + RLS | Listing owner/admin can read inquiry PII; anonymous contact-click events contain no tourist details. |
| Optional traveler profile | Browser `localStorage` | Device-local convenience only. |
| Tourism feedback | Existing Supabase `tourism_feedback` with RLS; local fallback | Shared submission and aggregate when Supabase is configured/reachable. |
| Admin session/data access | Netlify signed-cookie functions + `admin_roles` | Session, active role and server-only service key are checked before admin data/actions. |
| AI requests | Netlify Functions → Groq | Server-side Groq key; upstream response is not a guaranteed source of truth. |

The public view and storage policies filter out pending, rejected, draft and inactive listings. Vendors can edit only their own rows; trigger and RPC rules protect moderation status. Admin mutations are proxied through Netlify and are not permitted from the vendor browser.

## Authentication

- Providers use Supabase email/password authentication, email verification, password recovery and a database-backed profile.
- Tourists do not need to register or log in.
- The optional traveler profile is stored locally, not authenticated.
- Admin credentials are checked by `admin-auth.js`; `admin-marketplace.js` additionally verifies the signed cookie and a matching active `admin_roles` row before using Supabase service-role access.

## AI

- `netlify/functions/chat.js` is the remote concierge gateway.
- The local fallback reads active destination data and recommends approved listings returned by the marketplace.
- `netlify/functions/listing-assistant.js` generates a structured draft from a provider's text; a human must review it and approval remains separate.
- The deterministic trip outline is not a route planner or price quote.

## QR handling

- Netlify's `/scan/*` rewrite serves `index.html` without changing the address.
- Client routing accepts only a matching active record ID or slug.
- Unknown/inactive values show an unavailable message rather than silently selecting another destination.
- QR previews point to the destination route. Preview generation uses an external QR rendering service and disclaims physical installation.

## Deployment requirements

1. Publish the repository root and keep `netlify/functions` as the functions directory.
2. Inspect the target Supabase schema. Apply `tourism-feedback.sql` only if the existing feedback table is absent, then apply `supabase/migrations/20261122030000_marketplace.sql`.
3. Configure Supabase Auth verification/recovery redirects and the server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` variables.
4. Configure `ADMIN_ALLOWED_ORIGINS`, admin secrets, and provision the configured admin-ID hash in `admin_roles`.
5. Configure `GROQ_API_KEY` for live AI; test all three `/scan/{slug}` routes and the vendor/admin workflows after deployment.

This checkout has no linked Supabase project or local database; migration application and live RLS are deployment prerequisites, not verified here.
