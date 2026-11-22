# GhoomoUP marketplace API and database

## Database relationship map

- `sites` contains active discovery destinations and owns listings and QR route records.
- `vendors.id` references `auth.users.id`; signup creates the vendor profile from verified signup metadata.
- `listings.vendor_id` references one vendor and `site_id` references one active site. Listings carry category, service details, moderation state and reviewer feedback.
- `listing_images.listing_id` references a listing; photographs are stored in the private `listing-images` bucket.
- `qr_codes.site_id` references a site. New codes are seeded as `planned`; no installation is implied.
- `inquiries.listing_id` references an approved listing. `event_type` distinguishes an inquiry (private tourist contact details) from a WhatsApp click (no contact details).
- `admin_roles` binds a UUID record to the SHA-256 hash of the configured Netlify admin ID. It does not contain a password.
- Existing `tourism_feedback` is retained. The migration adds `updated_at` and its maintenance trigger; it does not recreate the table.

All tables use UUID primary keys and creation timestamps. Mutable site, vendor, listing, image, QR, role and feedback rows also receive updated timestamps. Inquiries are append-only events.

## Vendor lifecycle

1. A provider registers with an email, password, business/owner names, and validated phone/WhatsApp numbers. Vendor metadata is explicitly marked `account_type: vendor`; the auth trigger rejects incomplete vendor details and ignores unrelated Auth users.
2. Supabase sends email verification. The database auth trigger creates the provider profile; authenticated marketplace operations require a verified session. A legacy Auth account without a valid migrated profile can complete its own profile through the owner-scoped upsert.
3. The provider edits their private business profile, creates a draft listing, and can upload JPEG, PNG or WebP photographs up to 5 MB.
4. Saving a draft leaves it private. Submitting calls `submit_listing_for_review`; it moves the owned listing to `PENDING`.
5. A rejection includes admin feedback. Editing a rejected listing returns it to `DRAFT`; the provider can correct it and resubmit.
6. Editing an approved listing or its images hides it and moves it back to review. Only an admin decision can make it public again.

The database trigger, owner-scoped RLS, narrow vendor update-column grants, and submission RPC enforce transitions even if the browser is modified. Vendors never receive moderation-field update permission or a status-update permission that can approve their own listing.

## Admin lifecycle

The existing Netlify admin login remains the entry point. Its signed, `HttpOnly`, `Secure`, `SameSite=Strict` cookie includes the SHA-256 admin-ID hash as its subject. The admin marketplace Function verifies the signature and expiry, then checks that the matching `admin_roles` record is active. Only then does it use the server-only Supabase service-role key to read submissions, sign private review photos, or apply a moderation decision.

Supported decisions:

- **Approve:** `APPROVED`, active and public.
- **Request changes:** `REJECTED`, inactive, with required reviewer feedback.
- **Reject:** `REJECTED`, inactive, with required reviewer feedback.
- **Deactivate:** `INACTIVE`, hidden, with required reviewer feedback.

The database stores the latest review time, reviewer hash and feedback. It does not currently keep a full immutable moderation history.

## Frontend data access

The frontend uses the existing Supabase URL and publishable key only. It never receives the service-role key.

| Resource | Operation | Access |
| --- | --- | --- |
| `public.public_listings` | Read destination listings and public business contact details | Anonymous; approved and active rows only |
| `sites` | Read active destinations | Anonymous |
| `vendors` | Read/update a provider’s profile | That verified provider; public access is limited to contact columns for approved listings |
| `listings` | Create drafts, read/edit own rows, submit through RPC | Verified owner and RLS; raw public reads limited to approved rows |
| `listing_images` and Storage | Upload/read own images; public signed reads for approved listings | Owner path is `${auth.uid()}/${listing_id}/...`; RLS enforces the path and the private bucket restricts type/size |
| `inquiries` | Create inquiries/contact-click events; read provider’s inquiry events | Anyone can create an event for an approved listing; only its provider/admin can read contact data |
| `admin-marketplace` Netlify Function | Admin queue, review, inquiries and decisions | Origin allow-list, signed admin cookie and active database admin role |

Public cards generate WhatsApp links from the approved vendor profile. A link click is recorded when the browser can reach Supabase; it represents intent to contact, not a confirmed conversation or booking.

## Setup

1. In Supabase, run the existing `supabase/tourism-feedback.sql` once if `public.tourism_feedback` is not already present.
2. Inspect the live schema. The marketplace migration aborts if the feedback table is missing or any marketplace table already exists; reconcile existing objects instead of blindly rerunning it.
3. Apply `supabase/migrations/20261122030000_marketplace.sql` using the Supabase SQL Editor or linked Supabase CLI.
4. Confirm Auth email verification and password recovery redirects include the deployed GhoomoUP origin.
5. In Netlify, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as server-only variables, plus the existing admin secret variables and exact `ADMIN_ALLOWED_ORIGINS`. Never put the service-role key in the frontend.
6. Add the configured admin identifier hash to `public.admin_roles` using the Supabase SQL Editor:

   ```sql
   insert into public.admin_roles (admin_identifier_hash, role)
   values ('<ADMIN_USER_ID_HASH>', 'admin');
   ```

   Substitute the value already configured as `ADMIN_USER_ID_HASH`; do not commit it. The API remains locked until an active matching row exists.
7. Deploy, verify email signup/recovery, vendor ownership, private image access, approval/rejection and the three `/scan/{varanasi,ayodhya,prayagraj}` routes.

Local migration execution requires a linked Supabase project or a running local Supabase/Docker stack. This checkout is not linked, and no remote schema was inspected from this environment.

## Function contract

All admin requests are same-origin requests to `/.netlify/functions/admin-marketplace`; do not send the service-role key or credentials in the body.

- `GET` returns `{ listings, inquiries }` for the protected admin dashboard.
- `POST { "action": "approve", "listingId": "<uuid>" }`
- `POST { "action": "reject" | "request_changes" | "deactivate", "listingId": "<uuid>", "feedback": "<reason>" }`
- Responses use `{ success, listingId, status }` on success and a safe `{ error }` message on failure. Requests are origin-checked, bounded, and not cached.

