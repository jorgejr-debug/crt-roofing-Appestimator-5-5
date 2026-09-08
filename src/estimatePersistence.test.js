import test from "node:test";
import assert from "node:assert/strict";
import { prepareEstimateMutationRow } from "./estimatePersistence.js";

test("new estimate inserts omit the database id so PostgreSQL generates it", () => {
  const row = prepareEstimateMutationRow({
    id: undefined,
    local_estimate_id: "local-61",
    owner_id: "owner-1",
  });

  assert.equal(Object.hasOwn(row, "id"), false);
  assert.equal(row.local_estimate_id, "local-61");
});

test("estimate updates cannot accidentally mutate the primary key", () => {
  const row = prepareEstimateMutationRow({
    id: "database-id-1",
    name: "Updated estimate",
  });

  assert.deepEqual(row, { name: "Updated estimate" });
});
