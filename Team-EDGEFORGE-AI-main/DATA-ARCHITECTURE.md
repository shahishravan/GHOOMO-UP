# GhoomoUP data architecture

## Data sources

| Domain | Source of truth | Public exposure |
| --- | --- | --- |
| Destination content | `assets/destinations.js`; matched to `public.sites` by stable code/slug | Active destination details and QR routes |
| Vendor identity | Supabase Auth | None |
| Vendor business profile | `public.vendors` | Contact fields only when an approved, active listing exists |
| Service listings | `public.listings` | `public.public_listings` view only |
| Listing photographs | Private Supabase Storage bucket `listing-images`, indexed by `public.listing_images` | Time-limited signed URLs for approved listings |
| QR routes | `public.qr_codes` | Active routes for active sites; installation status is separately tracked |
| Tourist contact | `public.inquiries` | No public reads; listing owner and admin only |
| Tourism feedback | Existing `public.tourism_feedback` | Existing policies and aggregate RPC |
| Admin authorization | `public.admin_roles` | Server only; browser roles use the separate signed Netlify session |

## Entity relationships

```text
auth.users 1 ── 0..1 vendors 1 ── * listings * ── 1 sites
                                      │                 │
                                      ├── * listing_images
                                      └── * inquiries    └── * qr_codes

admin_roles — hashed subject and role for the Netlify admin identity
tourism_feedback — retained existing feedback subsystem
```

All new entities use UUID primary keys, foreign keys, checks and indexes as declared in `supabase/migrations/20261122030000_marketplace.sql`. Mutable tables include `created_at` and `updated_at`; inquiries are append-only events. `vendors.id` is also the Supabase Auth user ID.

## Listing lifecycle

1. Auth signup creates a vendor profile from signup metadata. The vendor must verify email before using authenticated marketplace operations.
2. The vendor saves a listing as `DRAFT` and may upload JPEG, PNG or WebP images (maximum 5 MiB each).
3. `submit_listing_for_review(p_listing_id)` verifies ownership and transitions a draft, rejected or inactive listing to `PENDING`.
4. An admin approves it (`APPROVED`, active), rejects/requests changes (`REJECTED`, inactive, feedback required), or deactivates it (`INACTIVE`, inactive).
5. Editing public listing details or images hides an approved listing and requires another review. Vendors cannot set an approval status themselves.

Only active sites and approved, active listings are returned by the public directory view. The public view exposes business contact fields intentionally needed for tourist contact; vendor profile details, pending submissions, and inquiry PII remain private.

## Access model

| Actor | Read | Write |
| --- | --- | --- |
| Anonymous visitor | Active sites/routes; approved listing view; approved image objects | Contact/inquiry events only for approved listings |
| Authenticated vendor | Own profile, listings and image metadata; public approved listings | Own profile, draft listings, listing images, submission through the workflow RPC |
| Admin UI | Protected queue, vendor/listing details, inquiries and review images | Review decisions through the server-side Netlify function |
| Netlify service role | Server-mediated admin operations | Server-mediated admin operations only |

RLS is enabled on all new tables. The Supabase service-role key is not sent to browsers. Admin calls require a valid signed, expiring cookie and an active matching hashed subject in `admin_roles`.

## Deployment and migration safety

The migration intentionally does not create `tourism_feedback`. Apply its existing SQL first only if the table is not already present. Before applying the marketplace migration, inspect the target Supabase schema: it aborts when required feedback is absent or any of the marketplace table names already exist. Reconcile existing tables rather than overwriting them.

The checked-out environment was not linked to the Supabase project and had no local Postgres/Docker service, so the remote schema, SQL execution, and production RLS behavior remain unverified. Review this migration against the live schema before deployment.
