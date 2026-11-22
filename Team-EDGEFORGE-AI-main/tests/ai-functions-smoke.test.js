const assert = require("assert");

const chat = require("../netlify/functions/chat.js");
const listingAssistant = require("../netlify/functions/listing-assistant.js");

function event(httpMethod, body) {
  return {
    httpMethod,
    body: body === undefined ? "" : JSON.stringify(body),
    headers: {}
  };
}

(async () => {
  const previousKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  const unconfiguredChat = await chat.handler(event("POST", { message: "Varanasi" }));
  assert.strictEqual(unconfiguredChat.statusCode, 500, "chat should report missing server configuration");
  assert.strictEqual(JSON.parse(unconfiguredChat.body).fallbackRequired, true, "chat should request its local fallback");

  process.env.GROQ_API_KEY = "test-only-placeholder";
  const wrongMethod = await chat.handler(event("GET"));
  assert.strictEqual(wrongMethod.statusCode, 405, "chat should reject unsupported methods");

  const emptyChat = await chat.handler(event("POST", { message: "   " }));
  assert.strictEqual(emptyChat.statusCode, 400, "chat should reject empty messages");

  const emptyBrief = await listingAssistant.handler(event("POST", { brief: "   " }));
  assert.strictEqual(emptyBrief.statusCode, 400, "listing assistant should reject empty briefs");

  const oversizedBrief = await listingAssistant.handler(event("POST", { brief: "x".repeat(1001) }));
  assert.strictEqual(oversizedBrief.statusCode, 400, "listing assistant should reject briefs over its limit");

  const wrongListingMethod = await listingAssistant.handler(event("GET"));
  assert.strictEqual(wrongListingMethod.statusCode, 405, "listing assistant should reject unsupported methods");

  if (previousKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = previousKey;

  console.log("AI function validation smoke checks passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
