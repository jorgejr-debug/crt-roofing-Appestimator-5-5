import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("shared lead deletion is confirmed and completed server-first", () => {
  assert.match(appSource, /const deleteCrmLead = async \(leadId\) =>/);
  assert.match(appSource, /window\.confirm\(`Delete \$\{leadName\} from the shared CRM\? This cannot be undone\.`\)/);
  assert.match(appSource, /const result = await deleteCrmLeadFromSupabase\(leadId\)/);
  const serverDeleteIndex = appSource.indexOf("const result = await deleteCrmLeadFromSupabase(leadId)");
  const localDeleteIndex = appSource.indexOf("setCrmLeads((current) => current.filter((item) => item.id !== leadId))");
  assert.ok(serverDeleteIndex >= 0 && localDeleteIndex > serverDeleteIndex);
});

test("failed shared deletion keeps the visible lead and reports the error", () => {
  assert.match(appSource, /if \(result\?\.error\)[\s\S]*The lead was not deleted:[\s\S]*return/);
  assert.match(appSource, /crmLeadDeletingId === lead\.id \? "Deleting…" : "Delete"/);
});
