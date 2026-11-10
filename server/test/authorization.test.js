import test from "node:test";
import assert from "node:assert/strict";

test("task roles are restricted to admin and member", async () => {
  const { default: mongoose } = await import("mongoose");
  const { default: User } = await import("../src/models/User.js");
  const schema = User.schema.path("role");
  assert.deepEqual(schema.enumValues, ["admin", "member"]);
  assert.equal(schema.options.default, "member");
  await mongoose.disconnect();
});
