# Module disposition

| Existing module | Decision | Rationale / Phase 1 action |
| --- | --- | --- |
| Static HTML/CSS/vanilla JS app | **KEEP / MODIFY** | Retain the zero-build and mobile-responsive structure; update brand styling, content and navigation. |
| Destination metadata embedded in `index.html` | **REPLACE** | Move active destination records into `assets/destinations.js` with the requested stable fields. |
| Bihar seed listing collection | **REPLACE** | Do not load legacy/demo providers in GhoomoUP. `DEFAULT_LISTINGS` is empty until reviewed listings exist. |
| Destination detail and category filters | **KEEP / MODIFY** | Preserve existing views and filters; show only approved records and a useful empty state. |
| Supabase provider authentication | **KEEP** | Existing email/password provider sign-in and email confirmation remain. |
| Optional tourist profile | **KEEP** | Keep optional/local-only behavior; tourist browsing remains account-free. |
| Admin auth function and dashboard | **KEEP / MODIFY** | Retain the signed-cookie auth; update default origin and destination brand. Listing management remains browser-local. |
| Netlify chat function | **KEEP / MODIFY** | Retain the secure proxy pattern and Groq model integration; replace the Bihar concierge prompt with GhoomoUP guidance. |
| Listing assistant function | **KEEP / MODIFY** | Retain structured draft generation; update the prompt for Uttar Pradesh and keep admin review separate. |
| Supabase feedback table/RLS/RPC | **KEEP / MODIFY** | Preserve feedback protections and aggregates; change product-facing destination choices/labels to Uttar Pradesh. |
| Browser-local listing/inquiry storage | **KEEP for prototype / REPLACE for production** | Existing flow remains usable for a single-browser demo; database-backed records and server-side approval are Phase 2 work. |
| Legacy Bihar destination artwork and seed files | **REPLACE in active UI; RETAIN in repository** | New GhoomoUP mark and original UP illustrations are active. Unreferenced Bihar assets are kept as source history, not displayed. |
| Hash-based destination QR preview | **REPLACE** | Use `/scan/:slug`, Netlify rewrite, active-site validation and explicit invalid/inactive handling. |
| Decorative fake QR fallback | **REPLACE** | Show a truthful preview-unavailable message rather than a non-scannable image. |
| Static landing page and destination cards | **KEEP / MODIFY** | Reuse layout, update destination cards, visitor copy, about section and provider entry point. |
| Bihar local AI knowledge fallback | **REPLACE in active call path** | Active fallback uses the UP destination data and only recommends approved listings. |
| Existing tests | **KEEP / MODIFY** | Retain regression coverage and update destination/product assertions. |
| Destination/QR smoke coverage | **NEW** | Test required destination fields, active IDs/slugs, empty listings and invalid/inactive scan behavior. |
| AI function boundary tests | **NEW** | Test method/configuration/input validation without sending requests to Groq. |
| Audit, architecture and test documentation | **NEW** | Add `docs/PROJECT_AUDIT.md`, `docs/EXISTING_ARCHITECTURE.md`, this disposition and `docs/TESTING_REPORT.md`. |
| Shared listings database, moderation API, QR installation tracking | **NEW (Phase 2)** | Needed for production provider onboarding, cross-device moderation, auditability and physical deployment evidence. |
