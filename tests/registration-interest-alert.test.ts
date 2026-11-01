import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  REGISTER_INTEREST_TOPIC,
} from "../src/lib/registration-interest-alert";

describe("registration interest alert", () => {
  test("uses a dedicated support topic", () => {
    assert.equal(REGISTER_INTEREST_TOPIC, "register_interest");
  });
});
