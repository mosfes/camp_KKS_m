import assert from "node:assert/strict";
import test from "node:test";

import {
  BUS_LAYOUT_MIN_SEAT_SIZE,
  busLayoutElementSchema,
} from "../lib/freeform-bus-layout";

const seat = {
  type: "SEAT" as const,
  x: 0,
  y: 0,
  width: BUS_LAYOUT_MIN_SEAT_SIZE,
  height: BUS_LAYOUT_MIN_SEAT_SIZE,
  rotation: 0 as const,
  label: "A01",
  isAssignable: true,
  zIndex: 0,
};

test("accepts a seat that is at least 2x2", () => {
  assert.equal(busLayoutElementSchema.safeParse(seat).success, true);
});

test("rejects seats narrower or shorter than 2 grid cells", () => {
  assert.equal(
    busLayoutElementSchema.safeParse({ ...seat, width: 1 }).success,
    false,
  );
  assert.equal(
    busLayoutElementSchema.safeParse({ ...seat, height: 1 }).success,
    false,
  );
});
