import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanProductName,
  isLowQualityProductName,
  pickBestProductName,
} from "../src/lib/product-name";

test("cleanProductName decodes entities and strips decorative bangs/quotes", () => {
  assert.equal(cleanProductName('Germeni &quot;7 mixt&quot;'), "Germeni 7 mixt");
  assert.equal(
    cleanProductName("!Ajua!, Caffeine Free Soda, Pineapple"),
    "Ajua, Caffeine Free Soda, Pineapple",
  );
  assert.equal(
    cleanProductName("! ALIMENTS POUR CHIENS !"),
    "ALIMENTS POUR CHIENS",
  );
  assert.equal(
    cleanProductName('""Ultimate Steakhouse"" Burger Seasoning'),
    "Ultimate Steakhouse Burger Seasoning",
  );
  assert.equal(
    cleanProductName("'Prodhead'&gt;yellow Curry Paste"),
    "yellow Curry Paste",
  );
  assert.equal(cleanProductName("# mix peruano"), "mix peruano");
  assert.equal(cleanProductName("  ,,pestrushka,,  "), "pestrushka");
  assert.equal(
    cleanProductName("Sardines a l'huile d'olive"),
    "Sardines a l'huile d'olive",
  );
});

test("isLowQualityProductName detects foodservice SKU-style names", () => {
  assert.equal(
    isLowQualityProductName('"Chop,Pk,Bnls,Gm,Et12,4Oz,10#,Z"'),
    true,
  );
  assert.equal(isLowQualityProductName("Bean,Brs,Fc Fine R,2/5#"), true);
  assert.equal(
    isLowQualityProductName("Ajua, Caffeine Free Soda, Pineapple"),
    false,
  );
  assert.equal(isLowQualityProductName("Coca-Cola Zero"), false);
});

test("pickBestProductName prefers clean readable candidates", () => {
  assert.equal(
    pickBestProductName([
      '""Chop,Pk,Bnls,Gm,Et12,4Oz,10#,Z""',
      "Pork Chop Boneless",
      "",
    ]),
    "Pork Chop Boneless",
  );
  assert.equal(
    pickBestProductName(["Milk EN", "\u041C\u043B\u044F\u043A\u043E"]),
    "\u041C\u043B\u044F\u043A\u043E",
  );
});
