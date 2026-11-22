(function () {
  const IMAGE_BUCKET = "listing-images";
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  function requireResult(result, action) {
    if (result.error) {
      console.error(`Marketplace ${action} failed:`, result.error.message);
      throw new Error(result.error.message || `Unable to ${action}.`);
    }
    return result.data;
  }

  function imageRecords(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  async function signedImages(client, images) {
    const records = imageRecords(images);
    return Promise.all(records.map(async (image) => {
      const { data, error } = await client.storage
        .from(IMAGE_BUCKET)
        .createSignedUrl(image.path || image.storage_path, 3600);
      if (error) {
        console.error("Marketplace image signing failed:", error.message);
        throw new Error("Unable to load a listing photograph.");
      }
      return { ...image, url: data.signedUrl };
    }));
  }

  async function fetchPublicListings(client) {
    const data = requireResult(
      await client.from("public_listings")
        .select("id,title,category,site_code,site_name,description,address,service_area,price_information,specialty,operating_hours,business_name,whatsapp_number,contact_number,images,updated_at")
        .order("updated_at", { ascending: false }),
      "load public listings"
    );
    return Promise.all(data.map(async (row) => {
      const images = await signedImages(client, row.images);
      return {
        id: row.id,
        title: row.title,
        category: row.category,
        site: row.site_code,
        description: row.description,
        address: row.address,
        serviceArea: row.service_area,
        price: row.price_information || "Contact provider for details",
        whatsapp: row.whatsapp_number,
        phone: row.contact_number,
        openHours: row.operating_hours || "",
        specialty: row.specialty || "",
        verified: true,
        status: "approved",
        submittedBy: row.business_name,
        businessName: row.business_name,
        photo: images[0] ? images[0].url : "",
        images
      };
    }));
  }

  async function fetchVendorProfile(client, userId) {
    const data = requireResult(
      await client.from("vendors")
        .select("id,business_name,owner_name,contact_number,whatsapp_number,default_category")
        .eq("id", userId)
        .maybeSingle(),
      "load business profile"
    );
    return data;
  }

  async function saveVendorProfile(client, userId, profile) {
    return requireResult(
      await client.from("vendors").upsert({
        id: userId,
        business_name: profile.business_name,
        owner_name: profile.owner_name,
        contact_number: profile.contact_number,
        whatsapp_number: profile.whatsapp_number,
        default_category: profile.default_category || null
      }, { onConflict: "id" }).select().single(),
      "save business profile"
    );
  }

  async function fetchVendorListings(client, userId) {
    const rows = requireResult(
      await client.from("listings")
        .select("id,vendor_id,site_id,category,title,description,address,service_area,price_information,specialty,operating_hours,status,active,review_feedback,reviewed_at,created_at,updated_at,site:sites(name,code),images:listing_images(id,storage_path,alt_text,sort_order)")
        .eq("vendor_id", userId)
        .order("updated_at", { ascending: false }),
      "load your listings"
    );
    return Promise.all(rows.map(async (row) => {
      const images = await signedImages(client, row.images);
      return {
        ...row,
        site_name: row.site && row.site.name,
        site_code: row.site && row.site.code,
        images
      };
    }));
  }

  async function createListing(client, userId, listing) {
    return requireResult(
      await client.from("listings").insert({
        vendor_id: userId,
        site_id: listing.site_id,
        category: listing.category,
        title: listing.title,
        description: listing.description,
        address: listing.address || null,
        service_area: listing.service_area || null,
        price_information: listing.price_information || null,
        specialty: listing.specialty || null,
        operating_hours: listing.operating_hours || null,
        status: "DRAFT",
        active: false
      }).select("id").single(),
      "save listing draft"
    );
  }

  async function updateListing(client, listingId, listing) {
    return requireResult(
      await client.from("listings").update({
        site_id: listing.site_id,
        category: listing.category,
        title: listing.title,
        description: listing.description,
        address: listing.address || null,
        service_area: listing.service_area || null,
        price_information: listing.price_information || null,
        specialty: listing.specialty || null,
        operating_hours: listing.operating_hours || null
      }).eq("id", listingId).select("id,status").single(),
      "update listing"
    );
  }

  async function uploadListingImage(client, userId, listingId, file, title) {
    if (!file || !ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      throw new Error("Choose a JPEG, PNG or WebP image up to 5 MB.");
    }
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `${userId}/${listingId}/${crypto.randomUUID()}.${extension}`;
    const uploaded = requireResult(
      await client.storage.from(IMAGE_BUCKET).upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false
      }),
      "upload listing photograph"
    );
    try {
      requireResult(
        await client.from("listing_images").insert({
          listing_id: listingId,
          storage_path: uploaded.path,
          alt_text: title.slice(0, 200),
          sort_order: 0
        }),
        "save listing photograph"
      );
    } catch (error) {
      const { error: cleanupError } = await client.storage.from(IMAGE_BUCKET).remove([uploaded.path]);
      if (cleanupError) {
        console.error("Orphaned listing image cleanup failed:", cleanupError.message);
      }
      throw error;
    }
  }

  async function submitListing(client, listingId) {
    return requireResult(
      await client.rpc("submit_listing_for_review", { p_listing_id: listingId }),
      "submit listing for review"
    );
  }

  async function recordInquiry(client, listingId, inquiry, source) {
    return requireResult(
      await client.from("inquiries").insert({
        listing_id: listingId,
        event_type: "inquiry",
        tourist_name: inquiry.tourist_name,
        tourist_phone: inquiry.tourist_phone,
        message: inquiry.message || null,
        source
      }),
      "record inquiry"
    );
  }

  async function recordWhatsAppClick(client, listingId, source) {
    return requireResult(
      await client.from("inquiries").insert({
        listing_id: listingId,
        event_type: "whatsapp_click",
        source
      }),
      "record WhatsApp contact"
    );
  }

  window.GhoomoMarketplace = {
    MAX_IMAGE_BYTES,
    ALLOWED_IMAGE_TYPES,
    fetchPublicListings,
    fetchVendorProfile,
    saveVendorProfile,
    fetchVendorListings,
    createListing,
    updateListing,
    uploadListingImage,
    submitListing,
    recordInquiry,
    recordWhatsAppClick
  };
})();
