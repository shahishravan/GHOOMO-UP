const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261122030000_marketplace.sql"),
  "utf8"
);
const frontend = fs.readFileSync(path.join(root, "assets", "marketplace-api.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

[
  "sites", "vendors", "listings", "listing_images",
  "qr_codes", "inquiries", "admin_roles"
].forEach((table) => {
  assert(
    new RegExp(`create table public\\.${table}\\s*\\([\\s\\S]*?id uuid primary key`, "i").test(migration),
    `${table} should have a UUID primary key`
  );
  assert(
    new RegExp(`alter table public\\.${table} enable row level security`, "i").test(migration),
    `${table} should have RLS enabled`
  );
});
assert(!/create table(?: if not exists)? public\.tourism_feedback/i.test(migration), "existing feedback table must not be duplicated");
assert(migration.includes("Apply supabase/tourism-feedback.sql before the marketplace migration."));
assert(migration.includes("status in ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'INACTIVE')"));
assert(migration.includes("status = 'APPROVED' and active"), "public listing policy must require approval and active state");
assert(migration.includes("new.vendor_id <> auth.uid()"), "listing ownership must be checked in the database");
assert(migration.includes("Listing status changes must use the review workflow."), "vendors must not set listing status directly");
const submissionWorkflow = migration.match(/create function public\.submit_listing_for_review[\s\S]*?\n\$\$;/i);
assert(submissionWorkflow && submissionWorkflow[0].includes("set_config('ghoomoup.listing_transition', 'vendor_submit', true)"), "submission RPC must authorize only its own status transition");
assert(migration.includes("metadata ->> 'account_type' is distinct from 'vendor'"), "only vendor signups should create vendor profiles");
assert(!migration.includes("+910000000000"), "migration must not populate fake placeholder phone numbers");
assert(migration.includes("bucket_id = 'listing-images'") && migration.includes("file_size_limit, allowed_mime_types"));
assert(migration.includes("storage_path like (select auth.uid())::text || '/' || listing_id::text"), "image metadata must stay under its owner's listing folder");
assert(migration.includes("revoke update on public.listings from authenticated"), "vendor listing updates must not inherit moderation-column privileges");
assert(migration.includes("grant insert (vendor_id, site_id, category, title"), "vendors must not insert moderation metadata");
assert(!migration.includes("reviewed_by_hash, created_at, updated_at) on public.listings to authenticated"), "reviewer identity hashes must stay private");
assert(migration.includes("revoke all on public.sites, public.vendors, public.listings"), "default grants must be explicitly narrowed before access is granted");
assert(migration.includes("listing_images_hide_approved_listing"), "changes to approved images must return the listing to review");
assert(!/service[_-]?role/i.test(frontend), "service-role credentials must not be shipped in the browser API");
assert(frontend.includes("submit_listing_for_review"), "vendor submissions should use the protected review workflow");
assert(frontend.includes(".upsert({"), "vendors without a legacy profile should be able to create one securely");
assert(html.includes("admin-marketplace"), "admin data should use the protected Netlify API");
assert(html.includes('account_type: "vendor"'), "vendor signup must identify the account type for the auth trigger");

console.log("Marketplace schema and RLS smoke checks passed.");

