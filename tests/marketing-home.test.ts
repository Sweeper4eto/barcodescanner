import assert from "node:assert/strict";
import test from "node:test";
import manifest from "../src/app/manifest";
import { t } from "../src/i18n";
import { WHATS_NEW_CATALOG } from "../src/lib/whats-new-catalog";

const HOME_COPY_KEYS = [
  "home.tagline",
  "home.description",
  "home.capScanBody",
  "home.capDocumentBody",
  "home.capTeamBody",
  "home.howStep2Body",
  "home.faqMobileA",
  "home.ctaBody",
  "metadata.title",
  "metadata.ogTitle",
  "metadata.ogDescription",
  "metadata.manifestName",
] as const;

test("PWA manifest opens installed apps on /app", () => {
  const data = manifest();
  assert.equal(data.start_url, "/app");
  assert.equal(data.display, "standalone");
  assert.ok(data.short_name);
});

test("marketing homepage copy has no em dashes (EN and BG)", () => {
  for (const key of HOME_COPY_KEYS) {
    for (const locale of ["en", "bg"] as const) {
      const value = t(key, undefined, locale);
      assert.equal(
        value.includes("\u2014"),
        false,
        `${locale} ${key} still has an em dash: ${value}`,
      );
    }
  }
});

test("whats-new catalog includes the marketing homepage redesign entry", () => {
  const entry = WHATS_NEW_CATALOG.find(
    (item) => item.key === "2026-11-marketing-homepage-desktop",
  );
  assert.ok(entry, "missing catalog key 2026-11-marketing-homepage-desktop");
  assert.equal(entry?.href, "/");
  assert.ok((entry?.titleEn.length ?? 0) > 0);
  assert.ok((entry?.titleBg.length ?? 0) > 0);
});
