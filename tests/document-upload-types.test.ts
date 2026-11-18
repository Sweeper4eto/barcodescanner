import assert from "node:assert/strict";
import { test } from "node:test";
import { spreadsheetBytesToText } from "../src/lib/document-spreadsheet";
import {
  ensureDataUrlMime,
  isAcceptedDocumentFile,
  isImageDataUrl,
  isSpreadsheetMime,
  mimeFromFilename,
} from "../src/lib/document-upload-types";

test("mimeFromFilename maps pdf and xlsx", () => {
  assert.equal(mimeFromFilename("list.PDF"), "application/pdf");
  assert.equal(
    mimeFromFilename("stock.xlsx"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
});

test("isImageDataUrl detects photos only", () => {
  assert.equal(isImageDataUrl("data:image/jpeg;base64,aaa"), true);
  assert.equal(isImageDataUrl("data:application/pdf;base64,aaa"), false);
});

test("ensureDataUrlMime fixes empty octet-stream for pdf", () => {
  const fixed = ensureDataUrlMime(
    "data:application/octet-stream;base64,QQ==",
    "note.pdf",
  );
  assert.equal(fixed.startsWith("data:application/pdf;"), true);
});

test("isSpreadsheetMime covers csv and excel", () => {
  assert.equal(isSpreadsheetMime("text/csv"), true);
  assert.equal(
    isSpreadsheetMime(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
    true,
  );
  assert.equal(isSpreadsheetMime("application/pdf"), false);
});

test("spreadsheetBytesToText keeps csv text", () => {
  const csv = "Име,Годност,К-во\nМляко,01.12.2027,2\n";
  const text = spreadsheetBytesToText(Buffer.from(csv, "utf8"), "text/csv");
  assert.match(text, /Мляко/);
});

test("isAcceptedDocumentFile uses extension when type empty", () => {
  const file = {
    name: "delivery.pdf",
    type: "",
    size: 10,
  } as File;
  assert.equal(isAcceptedDocumentFile(file), true);
});
