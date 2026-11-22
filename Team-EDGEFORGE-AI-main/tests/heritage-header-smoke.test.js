const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const logo = fs.readFileSync(path.join(root, "assets", "ghoomoup-mark.svg"), "utf8");

assert.match(html, /assets\/ghoomoup-mark\.svg/, "Header must use the GhoomoUP mark");
assert.match(html, /Uttar Pradesh · One scan away/, "Brand lockup must include the GhoomoUP positioning line");
assert.match(logo, /heritage arch/, "Logo must explain its heritage mark");

assert.match(html, /id="account-menu-trigger"[^>]+aria-expanded="false"/, "Three-dot trigger must expose menu state");
assert.match(html, /id="account-menu-panel"[^>]+role="menu"/, "Account options must use an accessible menu");
assert.match(html, /function toggleAccountMenu\(event\)/, "Account menu toggle must be implemented");
assert.match(html, /function closeAccountMenu\(\)/, "Account menu close behavior must be implemented");
assert.match(html, /document\.getElementById\("header-auth-menu-content"\)/, "Dynamic auth actions must stay inside the menu");
assert.match(html, /function showLandingView\(\) \{\s+closeAccountMenu\(\);/, "Account menu must close when returning home");
assert.match(html, /function openSiteDetail\(siteKey\) \{\s+closeAccountMenu\(\);/, "Account menu must close when opening a destination");

assert.match(html, /assets\/varanasi-illustration\.svg/, "The landing hero must use the destination illustration");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
assert.deepStrictEqual([...new Set(duplicates)], [], `Duplicate HTML IDs found: ${duplicates.join(", ")}`);

console.log("Heritage branding and account-menu smoke checks passed.");
