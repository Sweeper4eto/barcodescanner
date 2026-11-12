import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAllowedRemoteImageUrl,
  saveRemoteProductImage,
} from "../src/lib/product-image";

test("isAllowedRemoteImageUrl allows Open Food Facts hosts only", () => {
  assert.equal(
    isAllowedRemoteImageUrl(
      "https://images.openfoodfacts.org/images/products/1.jpg",
    ),
    true,
  );
  assert.equal(
    isAllowedRemoteImageUrl("https://world.openfoodfacts.org/x.png"),
    true,
  );
  assert.equal(isAllowedRemoteImageUrl("http://127.0.0.1/secret"), false);
  assert.equal(isAllowedRemoteImageUrl("https://evil.example/a.png"), false);
  assert.equal(
    isAllowedRemoteImageUrl("https://openfoodfacts.org.evil/a.png"),
    false,
  );
});

test("saveRemoteProductImage rejects disallowed hosts without fetching", async () => {
  let called = false;
  const result = await saveRemoteProductImage(
    "http://169.254.169.254/latest/meta-data/",
    async () => {
      called = true;
      return new Response("nope");
    },
  );
  assert.equal(result, null);
  assert.equal(called, false);
});
