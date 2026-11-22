const assert = require("assert");
const crypto = require("crypto");

const USER_ID = "marketplace-test-admin";
const PASSWORD = "correct-horse-battery-staple";
const SALT = crypto.randomBytes(16);
const ORIGIN = "https://ghoomoup.netlify.app";
const LISTING_ID = "123e4567-e89b-42d3-a456-426614174000";

process.env.ADMIN_USER_ID_HASH = crypto.createHash("sha256").update(USER_ID).digest("hex");
process.env.ADMIN_PASSWORD_SALT = SALT.toString("base64url");
process.env.ADMIN_PASSWORD_HASH = crypto.scryptSync(PASSWORD, SALT, 64).toString("base64url");
process.env.ADMIN_SESSION_SECRET = crypto.randomBytes(48).toString("base64url");
process.env.ADMIN_ALLOWED_ORIGINS = ORIGIN;
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-test-key";

const adminAuth = require("../netlify/functions/admin-auth.js");
const marketplace = require("../netlify/functions/admin-marketplace.js");

function event(httpMethod, headers = {}, body = "") {
  return { httpMethod, headers: { origin: ORIGIN, ...headers }, body };
}

function response(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json" }
  });
}

(async () => {
  let fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    if (String(url).includes("/admin_roles?")) return response(200, [{ role: "admin" }]);
    if (options.method === "PATCH") return response(200, [{ id: LISTING_ID }]);
    if (String(url).includes("/listings?")) return response(200, []);
    if (String(url).includes("/inquiries?")) return response(200, []);
    throw new Error(`Unexpected request: ${url}`);
  };

  const unauthenticated = await marketplace.handler(event("GET"));
  assert.strictEqual(unauthenticated.statusCode, 401, "anonymous admin requests must be rejected");
  assert.strictEqual(fetchCalls.length, 0, "unauthenticated requests must not access the database");

  const login = await adminAuth.handler({
    httpMethod: "POST",
    body: JSON.stringify({ action: "login", userId: USER_ID, password: PASSWORD }),
    headers: { origin: ORIGIN }
  });
  assert.strictEqual(login.statusCode, 200);
  const cookie = login.headers["Set-Cookie"].split(";")[0];

  const queue = await marketplace.handler(event("GET", { cookie }));
  assert.strictEqual(queue.statusCode, 200, "active admin should load the review queue");
  assert.deepStrictEqual(JSON.parse(queue.body), { listings: [], inquiries: [] });

  fetchCalls = [];
  const missingFeedback = await marketplace.handler(event(
    "POST",
    { cookie },
    JSON.stringify({ action: "reject", listingId: LISTING_ID })
  ));
  assert.strictEqual(missingFeedback.statusCode, 400, "rejection requires feedback");
  assert.strictEqual(fetchCalls.length, 1, "invalid review should not patch listings");
  assert(fetchCalls[0].url.includes("admin_roles"));

  fetchCalls = [];
  const approved = await marketplace.handler(event(
    "POST",
    { cookie },
    JSON.stringify({ action: "approve", listingId: LISTING_ID })
  ));
  assert.strictEqual(approved.statusCode, 200);
  const patch = fetchCalls.find((call) => call.options.method === "PATCH");
  assert(patch, "approval should update the database through the server function");
  assert(patch.url.includes("status=in."), "approval must require a pending or inactive prior status");
  assert.deepStrictEqual(JSON.parse(patch.options.body).status, "APPROVED");
  assert(!approved.body.includes("server-only-test-key"), "server-only credentials must not be returned to the browser");

  const foreignOrigin = await marketplace.handler({
    httpMethod: "GET",
    headers: { origin: "https://attacker.example", cookie }
  });
  assert.strictEqual(foreignOrigin.statusCode, 403, "untrusted origins must be rejected");

  global.fetch = async (url) => {
    if (String(url).includes("/admin_roles?")) return response(200, []);
    throw new Error("Inactive admins must not call protected operations.");
  };
  const inactiveRole = await marketplace.handler(event("GET", { cookie }));
  assert.strictEqual(inactiveRole.statusCode, 403, "missing or inactive database roles must be rejected");

  console.log("Admin marketplace authorization and review smoke checks passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

