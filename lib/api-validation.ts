import { z } from "zod";

export const positiveIntSchema = z.coerce.number().int().positive();

export const missionAnswerSchema = z.object({
  questionId: positiveIntSchema,
  type: z.enum(["TEXT", "MCQ", "PHOTO"]),
  value: z.string().max(20_000),
  publicId: z.string().max(255).optional(),
});

export const missionSubmitSchema = z.object({
  campId: positiveIntSchema,
  missionId: positiveIntSchema,
  answers: z.array(missionAnswerSchema).max(100),
  isDraft: z.boolean().optional().default(false),
});

export const profileUpdateSchema = z
  .object({
    nickname: z.string().trim().max(100).optional(),
    chronic_disease: z.string().trim().max(255).optional(),
    food_allergy: z.string().trim().max(255).optional(),
    birthday: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "วันเกิดไม่ถูกต้อง")
      .optional()
      .or(z.literal("")),
    student_tel: z.string().trim().max(30).optional(),
    parent_tel: z.string().trim().max(30).optional(),
    remark: z.string().trim().max(255).optional(),
    profile_image_url: z.string().url().max(500).nullable().optional(),
  })
  .strict();

export function validationErrorMessage(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "ข้อมูล"}: ${issue.message}`)
    .join(", ");
}

export function isTenDigitPhone(value: string) {
  if (!value.trim()) return true;

  return value.replace(/\D/g, "").length === 10;
}

export function isIsoDate(value: string) {
  if (!value) return true;

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function isCloudinaryUploadUrl(
  value: string,
  expectedPublicPath: string,
) {
  try {
    const url = new URL(value);
    const path = decodeURIComponent(url.pathname);
    const marker = `/${expectedPublicPath}`;
    const markerIndex = path.indexOf(marker);
    const nextCharacter =
      markerIndex >= 0 ? path[markerIndex + marker.length] : undefined;

    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      path.includes("/image/upload/") &&
      markerIndex >= 0 &&
      (nextCharacter === undefined ||
        nextCharacter === "/" ||
        nextCharacter === ".")
    );
  } catch {
    return false;
  }
}

export function cloudinaryUrlContainsPublicId(value: string, publicId: string) {
  try {
    const url = new URL(value);
    const path = decodeURIComponent(url.pathname);

    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      path.includes(`/${publicId}`)
    );
  } catch {
    return false;
  }
}

export function isCloudinaryPublicId(value: string, expectedPrefix: string) {
  return (
    value.startsWith(`${expectedPrefix}/`) &&
    !value.includes("..") &&
    !/[\r\n]/.test(value)
  );
}
