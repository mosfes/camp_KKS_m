"use client";

import { useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, Sparkles } from "lucide-react";

import { FoodAllergySelector } from "@/components/profile/FoodAllergySelector";

export default function StudentProfileSetupModal({
  initialData,
  onSaved,
}: {
  initialData: any;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(false);
  const submitInFlightRef = useRef(false);

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!form.nickname?.trim())
      errors.nickname = "กรุณากรอกชื่อเล่นก่อนดำเนินการต่อ";
    if (!form.food_allergy?.trim())
      errors.food_allergy = "กรุณาเลือกข้อมูลการแพ้อาหาร หรือเลือกไม่แพ้อาหาร";

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitInFlightRef.current) return;
    setApiError("");
    const errors = validate();

    setFieldError(errors);
    if (Object.keys(errors).length > 0) return;

    submitInFlightRef.current = true;
    setSaving(true);
    try {
      const res = await fetch("/api/student/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname?.trim() || null,
          food_allergy: form.food_allergy.trim(),
          profile_image_url: pendingImageUrl || form.profile_image_url || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setApiError(data.error || "เกิดข้อผิดพลาด");

        return;
      }
      if (previewImage) URL.revokeObjectURL(previewImage);
      setSuccess(true);
      setTimeout(() => onSaved(), 1200);
    } catch {
      setApiError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      submitInFlightRef.current = false;
      setSaving(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setApiError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");

      return;
    }

    const objectUrl = URL.createObjectURL(file);

    setPreviewImage(objectUrl);
    setApiError("");
    setUploadingImage(true);
    setUploadProgress(0);

    try {
      const { uploadStudentProfileImage } = await import(
        "@/lib/student-profile-upload"
      );
      const uploaded = await uploadStudentProfileImage(file, (p) => {
        setUploadProgress(p);
      });

      setPendingImageUrl(uploaded.url);
      setUploadProgress(100);
    } catch (error: any) {
      const { getFriendlyUploadErrorMessage } = await import(
        "@/lib/student-profile-upload"
      );

      URL.revokeObjectURL(objectUrl);
      setPreviewImage(null);
      setApiError(getFriendlyUploadErrorMessage(error));
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden my-auto">
        <div className="bg-[#5d7c6f] px-6 pt-8 pb-6 text-white text-center">
          <div className="flex flex-col items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">มาทำความรู้จักกันอีกนิด</h2>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="text-[#5d7c6f]" size={32} />
              </div>
              <p className="font-medium text-gray-800 text-lg">
                บันทึกข้อมูลสำเร็จ!
              </p>
              <p className="text-sm text-gray-500">
                ยินดีที่ได้รู้จักนะ กำลังพาเข้าสู่ระบบ...
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="student-profile-image"
                >
                  รูปโปรไฟล์{" "}
                  <span className="text-xs text-gray-400">(ถ้ามี)</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-[#5d7c6f]/10 border border-gray-200 flex items-center justify-center text-[#5d7c6f] relative shrink-0">
                    {previewImage || form.profile_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt="ตัวอย่างรูปโปรไฟล์"
                        className="w-full h-full object-cover"
                        src={previewImage || form.profile_image_url}
                      />
                    ) : (
                      <Camera size={22} />
                    )}

                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex flex-col items-center justify-center text-white z-10">
                        <span className="text-xs font-bold font-mono text-emerald-300">
                          {uploadProgress}%
                        </span>
                      </div>
                    )}
                  </div>
                  <label className="cursor-pointer px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                    {uploadingImage ? (
                      <span className="flex items-center gap-1.5 font-medium text-[#5d7c6f]">
                        <div className="w-3.5 h-3.5 border-2 border-[#5d7c6f] border-t-transparent rounded-full animate-spin" />
                        <span>กำลังอัปโหลด... {uploadProgress}%</span>
                      </span>
                    ) : (
                      "เลือกรูปภาพ"
                    )}
                    <input
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingImage}
                      id="student-profile-image"
                      type="file"
                      onChange={handleImageChange}
                    />
                  </label>
                  <span className="text-xs text-gray-400">ข้ามได้</span>
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="student-food-allergy"
                >
                  การแพ้อาหาร <span className="text-red-500">*</span>
                </label>
                <FoodAllergySelector
                  className="mt-2"
                  error={fieldError.food_allergy}
                  id="student-food-allergy"
                  value={form.food_allergy || ""}
                  onChange={(value) =>
                    setForm((f: any) => ({
                      ...f,
                      food_allergy: value,
                    }))
                  }
                />
                {fieldError.food_allergy && (
                  <p className="text-red-500 text-xs mt-1">
                    {fieldError.food_allergy}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="block text-sm font-medium text-gray-700 mb-1"
                  htmlFor="student-nickname"
                >
                  ชื่อเล่น <span className="text-red-500">*</span>
                </label>
                <input
                  className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all
                    ${
                      fieldError.nickname
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                        : "border-gray-200 bg-gray-50 focus:border-[#5d7c6f] focus:ring-2 focus:ring-[#5d7c6f]/20"
                    }`}
                  id="student-nickname"
                  maxLength={50}
                  placeholder="กรอกชื่อเล่นที่อยากให้เพื่อน ๆ เรียก"
                  type="text"
                  value={form.nickname || ""}
                  onChange={(e) =>
                    setForm((f: any) => ({ ...f, nickname: e.target.value }))
                  }
                />
                {fieldError.nickname && (
                  <p className="text-red-500 text-xs mt-1">
                    {fieldError.nickname}
                  </p>
                )}
              </div>

              {apiError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={16} />
                  {apiError}
                </div>
              )}

              <button
                className="w-full bg-[#5d7c6f] hover:bg-[#4a6659] text-white font-medium py-3.5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-md"
                disabled={saving || uploadingImage}
                type="submit"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>บันทึกชื่อเล่น</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
