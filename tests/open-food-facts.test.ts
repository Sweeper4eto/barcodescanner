import test from "node:test";
import assert from "node:assert/strict";
import {
  pickOpenFoodFactsImageUrl,
  pickOpenFoodFactsName,
} from "../src/lib/open-food-facts";
import {
  isLocalUploadPath,
  isRemoteImageUrl,
} from "../src/lib/product-image";

test("pickOpenFoodFactsName prefers Bulgarian then generic name", () => {
  assert.equal(
    pickOpenFoodFactsName({
      product_name_bg: "Мляко",
      product_name: "Milk",
      product_name_en: "Milk EN",
    }),
    "Мляко",
  );
  assert.equal(
    pickOpenFoodFactsName({
      product_name: "Yogurt",
      brands: "Brand",
    }),
    "Yogurt",
  );
  assert.equal(pickOpenFoodFactsName({ brands: "Only Brand" }), "Only Brand");
  assert.equal(pickOpenFoodFactsName({}), "");
});

test("pickOpenFoodFactsImageUrl prefers small front image", () => {
  assert.equal(
    pickOpenFoodFactsImageUrl({
      image_front_small_url: "https://images.openfoodfacts.org/small.jpg",
      image_url: "https://images.openfoodfacts.org/large.jpg",
    }),
    "https://images.openfoodfacts.org/small.jpg",
  );
  assert.equal(
    pickOpenFoodFactsImageUrl({
      image_url: "https://images.openfoodfacts.org/large.jpg",
    }),
    "https://images.openfoodfacts.org/large.jpg",
  );
  assert.equal(pickOpenFoodFactsImageUrl({ image_url: "not-a-url" }), null);
  assert.equal(pickOpenFoodFactsImageUrl({}), null);
});

test("image path helpers classify local vs remote", () => {
  assert.equal(isLocalUploadPath("/uploads/a.jpg"), true);
  assert.equal(isLocalUploadPath("https://cdn.example/a.jpg"), false);
  assert.equal(isRemoteImageUrl("https://cdn.example/a.jpg"), true);
  assert.equal(isRemoteImageUrl("/uploads/a.jpg"), false);
});
