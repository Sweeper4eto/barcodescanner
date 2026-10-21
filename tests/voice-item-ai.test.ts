import test from "node:test";
import assert from "node:assert/strict";
import {
  extractQuantityFromTranscript,
  isVoiceTranscribeModel,
  nameFromTranscript,
  normalizeVoiceAudioMime,
  parseVoiceAudioDataUrl,
  pickTranscript,
  resolveVoiceAiMode,
  textFromGeminiResponse,
  transcriptFromModelText,
  VOICE_CUSTOM_VOCABULARY,
  voiceItemFromModelText,
  voiceItemFromSmartDraft,
  voiceItemFromTranscript,
  voiceModelsToTry,
} from "../src/lib/voice-item-ai";

test("parseVoiceAudioDataUrl accepts codec params from MediaRecorder", () => {
  const { mime, base64 } = parseVoiceAudioDataUrl(
    "data:audio/webm;codecs=opus;base64,AAAA",
  );
  assert.equal(mime, "audio/webm");
  assert.equal(base64, "AAAA");
});

test("parseVoiceAudioDataUrl accepts plain audio/mp4 data URLs", () => {
  const { mime, base64 } = parseVoiceAudioDataUrl(
    "data:audio/mp4;base64,BBBB",
  );
  assert.equal(mime, "audio/mp4");
  assert.equal(base64, "BBBB");
});

test("normalizeVoiceAudioMime maps Safari video/mp4 audio to audio/mp4", () => {
  assert.equal(normalizeVoiceAudioMime("video/mp4"), "audio/mp4");
  assert.equal(normalizeVoiceAudioMime("audio/webm;codecs=opus"), "audio/webm");
});

test("voiceItemFromTranscript keeps product text and parses qty/date", () => {
  const item = voiceItemFromTranscript(
    "тунквана вафла швепс 10 броя 3ти май 2031 година",
  );
  assert.equal(item.name, "тунквана вафла швепс");
  assert.equal(item.quantity, 10);
  assert.equal(item.expiryDate, "2031-05-03");
});

test("nameFromTranscript strips qty and date only", () => {
  assert.equal(
    nameFromTranscript("фъстъци ройс 2 броя 12.26"),
    "фъстъци ройс",
  );
  assert.equal(
    nameFromTranscript("тунквана вафла швепс 10 броя 3ти май 2031 година"),
    "тунквана вафла швепс",
  );
  // STT crumbs: bare qty number + spaced ordinal day leftover.
  assert.equal(
    nameFromTranscript("тунквана вафла швепс 10 3 ти май 2031"),
    "тунквана вафла швепс",
  );
  // STT often writes bare day without ти/та — must not leave "3" in the name.
  assert.equal(
    nameFromTranscript("кисела диня 10 броя 3 май 2031"),
    "кисела диня",
  );
  assert.equal(
    nameFromTranscript("кисела диня 10 pieces 3 май 2031 година"),
    "кисела диня",
  );
});

test("voiceItemFromModelText reads transcript-only JSON", () => {
  const item = voiceItemFromModelText(
    JSON.stringify({
      transcript: "кисело мляко 2 броя 15.11.2026",
    }),
  );
  assert.equal(item.name, "кисело мляко");
  assert.equal(item.quantity, 2);
  assert.equal(item.expiryDate, "2026-11-15");
});

test("voiceItemFromModelText smart draft prefers model name and fills gaps from transcript", () => {
  const item = voiceItemFromModelText(
    JSON.stringify({
      transcript: "тунквана вафла швепс 10 броя 3ти май 2031 година",
      name: "тунквана вафла швепс",
      quantity: 1,
      expiryIso: null,
      expiryPrinted: null,
    }),
  );
  assert.equal(item.name, "тунквана вафла швепс");
  // Model qty was wrong (1); transcript parse recovers 10 and the date.
  assert.equal(item.quantity, 10);
  assert.equal(item.expiryDate, "2031-05-03");
});

test("voiceItemFromSmartDraft keeps unusual product names from the model", () => {
  const item = voiceItemFromSmartDraft({
    name: "кисела диня",
    quantity: 2,
    expiryIso: "2029-05-03",
    transcript: "кисела диня 2 броя трети май двадесет и девета",
  });
  assert.equal(item.name, "кисела диня");
  assert.equal(item.quantity, 2);
  assert.equal(item.expiryDate, "2029-05-03");
});

test("resolveVoiceAiMode defaults to smart; exact via env", () => {
  const prev = process.env.VOICE_AI_MODE;
  try {
    delete process.env.VOICE_AI_MODE;
    assert.equal(resolveVoiceAiMode(), "smart");
    process.env.VOICE_AI_MODE = "exact";
    assert.equal(resolveVoiceAiMode(), "exact");
    process.env.VOICE_AI_MODE = "understand";
    assert.equal(resolveVoiceAiMode(), "smart");
  } finally {
    if (prev === undefined) delete process.env.VOICE_AI_MODE;
    else process.env.VOICE_AI_MODE = prev;
  }
});

test("voiceModelsToTry smart skips transcribe-first list", () => {
  const smart = voiceModelsToTry("gemini-3.6-flash", "smart");
  assert.equal(smart[0], "gemini-3.6-flash");
  assert.ok(!smart.some((m) => /transcribe/i.test(m)));
});

test("voiceItemFromModelText falls back to structured fields without transcript", () => {
  const item = voiceItemFromModelText(
    JSON.stringify({
      name: "Bread",
      quantity: 1,
      expiryPrinted: null,
      expiryIso: null,
    }),
  );
  assert.equal(item.name, "Bread");
  assert.equal(item.quantity, 1);
});

test("pickTranscript prefers Gemini over wrong browser STT", () => {
  assert.equal(
    pickTranscript("кисело мляко", "кисела диня"),
    "кисела диня",
  );
  assert.equal(pickTranscript("кисело мляко", ""), "кисело мляко");
  assert.equal(pickTranscript(undefined, "рибни филета"), "рибни филета");
});

test("voiceItemFromTranscript keeps кисела диня as spoken", () => {
  const item = voiceItemFromTranscript("кисела диня 2 броя");
  assert.equal(item.name, "кисела диня");
  assert.equal(item.quantity, 2);
});

test("voiceItemFromTranscript keeps day for трети/трета май двадесет и девета", () => {
  for (const spoken of [
    "кисела диня 10 броя трети май двадесет и девета година",
    "кисела диня 10 броя трета май двадесет и девета година",
    "кисела диня 10 броя трети май двадесет и девети година",
  ]) {
    const item = voiceItemFromTranscript(spoken);
    assert.equal(item.name, "кисела диня", spoken);
    assert.equal(item.quantity, 10, spoken);
    assert.equal(item.expiryDate, "2029-05-03", spoken);
  }
});

test("voice date after броя: ден/месец/година fillers and short years", () => {
  const cases: Array<[string, string, number, string]> = [
    [
      "кисела диня 10 броя 14-ти месец май 2029 година",
      "кисела диня",
      10,
      "2029-05-14",
    ],
    [
      "кисела диня 10 броя месец май 2029 година",
      "кисела диня",
      10,
      "2029-05-31",
    ],
    ["швепс 5 броя 15 юни 28 ма", "швепс", 5, "2028-06-15"],
    ["швепс 5 броя 15, юни, 28-ма", "швепс", 5, "2028-06-15"],
    ["хляб 2 броя ден 3 май 2031", "хляб", 2, "2031-05-03"],
    ["вода 3 броя май месец двадесет и девета", "вода", 3, "2029-05-31"],
  ];
  for (const [spoken, name, qty, expiry] of cases) {
    const item = voiceItemFromTranscript(spoken);
    assert.equal(item.name, name, spoken);
    assert.equal(item.quantity, qty, spoken);
    assert.equal(item.expiryDate, expiry, spoken);
  }
});

test("voice STT prefers gemini-3.5-transcribe with brand/unit vocab only", () => {
  assert.equal(isVoiceTranscribeModel("gemini-3.5-transcribe"), true);
  assert.equal(isVoiceTranscribeModel("gemini-3.6-flash"), false);
  assert.equal(voiceModelsToTry("gemini-3.5-transcribe")[0], "gemini-3.5-transcribe");
  assert.ok(VOICE_CUSTOM_VOCABULARY.includes("броя"));
  assert.ok(VOICE_CUSTOM_VOCABULARY.includes("кисела диня"));
  assert.ok(!VOICE_CUSTOM_VOCABULARY.includes("мляко"));
});

test("transcriptFromModelText accepts plain Transcribe text", () => {
  assert.equal(
    transcriptFromModelText("кисела диня 10 броя 3ти май 2031"),
    "кисела диня 10 броя 3ти май 2031",
  );
  assert.equal(
    transcriptFromModelText('{"transcript":"рибни филета 2 броя"}'),
    "рибни филета 2 броя",
  );
});

test("textFromGeminiResponse reads audioTranscription.text from Transcribe", () => {
  assert.equal(
    textFromGeminiResponse({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              { text: "" },
              {
                audioTranscription: {
                  text: "кисела диня 10 броя",
                },
              },
            ],
          },
        },
      ],
    }),
    "кисела диня 10 броя",
  );
});

test("extractQuantityFromTranscript handles spoken and garbled броя", () => {
  assert.equal(extractQuantityFromTranscript("кисела диня 10 броя"), 10);
  assert.equal(extractQuantityFromTranscript("кисела диня десет броя"), 10);
  assert.equal(
    extractQuantityFromTranscript("кисела диня двадесет и пет броя"),
    25,
  );
  assert.equal(extractQuantityFromTranscript("кисела диня броя 7"), 7);
  assert.equal(extractQuantityFromTranscript("кисела диня 3 броят"), 3);
  assert.equal(extractQuantityFromTranscript("швепс 10 3ти май 2031"), 10);
  // Day before month is NOT quantity.
  assert.equal(extractQuantityFromTranscript("хляб 3 май 2031"), null);
  const item = voiceItemFromTranscript(
    "тунквана вафла десет броя 3ти май 2031",
  );
  assert.equal(item.quantity, 10);
  assert.equal(item.name, "тунквана вафла");
});
