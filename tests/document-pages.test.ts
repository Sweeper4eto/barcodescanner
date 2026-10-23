import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  documentPagesCanImport,
  documentPagesImportItems,
  filterDocumentPagesBySearch,
  flattenDocumentPageItems,
  markDocumentPageProcessing,
  removeDocumentPageItem,
  removeDocumentPageItemsWithoutExpiry,
  removeDocumentPagesItemsWithoutExpiry,
  replaceDocumentPageContent,
  setDocumentPageError,
  updateDocumentPageItem,
  type DocumentDraftItem,
  type DocumentPageDraft,
} from "../src/lib/document-draft";

const item = (
  overrides: Partial<DocumentDraftItem> & Pick<DocumentDraftItem, "key" | "name">,
): DocumentDraftItem => ({
  barcode: "",
  articul: "",
  expiryYmd: "2026-12-01",
  quantity: "1",
  productId: null,
  productImagePath: null,
  matchSource: null,
  ...overrides,
});

function page(
  id: string,
  items: DocumentDraftItem[],
  overrides: Partial<DocumentPageDraft> = {},
): DocumentPageDraft {
  return {
    id,
    label: `${id}.jpg`,
    imageDataUrl: `data:image/jpeg;base64,${id}`,
    status: "ready",
    items,
    error: null,
    ...overrides,
  };
}

describe("document multi-page review helpers", () => {
  const samplePages = () => [
    page("p1", [item({ key: "a1", name: "Milk" }), item({ key: "a2", name: "Bread" })]),
    page("p2", [item({ key: "b1", name: "Yogurt" })]),
    page("p3", [
      item({ key: "c1", name: "Cheese", expiryYmd: "" }),
      item({ key: "c2", name: "Butter" }),
    ]),
  ];

  it("flattenDocumentPageItems concatenates in page order", () => {
    const flat = flattenDocumentPageItems(samplePages());
    assert.deepEqual(
      flat.map((row) => row.key),
      ["a1", "a2", "b1", "c1", "c2"],
    );
  });

  it("markDocumentPageProcessing only touches the target page", () => {
    const next = markDocumentPageProcessing(samplePages(), "p2");
    assert.equal(next[0].status, "ready");
    assert.equal(next[1].status, "processing");
    assert.equal(next[1].error, null);
    assert.equal(next[2].status, "ready");
    assert.deepEqual(
      next.map((entry) => entry.id),
      ["p1", "p2", "p3"],
    );
    // Sibling items unchanged while processing.
    assert.deepEqual(
      next[0].items.map((row) => row.key),
      ["a1", "a2"],
    );
    assert.deepEqual(
      next[2].items.map((row) => row.key),
      ["c1", "c2"],
    );
  });

  it("markDocumentPageProcessing can swap the thumbnail while OCR runs", () => {
    const next = markDocumentPageProcessing(samplePages(), "p2", {
      imageDataUrl: "data:image/jpeg;base64,RETAKE",
      label: "retake.jpg",
    });
    assert.equal(next[1].status, "processing");
    assert.equal(next[1].imageDataUrl, "data:image/jpeg;base64,RETAKE");
    assert.equal(next[1].label, "retake.jpg");
    assert.equal(next[0].imageDataUrl, samplePages()[0].imageDataUrl);
  });

  it("setDocumentPageError keeps old items after failed OCR", () => {
    const processing = markDocumentPageProcessing(samplePages(), "p2");
    const failed = setDocumentPageError(processing, "p2", "Could not read");
    assert.equal(failed[1].status, "ready");
    assert.equal(failed[1].error, "Could not read");
    assert.equal(failed[1].items[0].name, "Yogurt");
    assert.equal(failed[0].items.length, 2);
    assert.equal(failed[2].items.length, 2);
  });

  it("replaceDocumentPageContent swaps one page in the same slot", () => {
    const before = samplePages();
    const replaced = replaceDocumentPageContent(before, "p2", {
      imageDataUrl: "data:image/jpeg;base64,NEW",
      label: "retake-p2.jpg",
      items: [
        item({ key: "new1", name: "Retaken A" }),
        item({ key: "new2", name: "Retaken B" }),
      ],
    });

    assert.deepEqual(
      replaced.map((entry) => entry.id),
      ["p1", "p2", "p3"],
      "page order / ids stay put",
    );
    assert.equal(replaced[1].imageDataUrl, "data:image/jpeg;base64,NEW");
    assert.equal(replaced[1].label, "retake-p2.jpg");
    assert.equal(replaced[1].status, "ready");
    assert.equal(replaced[1].error, null);
    assert.deepEqual(
      replaced[1].items.map((row) => row.name),
      ["Retaken A", "Retaken B"],
    );
    // Neighbors untouched.
    assert.equal(replaced[0].imageDataUrl, before[0].imageDataUrl);
    assert.deepEqual(
      replaced[0].items.map((row) => row.key),
      ["a1", "a2"],
    );
    assert.deepEqual(
      replaced[2].items.map((row) => row.key),
      ["c1", "c2"],
    );
  });

  it("replaceDocumentPageContent keeps prior label when next label blank", () => {
    const replaced = replaceDocumentPageContent(samplePages(), "p1", {
      imageDataUrl: "data:image/jpeg;base64,X",
      label: "   ",
      items: [item({ key: "z", name: "Only" })],
    });
    assert.equal(replaced[0].label, "p1.jpg");
  });

  it("replace middle page then flatten uses new rows only for that page", () => {
    const replaced = replaceDocumentPageContent(samplePages(), "p2", {
      imageDataUrl: "data:image/jpeg;base64,MID",
      items: [item({ key: "m1", name: "Middle only" })],
    });
    assert.deepEqual(
      flattenDocumentPageItems(replaced).map((row) => row.key),
      ["a1", "a2", "m1", "c1", "c2"],
    );
  });

  it("updateDocumentPageItem patches a row inside its page", () => {
    const next = updateDocumentPageItem(samplePages(), "b1", {
      name: "Greek Yogurt",
      quantity: "3",
    });
    assert.equal(next[1].items[0].name, "Greek Yogurt");
    assert.equal(next[1].items[0].quantity, "3");
    assert.equal(next[0].items[0].name, "Milk");
  });

  it("removeDocumentPageItem drops only that row", () => {
    const next = removeDocumentPageItem(samplePages(), "a1");
    assert.deepEqual(
      next[0].items.map((row) => row.key),
      ["a2"],
    );
    assert.equal(next[1].items.length, 1);
    assert.equal(next[2].items.length, 2);
  });

  it("removeDocumentPagesItemsWithoutExpiry keeps dated rows across pages", () => {
    const next = removeDocumentPagesItemsWithoutExpiry(samplePages());
    assert.deepEqual(
      flattenDocumentPageItems(next).map((row) => row.key),
      ["a1", "a2", "b1", "c2"],
    );
    assert.equal(next[2].items.some((row) => row.key === "c1"), false);
  });

  it("removeDocumentPageItemsWithoutExpiry only clears one page", () => {
    const pages = [
      page("p1", [
        item({ key: "a1", name: "Milk", expiryYmd: "" }),
        item({ key: "a2", name: "Bread" }),
      ]),
      page("p2", [
        item({ key: "b1", name: "Yogurt", expiryYmd: "" }),
        item({ key: "b2", name: "Juice" }),
      ]),
    ];
    const next = removeDocumentPageItemsWithoutExpiry(pages, "p1");
    assert.deepEqual(
      next[0].items.map((row) => row.key),
      ["a2"],
    );
    assert.deepEqual(
      next[1].items.map((row) => row.key),
      ["b1", "b2"],
    );
  });

  it("filterDocumentPagesBySearch hides pages with no matches", () => {
    const pages = samplePages();
    assert.equal(filterDocumentPagesBySearch(pages, "").length, 3);
    assert.deepEqual(
      filterDocumentPagesBySearch(pages, "yogurt").map((entry) => entry.id),
      ["p2"],
    );
    assert.deepEqual(
      filterDocumentPagesBySearch(pages, "cheese").map((entry) => entry.id),
      ["p3"],
    );
    assert.equal(filterDocumentPagesBySearch(pages, "nope").length, 0);
  });

  it("documentPagesCanImport requires ready pages and valid rows", () => {
    assert.equal(documentPagesCanImport([]), false);

    const ok = [
      page("p1", [item({ key: "a1", name: "Milk" })]),
      page("p2", [item({ key: "b1", name: "Bread" })]),
    ];
    assert.equal(documentPagesCanImport(ok), true);

    // One photo still reading must not block importing the other ready pages.
    const processing = markDocumentPageProcessing(ok, "p1");
    assert.equal(documentPagesCanImport(processing), true);
    assert.deepEqual(
      documentPagesImportItems(processing).map((row) => row.key),
      ["b1"],
    );

    // Only the in-flight page → nothing to import yet.
    assert.equal(
      documentPagesCanImport(markDocumentPageProcessing(ok, "p1").filter((p) => p.id === "p1")),
      false,
    );

    const missingDate = [
      page("p1", [item({ key: "a1", name: "Milk", expiryYmd: "" })]),
    ];
    assert.equal(documentPagesCanImport(missingDate), false);

    const emptyItems = [page("p1", [])];
    assert.equal(documentPagesCanImport(emptyItems), false);
  });

  it("failed replace then successful replace restores importability", () => {
    let pages = samplePages();
    pages = markDocumentPageProcessing(pages, "p3");
    pages = setDocumentPageError(pages, "p3", "timeout");
    assert.equal(documentPagesCanImport(pages), false); // c1 still missing date

    pages = replaceDocumentPageContent(pages, "p3", {
      imageDataUrl: "data:image/jpeg;base64,FIXED",
      items: [
        item({ key: "f1", name: "Fixed Cheese" }),
        item({ key: "f2", name: "Fixed Butter" }),
      ],
    });
    assert.equal(pages[2].error, null);
    assert.equal(documentPagesCanImport(pages), true);
    assert.deepEqual(
      pages.map((entry) => entry.id),
      ["p1", "p2", "p3"],
    );
  });
});
