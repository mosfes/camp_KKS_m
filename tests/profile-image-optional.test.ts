import assert from "node:assert/strict";
import test from "node:test";

import {
  isCloudinaryUploadUrl,
  profileUpdateSchema,
} from "../lib/api-validation";

test("student profile can be saved without an image", () => {
  const details = { nickname: "น้อง", food_allergy: "ไม่แพ้อาหาร" };

  assert.equal(profileUpdateSchema.safeParse(details).success, true);
  assert.equal(
    profileUpdateSchema.safeParse({ ...details, profile_image_url: null }).success,
    true,
  );
});

test("an invalid image URL is still rejected", () => {
  assert.equal(
    profileUpdateSchema.safeParse({ profile_image_url: "not-a-url" }).success,
    false,
  );
});

test("an uploaded profile image can be saved later", () => {
  const url =
    "https://res.cloudinary.com/school/image/upload/v123/camp_profiles/student_42/profile.jpg";

  assert.equal(profileUpdateSchema.safeParse({ profile_image_url: url }).success, true);
  assert.equal(
    isCloudinaryUploadUrl(url, "camp_profiles/student_42/profile"),
    true,
  );
});
