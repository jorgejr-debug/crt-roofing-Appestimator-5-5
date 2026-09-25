import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./ProposalRequests.jsx", import.meta.url), "utf8");

test("proposal requests open to the active queue without deleting history", () => {
  assert.match(source, /status: "active"/);
  assert.match(source, /filter === "active"\) return !\["closed", "declined"\]\.includes\(status\)/);
  assert.match(source, /filter === "history"\) return \["closed", "declined"\]\.includes\(status\)/);
  assert.match(source, /<option value="history">Completed \/ declined history<\/option>/);
  assert.match(source, /<option value="all">All statuses<\/option>/);
});
