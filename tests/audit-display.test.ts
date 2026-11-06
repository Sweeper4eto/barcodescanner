import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAuditDateDisplay,
  parseAuditGoodsDetails,
} from "../src/lib/audit-display";

test("parseAuditGoodsDetails structures inventory add and hides barcode + store", () => {
  const parsed = parseAuditGoodsDetails(
    'product "Кашкавал Витоша 300г" · barcode 3800123456007 · qty 4 · store "Sweps магазин" · expires 2026-11-27',
  );
  assert.equal(parsed.isGoods, true);
  assert.equal(parsed.title, "Кашкавал Витоша 300г");
  assert.equal(parsed.quantity, 4);
  assert.equal(parsed.quantityText, null);
  assert.equal(parsed.expiryYmd, "2026-11-27");
  assert.equal(parsed.expiryText, null);
  assert.equal(parsed.fallback, null);
});

test("parseAuditGoodsDetails handles empty product name", () => {
  const parsed = parseAuditGoodsDetails(
    'product "" · barcode NBMW5GC1JWK6HLA8 · qty 1 · store "Sweps магазин" · expires 2026-11-13',
  );
  assert.equal(parsed.isGoods, true);
  assert.equal(parsed.title, null);
  assert.equal(parsed.quantity, 1);
  assert.equal(parsed.expiryYmd, "2026-11-13");
});

test("parseAuditGoodsDetails strips barcode from change lists", () => {
  const parsed = parseAuditGoodsDetails(
    'product "Яйца" · changes: barcode 1 → 2; store "A"; qty 1 → 3; expires 2026-11-13 → 2026-11-20',
  );
  assert.equal(parsed.isGoods, true);
  assert.equal(parsed.title, "Яйца");
  assert.equal(parsed.quantity, 3);
  assert.equal(parsed.quantityText, "1 → 3");
  assert.equal(parsed.expiryYmd, "2026-11-20");
  assert.equal(parsed.expiryText, "13.11.2026 → 20.11.2026");
});

test("parseAuditGoodsDetails leaves non-goods details intact", () => {
  const parsed = parseAuditGoodsDetails('role owner · client "Sweps"');
  assert.equal(parsed.isGoods, false);
  assert.equal(parsed.fallback, 'role owner · client "Sweps"');
});

test("formatAuditDateDisplay formats ISO dates", () => {
  assert.equal(formatAuditDateDisplay("2026-11-13"), "13.11.2026");
});
