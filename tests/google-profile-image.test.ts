import assert from "node:assert/strict";
import test from "node:test";

import {
  getGoogleProfilePublicId,
  isTrustedGoogleProfileImageUrl,
} from "../lib/google-profile-image";

test("accepts Google and Clerk profile image delivery URLs", () => {
  assert.equal(
    isTrustedGoogleProfileImageUrl(
      "https://lh3.googleusercontent.com/a/example=s96-c",
    ),
    true,
  );
  assert.equal(
    isTrustedGoogleProfileImageUrl("https://img.clerk.com/example/avatar"),
    true,
  );
});

test("rejects non-HTTPS and unrelated profile image URLs", () => {
  assert.equal(
    isTrustedGoogleProfileImageUrl("http://lh3.googleusercontent.com/avatar"),
    false,
  );
  assert.equal(
    isTrustedGoogleProfileImageUrl("https://example.com/avatar.jpg"),
    false,
  );
  assert.equal(isTrustedGoogleProfileImageUrl("not-a-url"), false);
});

test("builds stable per-account Cloudinary public IDs", () => {
  assert.equal(
    getGoogleProfilePublicId("student", 28661),
    "camp_google_profiles/student_28661/profile",
  );
  assert.equal(
    getGoogleProfilePublicId("teacher", 42),
    "camp_google_profiles/teacher_42/profile",
  );
  assert.throws(() => getGoogleProfilePublicId("student", 0));
});
