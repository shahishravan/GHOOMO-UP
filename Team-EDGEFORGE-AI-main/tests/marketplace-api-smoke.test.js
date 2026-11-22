const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "assets", "marketplace-api.js"),
  "utf8"
);
const window = {};
vm.runInNewContext(source, { window, crypto: crypto.webcrypto, console, Promise, Set, Error });
const api = window.GhoomoMarketplace;

async function run() {
  const signedPaths = [];
  const listing = {
    id: "listing-1",
    title: "Kashi Heritage Walk",
    category: "guide",
    site_code: "varanasi",
    description: "A guided introduction to Varanasi's historic lanes.",
    business_name: "Kashi Walks",
    whatsapp_number: "+919876543210",
    contact_number: "+919876543211",
    images: [{ id: "image-1", path: "vendor-1/listing-1/walk.webp", alt_text: "Old city lane" }]
  };
  const inquiries = [];
  let savedProfile = null;
  const client = {
    from(table) {
      if (table === "vendors") {
        return {
          upsert(payload, options) {
            savedProfile = { payload, options };
            return {
              select() {
                return {
                  single: async () => ({ data: payload, error: null })
                };
              }
            };
          }
        };
      }
      if (table === "public_listings") {
        return {
          select() { return this; },
          order() { return Promise.resolve({ data: [listing], error: null }); }
        };
      }
      if (table === "inquiries") {
        return {
          insert(payload) {
            inquiries.push(payload);
            return Promise.resolve({ data: null, error: null });
          }
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    storage: {
      from(bucket) {
        assert.strictEqual(bucket, "listing-images");
        return {
          createSignedUrl: async (storagePath) => {
            signedPaths.push(storagePath);
            return { data: { signedUrl: `https://storage.example/${storagePath}` }, error: null };
          }
        };
      }
    }
  };

  const publicListings = await api.fetchPublicListings(client);
  assert.strictEqual(publicListings.length, 1);
  assert.strictEqual(publicListings[0].site, "varanasi");
  assert.strictEqual(publicListings[0].status, "approved");
  assert.strictEqual(publicListings[0].whatsapp, "+919876543210");
  assert.strictEqual(publicListings[0].photo, "https://storage.example/vendor-1/listing-1/walk.webp");
  assert.deepStrictEqual(signedPaths, ["vendor-1/listing-1/walk.webp"]);

  await api.saveVendorProfile(client, "vendor-1", {
    business_name: "Kashi Walks",
    owner_name: "Guide Owner",
    contact_number: "+919876543211",
    whatsapp_number: "+919876543210",
    default_category: "guide"
  });
  assert.strictEqual(savedProfile.payload.id, "vendor-1");
  assert.strictEqual(savedProfile.options.onConflict, "id");

  await api.recordInquiry(client, "listing-1", {
    tourist_name: "Visitor",
    tourist_phone: "+919876543200",
    message: "Please share more details."
  }, "qr");
  await api.recordWhatsAppClick(client, "listing-1", "qr");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(inquiries[0])), {
    listing_id: "listing-1",
    event_type: "inquiry",
    tourist_name: "Visitor",
    tourist_phone: "+919876543200",
    message: "Please share more details.",
    source: "qr"
  });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(inquiries[1])), {
    listing_id: "listing-1",
    event_type: "whatsapp_click",
    source: "qr"
  }, "WhatsApp click records must not include tourist PII");

  let uploadCalls = 0;
  const uploadClient = { storage: { from: () => ({ upload: async () => { uploadCalls += 1; } }) } };
  await assert.rejects(
    api.uploadListingImage(uploadClient, "vendor-1", "listing-1", {
      type: "image/svg+xml",
      size: 100
    }, "Image"),
    /JPEG, PNG or WebP/
  );
  await assert.rejects(
    api.uploadListingImage(uploadClient, "vendor-1", "listing-1", {
      type: "image/jpeg",
      size: api.MAX_IMAGE_BYTES + 1
    }, "Image"),
    /JPEG, PNG or WebP/
  );
  assert.strictEqual(uploadCalls, 0, "invalid image files must not be uploaded");

  console.log("Marketplace browser API smoke checks passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
