# Existing architecture

## Runtime shape

GhoomoUP remains a static single-page application with serverless helpers:

```text
Mobile browser
  ├─ index.html (markup, CSS, UI/controller code)
  ├─ assets/destinations.js (destination records)
  ├─ assets/*.svg (brand and destination illustrations)
  ├─ localStorage (provider listings, inquiries, optional traveler profile)
  ├─ Supabase Auth + tourism_feedback / aggregate RPC
  ├─ Netlify Functions
  │    ├─ admin-auth → signed admin session cookie
  │    ├─ chat → Groq completion
  │    └─ listing-assistant → Groq listing draft
  └─ WhatsApp / telephone deep links
```

There is no front-end build step or npm manifest. The existing app is served as static files; Netlify hosts the functions and rewrites destination scan routes to the app document.

## Visitor flow

```text
QR URL (/scan/:slug)
  → active destination lookup
  → destination information and service-category filters
  → approved listing cards, or an explicit empty state
  → WhatsApp / telephone contact
```

Tourists can browse without an account. There is no payment step, full booking engine or live GPS navigation. The optional inquiry form stores a copy locally and offers direct WhatsApp contact; it does not transmit a reservation to a backend.

## Destination model

`assets/destinations.js` exports `window.GHOOMOUP_DESTINATIONS`. Each record contains:

```text
id, name, district, slug, description, tourismCategory,
active, image
```

Presentation fields are colocated with each record so adding a reviewed destination does not require adding another UI branch. Only active records appear in the landing gallery or resolve through `/scan/:slug`. Varanasi, Ayodhya and Prayagraj are active; Agra, Mathura-Vrindavan, Lucknow and Sarnath are prepared as future rollout candidates, not active destinations.

## Data ownership and trust boundary

| Data | Current store | Production caveat |
| --- | --- | --- |
| Destination information | Static destination data file | Changes require a deploy; content review is manual. |
| Provider listing drafts and approvals | `localStorage.ghoomoup_listings` | Browser-specific and client-controlled; not a production moderation system. |
| Provider inquiries | `localStorage.ghoomoup_requests` | Browser-specific; not delivered to a provider unless the tourist separately uses WhatsApp. |
| Optional traveler profile | Browser `localStorage` | Device-local convenience only. |
| Provider identity/session | Supabase Auth | Requires project configuration and email confirmation. |
| Tourism feedback | Supabase `tourism_feedback` with RLS; local fallback | Shared only when the Supabase table/RPC is configured and reachable. |
| Admin session | Netlify Function + signed HttpOnly cookie | Admin credentials and session key stay in Netlify environment variables. |
| AI requests | Netlify Functions → Groq | Requires server-side Groq key; upstream response is not a guaranteed source of truth. |

The public UI shows only approved listing records. In the current prototype those records and approval changes are local to one browser. Production approval must be enforced by server/database authorization and shared records.

## Authentication

- Providers use Supabase email/password authentication.
- Tourists do not need to register or log in.
- The optional traveler profile is stored locally, not authenticated.
- Admin credentials are checked by `netlify/functions/admin-auth.js`; a signed, expiring cookie is used for the session.

## AI

- `netlify/functions/chat.js` is the remote concierge gateway.
- The local fallback reads the active destination data and recommends only approved listings.
- `netlify/functions/listing-assistant.js` generates a structured draft from a vendor's text; a human must review it and admin approval remains separate.
- The deterministic trip-outline helper is not a route planner or price quote. It avoids invented travel times and provider costs.

## QR handling

- Netlify's `/scan/*` rewrite serves `index.html` without changing the address.
- Client routing accepts only a matching active record ID or slug.
- Unknown/inactive values show an unavailable message rather than silently selecting another destination.
- QR previews point to the destination route. Preview generation uses an external QR rendering service and clearly disclaims physical installation.

## Deployment requirements

1. Publish the repository root and keep `netlify/functions` as the functions directory.
2. Set `ADMIN_ALLOWED_ORIGINS` to the deployed origin and configure all admin secrets.
3. Configure `GROQ_API_KEY` for live AI; the app's local fallback does not require it.
4. Configure Supabase Auth redirect URLs for the deployed domain, run `supabase/tourism-feedback.sql`, and verify RLS.
5. Before production listings, migrate listings and inquiries to a database, enforce moderation server-side, add rate limiting and narrow AI CORS.
