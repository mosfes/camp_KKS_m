/**
 * Shared edit flow for EditCampModal. Used by the head teacher camp page and
 * the admin camp list so both save a camp the same way.
 */

/** Shape GET /api/camps/[id] data the way EditCampModal expects it. */
export function normalizeCampDetail<T = any>(data: any): T {
  const gradesSet = new Set<string>();
  let planTypeName = "MSEC";

  if (data.camp_classroom?.length) {
    data.camp_classroom.forEach((cc: any) => {
      if (cc.classroom?.grade) gradesSet.add(cc.classroom.grade);
    });
    planTypeName =
      data.camp_classroom[0].classroom?.classroom_types?.name || "MSEC";
  }
  if ((!planTypeName || planTypeName === "MSEC") && data.plan_type) {
    planTypeName = data.plan_type.name || "MSEC";
  }
  const dailySchedule = (data.camp_daily_schedule || [])
    .sort((a: any, b: any) => a.day - b.day)
    .map((schedule: any) => ({
      day: schedule.day,
      timeSlots: schedule.time_slots.map((slot: any) => ({
        startTime: slot.startTime || slot.start_time,
        endTime: slot.endTime || slot.end_time,
        activity: slot.activity,
      })),
    }));

  return {
    ...data,
    grade_level: Array.from(gradesSet).join(","),
    plan_type_name: planTypeName,
    daily_schedule: dailySchedule,
  } as T;
}

async function compressImage(file: File) {
  if (!file || !file.type.startsWith("image/")) return file;
  try {
    const imageCompression = (await import("browser-image-compression"))
      .default;

    return await imageCompression(file, {
      maxSizeMB: 2,
      maxWidthOrHeight: 2000,
      useWebWorker: true,
    });
  } catch (e) {
    console.error("Compression error:", e);

    return file;
  }
}

async function uploadImage(file: File) {
  const uploadForm = new FormData();

  uploadForm.append("file", await compressImage(file));
  const uploadRes = await fetch("/api/upload", {
    method: "POST",
    body: uploadForm,
  });

  if (!uploadRes.ok) return null;
  const uploadData = await uploadRes.json();

  return uploadData.url as string;
}

/**
 * Upload any new images picked in EditCampModal, then save the camp.
 * Throws when the camp update itself fails.
 */
export async function saveCampEdit(
  campId: number | string,
  formData: any,
): Promise<{ campImageUploadFailed: boolean }> {
  let img_camp_url = formData.campImage || "";
  let campImageUploadFailed = false;

  // Upload new shirt images if files were picked
  let finalShirtUrls: (string | null)[] = [];

  try {
    const parsed = JSON.parse(
      formData.shirtImages ? JSON.stringify(formData.shirtImages) : "[]",
    );

    finalShirtUrls = Array.isArray(parsed)
      ? parsed.filter((url: any) => url != null)
      : [formData.shirtImages];
  } catch {
    finalShirtUrls = [formData.shirtImages];
  }

  if (formData.shirtImageFiles && Array.isArray(formData.shirtImageFiles)) {
    for (let i = 0; i < formData.shirtImageFiles.length; i++) {
      const file = formData.shirtImageFiles[i];

      if (file) {
        try {
          const url = await uploadImage(file);

          if (url) finalShirtUrls[i] = url;
        } catch (uploadErr) {
          console.error("Error during shirt upload:", uploadErr);
        }
      }
    }
  }
  const img_shirt_url = JSON.stringify(finalShirtUrls);

  // Upload new camp image if a file was picked
  if (formData.campImageFile) {
    try {
      const url = await uploadImage(formData.campImageFile);

      if (url) img_camp_url = url;
      else campImageUploadFailed = true;
    } catch (uploadErr) {
      console.error("Error during camp image upload:", uploadErr);
    }
  }

  const response = await fetch(`/api/camps/${campId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...formData,
      img_shirt_url,
      img_camp_url,
      cert_name_x: formData.certNameX,
      cert_name_y: formData.certNameY,
      cert_font_size: formData.certFontSize,
    }),
  });

  if (!response.ok) throw new Error("Failed to update camp");

  return { campImageUploadFailed };
}
