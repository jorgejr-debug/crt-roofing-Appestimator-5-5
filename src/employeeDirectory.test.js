import { readAppSource } from "../tests/appSource.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { resolveEmployeeDisplayName } from "./employeeDirectory.js";

test("full employee name replaces a stale one-character display name", () => {
  assert.equal(
    resolveEmployeeDisplayName({ first_name: "Natalia", last_name: "Valdez", display_name: "N" }),
    "Natalia Valdez",
  );
});

test("legacy display name remains available when separate names are missing", () => {
  assert.equal(resolveEmployeeDisplayName({ display_name: "CRT Roofing Crew" }), "CRT Roofing Crew");
});

test("employee editor scrolls into view and clearly changes Save to Update", () => {
  const source = readAppSource();
  assert.match(source, /employeeManagementEditorRef\.current\?\.scrollIntoView/);
  assert.match(source, /isEditingEmployee \? "Update employee" : "Save employee"/);
});
