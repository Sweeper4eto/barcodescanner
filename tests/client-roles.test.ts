import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAccountOwner,
  isAppClientRole,
  isStoreManagerLike,
  usesOwnerBulkRemoveLimit,
} from "../src/lib/client-roles";
import { bulkRemoveMaxForClientRole, BULK_REMOVE_MAX_OWNER, BULK_REMOVE_MAX_MEMBER } from "../src/lib/expiry-bulk-remove";

describe("client roles", () => {
  it("recognizes known roles", () => {
    assert.equal(isAppClientRole("OWNER"), true);
    assert.equal(isAppClientRole("STORE_MANAGER"), true);
    assert.equal(isAppClientRole("MEMBER"), true);
    assert.equal(isAppClientRole("ADMIN"), false);
  });

  it("treats only OWNER as account owner", () => {
    assert.equal(isAccountOwner("OWNER"), true);
    assert.equal(isAccountOwner("STORE_MANAGER"), false);
    assert.equal(isAccountOwner("MEMBER"), false);
  });

  it("treats OWNER and STORE_MANAGER as store-manager-like", () => {
    assert.equal(isStoreManagerLike("OWNER"), true);
    assert.equal(isStoreManagerLike("STORE_MANAGER"), true);
    assert.equal(isStoreManagerLike("MEMBER"), false);
  });

  it("gives store managers the owner bulk-remove cap", () => {
    assert.equal(usesOwnerBulkRemoveLimit("STORE_MANAGER"), true);
    assert.equal(bulkRemoveMaxForClientRole("STORE_MANAGER"), BULK_REMOVE_MAX_OWNER);
    assert.equal(bulkRemoveMaxForClientRole("MEMBER"), BULK_REMOVE_MAX_MEMBER);
  });
});
