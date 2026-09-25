import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("signed-in screens use the employee title instead of collapsing roles into salesperson", () => {
  assert.match(appSource, /const getAccountTitle = \(\) =>/);
  assert.match(appSource, /if \(authRole === "cfo"\) return "CFO"/);
  assert.match(appSource, /if \(authRole === "project_manager"\) return "Project Manager \/ Production"/);
  assert.doesNotMatch(appSource, /isAdminUser \? "Admin" : "Salesperson"/);
  assert.doesNotMatch(appSource, /isProjectManager \? "Project Manager \/ Production" : isAdminUser \? "Admin" : "Salesperson"/);
});

test("profile and sidebar show the same employee title", () => {
  assert.match(appSource, /<span>Title<\/span><strong>\{getAccountTitle\(\)\}<\/strong>/);
  assert.match(appSource, /portalSidebarAccountText"><strong>\{getAccountDisplayName\(\)\}<\/strong><span>\{getAccountTitle\(\)\}<\/span>/);
});
