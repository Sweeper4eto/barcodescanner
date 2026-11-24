import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeReadingCelsius,
  normalizeTemperatureRange,
  temperatureRangeStatus,
  toTemperaturePointDto,
} from "../src/lib/temperature";

test("normalizeTemperatureRange accepts min/max and rejects inverted", () => {
  assert.deepEqual(normalizeTemperatureRange({ minCelsius: 2, maxCelsius: 8 }), {
    minCelsius: 2,
    maxCelsius: 8,
  });
  assert.deepEqual(normalizeTemperatureRange({ minCelsius: null, maxCelsius: null }), {
    minCelsius: null,
    maxCelsius: null,
  });
  assert.equal(
    normalizeTemperatureRange({ minCelsius: 8, maxCelsius: 2 }).error,
    "range",
  );
  assert.equal(
    normalizeTemperatureRange({ minCelsius: 100, maxCelsius: null }).error,
    "range",
  );
});

test("normalizeReadingCelsius rounds to one decimal and rejects extremes", () => {
  assert.equal(normalizeReadingCelsius(3.44), 3.4);
  assert.equal(normalizeReadingCelsius(null), null);
  assert.equal(normalizeReadingCelsius(undefined), null);
  assert.equal(normalizeReadingCelsius(999).error, "celsius");
});

test("temperatureRangeStatus flags high and low readings", () => {
  assert.equal(
    temperatureRangeStatus({
      completed: false,
      celsius: null,
      minCelsius: 2,
      maxCelsius: 8,
    }),
    "unchecked",
  );
  assert.equal(
    temperatureRangeStatus({
      completed: true,
      celsius: 3.4,
      minCelsius: 2,
      maxCelsius: 8,
    }),
    "ok",
  );
  assert.equal(
    temperatureRangeStatus({
      completed: true,
      celsius: 9.1,
      minCelsius: 2,
      maxCelsius: 8,
    }),
    "high",
  );
  assert.equal(
    temperatureRangeStatus({
      completed: true,
      celsius: 0.5,
      minCelsius: 2,
      maxCelsius: 8,
    }),
    "low",
  );
  assert.equal(
    temperatureRangeStatus({
      completed: true,
      celsius: null,
      minCelsius: 2,
      maxCelsius: 8,
    }),
    "ok",
  );
});

test("toTemperaturePointDto maps day reading onto completed fields", () => {
  const dto = toTemperaturePointDto({
    id: "p1",
    storeId: "s1",
    title: "Fridge 1",
    note: "Door",
    minCelsius: 2,
    maxCelsius: 8,
    comment: null,
    commentImagePath: null,
    active: true,
    createdAt: new Date("2026-11-23T10:00:00.000Z"),
    updatedAt: new Date("2026-11-23T10:00:00.000Z"),
    dayReading: {
      celsius: 9.1,
      completedAt: new Date("2026-11-23T12:00:00.000Z"),
      completedByUser: {
        id: "u1",
        username: "ivan",
        displayName: "Ivan",
      },
    },
  });
  assert.equal(dto.completed, true);
  assert.equal(dto.celsius, 9.1);
  assert.equal(dto.rangeStatus, "high");
  assert.equal(dto.completedBy?.username, "ivan");
});
