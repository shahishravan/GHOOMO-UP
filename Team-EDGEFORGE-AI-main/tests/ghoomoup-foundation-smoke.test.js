const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const netlify = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");
const destinationsContext = { window: {} };

vm.createContext(destinationsContext);
vm.runInContext(
  fs.readFileSync(path.join(root, "assets", "destinations.js"), "utf8"),
  destinationsContext
);

const destinations = destinationsContext.window.GHOOMOUP_DESTINATIONS;
const destinationList = Object.values(destinations);
assert.deepStrictEqual(
  destinationList.map(({ id }) => id).sort(),
  ["ayodhya", "prayagraj", "varanasi"],
  "foundation should contain the three requested destinations"
);

const slugs = new Set();
destinationList.forEach((destination) => {
  ["id", "name", "district", "slug", "description", "tourismCategory", "active", "image"]
    .forEach((field) => assert(Object.prototype.hasOwnProperty.call(destination, field), `${destination.id} is missing ${field}`));
  assert.strictEqual(destination.active, true, `${destination.id} should be active`);
  assert(!slugs.has(destination.slug), `duplicate destination slug: ${destination.slug}`);
  slugs.add(destination.slug);
  assert(fs.existsSync(path.join(root, destination.image)), `missing destination image: ${destination.image}`);
});

assert(netlify.includes('from = "/scan/*"'), "Netlify should rewrite site-specific scan routes to the app");
assert(html.includes('pathname.match(/^\\/scan\\/([^/]+)\\/?$/)'), "app should recognize scan routes");
assert(html.includes("item.active && (item.id === routeId || item.slug === routeId)"), "scan route should only resolve active destination IDs or slugs");
assert(html.includes('item.status === "approved"'), "public listing collection must be approval-gated");
assert(html.includes("There are no approved"), "destination should explain the empty approved-listing state");
assert(html.includes('const DEFAULT_LISTINGS = [];'), "the UP experience must not seed fictional providers");
assert(html.includes("not confirmation that a code has been physically installed"), "QR preview must not claim physical installation");
assert(html.includes("window.location.origin}/scan/${meta.slug}"), "QR preview should point to the destination route");

const routeStart = html.indexOf("function openScanRoute(routeId)");
const routeEnd = html.indexOf("function openSiteDetail", routeStart);
assert(routeStart >= 0 && routeEnd > routeStart, "scan routing handler should be present");

function routeContext(metadata) {
  const elements = {};
  const context = {
    SITE_METADATA: metadata,
    document: {
      getElementById(id) {
        if (!elements[id]) elements[id] = { style: {}, classList: { add() {}, remove() {} } };
        return elements[id];
      }
    },
    openSiteDetail(id) {
      context.openedSite = id;
    }
  };
  vm.createContext(context);
  vm.runInContext(`${html.slice(routeStart, routeEnd)}\nthis.route = openScanRoute;`, context);
  context.elements = elements;
  return context;
}

const validRoute = routeContext(destinations);
assert.strictEqual(validRoute.route("varanasi"), true, "active destination ID should resolve");
assert.strictEqual(validRoute.openedSite, "varanasi", "valid scan should open its destination");
assert.strictEqual(validRoute.route("ayodhya"), true, "active destination slug should resolve");
assert.strictEqual(validRoute.openedSite, "ayodhya", "slug should open the matching destination");

const inactiveMetadata = {
  ...destinations,
  prayagraj: { ...destinations.prayagraj, active: false }
};
const invalidRoute = routeContext(inactiveMetadata);
assert.strictEqual(invalidRoute.route("prayagraj"), false, "inactive destinations should not resolve");
assert.strictEqual(invalidRoute.route("not-a-site"), false, "unknown site IDs should not resolve");
assert.strictEqual(invalidRoute.elements["invalid-scan-state"].style.display, "block", "invalid route should show a safe message");

console.log("GhoomoUP destination and QR foundation checks passed.");
