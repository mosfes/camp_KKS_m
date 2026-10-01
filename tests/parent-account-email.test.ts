import assert from "node:assert/strict";
import test from "node:test";

import {
  createParentAuthToken,
  createPasswordResetEmail,
  hashParentAuthToken,
  isValidEmail,
  normalizeEmail,
  resolvePasswordResetRecipient,
} from "../lib/parent-account-email";

test("normalizes and validates parent email addresses", () => {
  assert.equal(normalizeEmail(" Parent@Example.COM "), "parent@example.com");
  assert.equal(isValidEmail("parent@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
});

test("uses a matching verified parent email when one is supplied", () => {
  assert.deepEqual(
    resolvePasswordResetRecipient({
      recipientEmailInput: " Parent@Example.com ",
      storedParentEmail: "parent@example.com",
      parentEmailVerified: true,
      parentName: "คุณแม่ใจดี",
      studentEmail: "student@school.ac.th",
      studentName: "เด็กชายตั้งใจ",
    }),
    { email: "parent@example.com", name: "คุณแม่ใจดี" },
  );
});

test("accepts the student email or falls back to it when email is omitted", () => {
  const base = {
    storedParentEmail: "parent@example.com",
    parentEmailVerified: true,
    parentName: "คุณแม่ใจดี",
    studentEmail: "student@school.ac.th",
    studentName: "เด็กชายตั้งใจ",
  };

  assert.deepEqual(
    resolvePasswordResetRecipient({ ...base, recipientEmailInput: "" }),
    { email: "student@school.ac.th", name: "เด็กชายตั้งใจ" },
  );
  assert.deepEqual(
    resolvePasswordResetRecipient({
      ...base,
      recipientEmailInput: "student@school.ac.th",
    }),
    { email: "student@school.ac.th", name: "เด็กชายตั้งใจ" },
  );
  assert.equal(
    resolvePasswordResetRecipient({
      ...base,
      recipientEmailInput: "wrong@example.com",
    }),
    null,
  );
});

test("creates random tokens and stores only their deterministic hash", () => {
  const first = createParentAuthToken();
  const second = createParentAuthToken();

  assert.notEqual(first.token, second.token);
  assert.equal(first.tokenHash, hashParentAuthToken(first.token));
  assert.equal(first.tokenHash.length, 64);
});

test("escapes names in password reset emails", () => {
  const email = createPasswordResetEmail({
    recipientName: '<script>alert("x")</script>',
    actionUrl: "https://camp.example/parent/reset-password?token=safe",
  });

  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.text, /30 นาที/);
});
