import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeEnvironmentUrl,
  normalizeVapidPrivateKey,
  normalizeVapidPublicKey,
} from "../lib/vapid-key";

const publicKey = `B${"a".repeat(86)}`;
const privateKey = "b".repeat(43);

test("normalizes quoted and padded VAPID keys", () => {
  assert.equal(normalizeVapidPublicKey(` "${publicKey}=" `), publicKey);
  assert.equal(normalizeVapidPrivateKey(` '${privateKey}=' `), privateKey);
});

test("rejects malformed VAPID keys before they reach the browser", () => {
  assert.equal(normalizeVapidPublicKey("not a public key"), null);
  assert.equal(normalizeVapidPrivateKey(publicKey), null);
});

test("normalizes a quoted Web Push subject", () => {
  assert.equal(
    normalizeEnvironmentUrl(' "https://camp.example" '),
    "https://camp.example",
  );
});
