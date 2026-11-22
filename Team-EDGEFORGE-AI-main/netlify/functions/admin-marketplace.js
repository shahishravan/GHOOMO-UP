const { getAdminSession } = require("./admin-auth.js");

const LISTING_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 8192;

function allowedOrigins() {
  return (process.env.ADMIN_ALLOWED_ORIGINS || "https://ghoomoup.netlify.app")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function response(statusCode, body, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff"
  };
  if (origin && allowedOrigins().includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers.Vary = "Origin";
  }
  return { statusCode, headers, body: JSON.stringify(body) };
}

function eventHeader(event, name) {
  return event.headers[name.toLowerCase()] || event.headers[name] || "";
}

function isTrustedOrigin(origin) {
  return Boolean(origin) && allowedOrigins().includes(origin);
}

function hasDatabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function databaseRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      signal: controller.signal
    });
    const body = await response.text();
    let payload = null;
    if (body) {
      try {
        payload = JSON.parse(body);
      } catch (_error) {
        throw new Error("Marketplace database returned an invalid response.");
      }
    }
    if (!response.ok) {
      console.error("Marketplace database request failed:", response.status, payload && payload.code);
      throw new Error("Marketplace database request failed.");
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function signStorageObject(path) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/sign/listing-images/${encodedPath}`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ expiresIn: 3600 }),
        signal: controller.signal
      }
    );
    const payload = await response.json();
    if (!response.ok || !payload.signedURL) {
      console.error("Unable to sign listing image:", response.status);
      throw new Error("Unable to sign listing image.");
    }
    if (payload.signedURL.startsWith("http")) return payload.signedURL;
    const storagePath = payload.signedURL.startsWith("/storage/v1/")
      ? payload.signedURL
      : `/storage/v1${payload.signedURL.startsWith("/") ? "" : "/"}${payload.signedURL}`;
    return `${process.env.SUPABASE_URL}${storagePath}`;
  } finally {
    clearTimeout(timeout);
  }
}

async function getAuthorizedAdminRole(subjectHash) {
  const query = new URLSearchParams({
    select: "role",
    admin_identifier_hash: `eq.${subjectHash}`,
    is_active: "eq.true",
    limit: "1"
  });
  const rows = await databaseRequest(`admin_roles?${query.toString()}`);
  return Array.isArray(rows) && rows[0] ? rows[0].role : null;
}

async function getQueue() {
  const listingQuery = new URLSearchParams({
    select: "id,vendor_id,site_id,category,title,description,address,service_area,price_information,specialty,operating_hours,status,active,review_feedback,reviewed_at,created_at,updated_at,site:sites(name,code),vendor:vendors(business_name,owner_name,contact_number,whatsapp_number),images:listing_images(id,storage_path,alt_text,sort_order)",
    order: "created_at.desc"
  });
  const inquiryQuery = new URLSearchParams({
    select: "id,listing_id,event_type,tourist_name,tourist_phone,message,source,created_at",
    order: "created_at.desc",
    limit: "500"
  });
  const [listings, inquiries] = await Promise.all([
    databaseRequest(`listings?${listingQuery.toString()}&limit=500`),
    databaseRequest(`inquiries?${inquiryQuery.toString()}`)
  ]);
  const listingsWithImages = await Promise.all(listings.map(async (listing) => ({
    ...listing,
    images: await Promise.all((listing.images || []).map(async (image) => ({
      ...image,
      url: await signStorageObject(image.storage_path)
    })))
  })));
  return { listings: listingsWithImages, inquiries };
}

exports.handler = async function (event) {
  const origin = eventHeader(event, "origin");
  if (event.httpMethod === "OPTIONS") {
    if (!isTrustedOrigin(origin)) return response(403, { error: "Request origin is not allowed." });
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Max-Age": "600",
        Vary: "Origin"
      },
      body: ""
    };
  }
  if (!["GET", "POST"].includes(event.httpMethod)) {
    return response(405, { error: "Method not allowed." }, origin);
  }
  if (!isTrustedOrigin(origin)) {
    return response(403, { error: "Request origin is not allowed." });
  }
  if (!hasDatabaseConfig()) {
    console.error("Marketplace database environment variables are incomplete.");
    return response(503, { error: "Marketplace administration is not configured." }, origin);
  }

  const session = getAdminSession(event);
  if (!session) return response(401, { error: "Admin session required." }, origin);

  try {
    const role = await getAuthorizedAdminRole(session.sub);
    if (!role) return response(403, { error: "Admin role is not active." }, origin);

    if (event.httpMethod === "GET") {
      const { listings, inquiries } = await getQueue();
      return response(200, { listings, inquiries }, origin);
    }

    if ((event.body || "").length > MAX_BODY_BYTES) {
      return response(413, { error: "Request is too large." }, origin);
    }
    let input;
    try {
      input = JSON.parse(event.body || "{}");
    } catch (_error) {
      return response(400, { error: "Invalid request." }, origin);
    }
    if (!input || !LISTING_ID_PATTERN.test(input.listingId || "")) {
      return response(400, { error: "A valid listing ID is required." }, origin);
    }

    const actions = {
      approve: { status: "APPROVED", active: true, review_feedback: null, allowed: ["PENDING", "INACTIVE"] },
      reject: { status: "REJECTED", active: false, allowed: ["PENDING"] },
      request_changes: { status: "REJECTED", active: false, allowed: ["PENDING"] },
      deactivate: { status: "INACTIVE", active: false, allowed: ["APPROVED"] }
    };
    const update = actions[input.action];
    if (!update) return response(400, { error: "Unsupported review action." }, origin);
    const feedback = typeof input.feedback === "string" ? input.feedback.trim().slice(0, 1000) : "";
    if (["reject", "request_changes", "deactivate"].includes(input.action) && !feedback) {
      return response(400, { error: "Provide clear feedback for this review action." }, origin);
    }
    if (input.action !== "approve") update.review_feedback = feedback;

    const patch = {
      status: update.status,
      active: update.active,
      review_feedback: input.action === "approve" ? null : feedback,
      reviewed_at: new Date().toISOString(),
      reviewed_by_hash: session.sub
    };
    const statusFilter = update.allowed.length === 1
      ? `eq.${update.allowed[0]}`
      : `in.(${update.allowed.join(",")})`;
    const updatedListings = await databaseRequest(
      `listings?id=eq.${encodeURIComponent(input.listingId)}&status=${encodeURIComponent(statusFilter)}`,
      {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch)
      }
    );
    if (!Array.isArray(updatedListings) || updatedListings.length !== 1) {
      return response(409, { error: "Listing status changed. Refresh the review queue and try again." }, origin);
    }
    return response(200, { success: true, listingId: input.listingId, status: patch.status }, origin);
  } catch (error) {
    console.error("Marketplace admin request failed:", error.message);
    return response(502, { error: "Marketplace request failed. Please try again." }, origin);
  }
};

exports._test = { getAuthorizedAdminRole, getQueue, databaseRequest, signStorageObject };
