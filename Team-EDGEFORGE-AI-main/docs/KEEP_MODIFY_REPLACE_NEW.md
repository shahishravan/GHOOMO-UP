# Module disposition

| Module | Decision | Current handling |
| --- | --- | --- |
| Static HTML/CSS/vanilla JS app | **KEEP / MODIFY** | Reuses the existing mobile-first, zero-build app for destination discovery, vendor and admin interfaces. |
| Destination metadata in `assets/destinations.js` | **KEEP / MODIFY** | Stable destination IDs, slugs and active status drive landing and scan routes. |
| Bihar content and seed listings | **REPLACE in active UI** | Uttar Pradesh destination copy is active; no fake marketplace records are seeded. Legacy assets remain only if unreferenced. |
| Destination detail and category filters | **KEEP / MODIFY** | Preserves QR discovery and now filters database-backed approved listings. |
| Supabase Auth | **KEEP / EXTEND** | Supports vendor signup, email verification, login, logout and recovery; tourist login is not required. |
| Supabase tourism feedback | **KEEP** | Existing table, RLS and aggregate functionality are preserved; migration adds only `updated_at` maintenance. |
| Local listing and inquiry prototype | **REPLACE as marketplace authority** | Supabase becomes the intended shared source for profiles, listings, inquiries and approval. Optional traveler prefill remains local. |
| Supabase marketplace schema and RLS | **NEW** | Adds sites, vendors, listings, images, QR records, inquiries and admin roles, subject to live-schema reconciliation. |
| Private listing image storage | **NEW** | JPEG, PNG and WebP uploads capped at 5 MiB, with owner policies and approved-listing signed reads. |
| Browser marketplace API | **NEW** | Implements public directory reads, vendor CRUD, submission, photo upload and inquiry/contact events using the publishable key. |
| Admin auth and moderation function | **KEEP / EXTEND** | Existing signed-cookie authentication is retained; moderation API additionally checks an active database role before service-role access. |
| Vendor dashboard/onboarding | **NEW** | Profile management, draft editing, status feedback, image upload and submission use existing frontend architecture. |
| Admin marketplace dashboard | **NEW** | Lists submissions and provides approval, rejection, change-request and deactivation actions through the protected function. |
| WhatsApp contact | **KEEP / MODIFY** | Uses approved vendor contact details; click events are tracked where possible and do not imply a booking. |
| AI concierge/listing assistant | **KEEP / MODIFY** | Existing Netlify/Groq boundary is retained; AI-generated content is not trusted as moderation or verified listing data. |
| `/scan/:slug` routes | **KEEP** | Existing route resolution remains; destination listing cards now come from the approved marketplace view. |
| Project/API/security documentation | **KEEP / UPDATE** | Architecture, schema, API/setup, security and test docs describe implemented vs deployment-unverified behavior. |
| Automated smoke tests | **KEEP / EXTEND** | Existing regression tests retained; database policy and admin endpoint tests added. |

## Known boundaries

- The marketplace schema has not been applied to a live Supabase project in this environment. Inspect and reconcile the target schema before deployment.
- Email verification, recovery redirects, Storage policies and end-to-end vendor/admin flows require configured Supabase and Netlify environments for live validation.
- The custom admin cookie and `admin_roles` record must be provisioned together; the server-only service-role key must never be exposed to the browser.
- QR records are initialized as `planned`; no physical installation is represented.
