const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

[
  "✨ Plan a UP trip",
  "1 day",
  "2 days",
  "3 days",
  "4+ days",
  "Under ₹2,000",
  "₹2–5k",
  "₹5–10k",
  "Flexible",
  "Pilgrimage & spirituality",
  "History & culture",
  "Food",
  "Nature",
  "Family",
  "Mix",
  "Varanasi",
  "Ayodhya",
  "Prayagraj",
  "Other"
].forEach((label) => assert(html.includes(label), `missing planner option: ${label}`));

assert(html.includes("I can help outline a Uttar Pradesh trip."), "missing trip-planning question");
assert(html.includes("Aapka approximate budget kya hai?"), "missing budget question");
assert(html.includes("This is not a price quote."), "budget estimate must not be presented as a provider quote");
assert(html.includes("Aapko kis type ka experience pasand hai?"), "missing experience question");
assert(html.includes("Aap trip kahan se start karna chahenge?"), "missing start question");
assert(html.includes("Confirm current travel times and site access locally."), "missing current travel guidance");
assert(html.includes("https://wa.me/?text="), "full itinerary should be shareable on WhatsApp");
assert(html.includes("findYatraListing(site, state.experience, index)"), "itinerary should include real local listings");

const start = html.indexOf("const YATRA_OPTIONS");
const end = html.indexOf("function findYatraListing", start);
assert(start >= 0 && end > start, "planner route helpers should be present");

const context = {
  SITE_METADATA: {
    varanasi: { id: "varanasi", active: true },
    ayodhya: { id: "ayodhya", active: true },
    prayagraj: { id: "prayagraj", active: true }
  },
  listings: [],
  DEFAULT_LISTINGS: []
};
vm.createContext(context);
vm.runInContext(`${html.slice(start, end)}\nthis.yatraApi = { buildYatraRoute, getYatraTravelTime, getYatraBudgetSummary, getYatraDayCount };`, context);

const pilgrimageDayTrip = context.yatraApi.buildYatraRoute({
  days: "1",
  budget: "2000-5000",
  experience: "pilgrimage",
  start: "ayodhya"
});
assert.deepStrictEqual([...pilgrimageDayTrip], ["ayodhya"], "one-day pilgrimage outline should begin at the selected active destination");

const jamuiMix = context.yatraApi.buildYatraRoute({
  days: "3",
  budget: "5000-10000",
  experience: "mix",
  start: "prayagraj"
});
assert.strictEqual(jamuiMix.length, 3, "three-day selection should produce three itinerary days");
assert.strictEqual(jamuiMix[0], "prayagraj", "trip outline should begin at the selected active destination");
assert.strictEqual(new Set(jamuiMix).size, 3, "itinerary destinations should not repeat");

const extended = context.yatraApi.buildYatraRoute({
  days: "4plus",
  budget: "flexible",
  experience: "history",
  start: "varanasi"
});
assert.strictEqual(context.yatraApi.getYatraDayCount("4plus"), 4, "4+ selection should retain its duration meaning");
assert.strictEqual(extended.length, 3, "itinerary should not invent destinations beyond the three active records");
assert.strictEqual(extended[0], "varanasi", "trip outline should start at the selected active destination");

assert.strictEqual(
  context.yatraApi.getYatraTravelTime("other", "varanasi"),
  "check current local travel options",
  "planner should not invent travel time estimates"
);

const budget = context.yatraApi.getYatraBudgetSummary({ days: "3", budget: "under-2000" });
assert.strictEqual(budget.range, "Under ₹2,000 per person, per day", "budget should communicate the selected preference without estimating a total");
assert(budget.note.includes("not a price quote"), "budget preference should state its limitation");

console.log("GhoomoUP trip planner checks passed.");
