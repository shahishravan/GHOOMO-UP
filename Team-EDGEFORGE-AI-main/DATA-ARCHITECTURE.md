# GhoomoUP data architecture

This document describes the current prototype's storage boundaries. It distinguishes implemented behavior from the production data model needed in Phase 2.

## Current storage map

| Data | Current store | Shared across devices? | Notes |
| --- | --- | --- | --- |
| Destination content | `assets/destinations.js` | Yes, as deployed source | Varanasi, Ayodhya and Prayagraj are active; records include ID, district, slug, category, active status and image reference. |
| Provider listing drafts and moderation | `localStorage.ghoomoup_listings` | No | No fictional seed providers are loaded. Only approved listings are shown publicly. |
| Visitor inquiries | `localStorage.ghoomoup_requests` | No | A local copy of the inquiry is saved; the visitor must use the WhatsApp action to contact the provider. |
| Optional traveler profile | `localStorage.ghoomoup_traveler_profile` | No | Optional device-local form prefill, not a tourist login. |
| Provider display cache | `localStorage.ghoomoup_current_vendor` | No | UI cache only; Supabase Auth remains the identity authority. |
| Provider identity/session | Supabase Auth | Yes | Email/password provider accounts and email confirmation. |
| Tourism feedback | Supabase `tourism_feedback` | Yes when configured | RLS protects individual records; the public aggregate RPC returns counts only. |
| Admin session | Netlify Function + signed HttpOnly cookie | Session only | Credentials and signing secrets remain server-side. |
| AI credentials | Netlify environment | Server only | `GROQ_API_KEY` is not delivered to the browser. |

## Listing lifecycle

1. The application starts with an empty provider listing collection.
2. A signed-in provider submits a listing draft; it is saved to this browser and marked pending.
3. Admin approval changes the local record status.
4. Destination pages render only records whose status is `approved`.
5. Visitors may save an inquiry locally and continue to WhatsApp to contact the provider.

This is a prototype workflow, not a shared marketplace database. Provider listings, approval changes and inquiries do not synchronize across browsers; a local browser owner can alter local storage. Production approval must be enforced by an authorized backend/database policy.

## Supabase boundary

Supabase currently provides:

- provider authentication;
- `public.tourism_feedback`, protected by row-level security;
- `get_tourism_feedback_signals()`, a privacy-safe aggregate.

The repository does not include shared provider listing, approval history or inquiry tables. Do not claim those records are in Supabase.

## AI execution modes

| Mode | Trigger | Behavior |
| --- | --- | --- |
| Live AI | Netlify Function and Groq request succeed | Server prompt returns a concierge response or structured draft. Verify changing facts independently. |
| Local fallback | Function is missing, times out or returns no usable reply | Active UP destination data supplies general context; only approved local listings can be recommended. |

The in-browser trip outline is deterministic. It is not live navigation and does not provide verified travel times, availability or price quotes.

## Phase 2 data work

1. Add shared Supabase listings and inquiries tables with ownership, moderation state and audit history.
2. Enforce approved-only reads and authorized provider/admin writes using RLS and/or server functions.
3. Define retention/deletion for personal data and avoid copying tourist details into public analytics.
4. Add server-side validation, abuse controls, backups and operational monitoring.
5. Publish listings only after human review and keep a clear status trail.
