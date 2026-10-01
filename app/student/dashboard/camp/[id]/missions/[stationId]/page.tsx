"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import {
  ChevronLeft,
  CheckCircle2,
  Circle,
  Camera,
  X,
  QrCode,
  ScanLine,
  KeyRound,
  Video,
  Eye,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { toast } from "react-hot-toast";
import dynamic from "next/dynamic";

import StudentStationDetailSkeleton from "./components/StudentStationDetailSkeleton";

import { isBangkokDateBefore } from "@/lib/bangkok-date";
import VideoPlayer from "@/components/VideoPlayer";
import { getVideoSource, supportedVideoUrlMessage } from "@/lib/video";
import { toThumbnail } from "@/lib/cloudinary-url";
import { submitStudentMissionWithRetry } from "@/lib/student-mission-submit";

const QrScanner = dynamic(() => import("@/components/QrScanner"), {
  ssr: false,
});

export default function StudentStationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { id, stationId } = params;

  const [camp, setCamp] = useState<any>(null);
  const [station, setStation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Mission Execution State
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure();
  const [selectedMission, setSelectedMission] = useState<any>(null);
  const [answers, setAnswers] = useState<any>({}); // { questionId: value }
  const [answerPublicIds, setAnswerPublicIds] = useState<
    Record<number, string>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadingQids, setUploadingQids] = useState<number[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>(
    {},
  );
  const [previewFullImageUrl, setPreviewFullImageUrl] = useState<string | null>(
    null,
  );

  // QR Scan State
  const [qrScanActive, setQrScanActive] = useState(false);
  const [qrScanResult, setQrScanResult] = useState<
    "success" | "alreadyDone" | "error" | null
  >(null);
  const [qrScanMessage, setQrScanMessage] = useState("");
  const qrProcessingRef = useRef(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fetchCamp = async () => {
    try {
      const campRes = await fetch(
        `/api/student/camps/${id}/missions/${stationId}`,
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        },
      );

      if (campRes.ok) {
        const payload = await campRes.json();
        const foundCamp = payload.camp;

        if (foundCamp) {
          if (!foundCamp.isRegistered) {
            toast.error("กรุณาลงทะเบียนเข้าร่วมค่ายก่อนเข้าถึงหน้าภารกิจ");
            router.replace(`/student/dashboard/camp/${id}`);

            return;
          }
          // ตรวจสอบว่าค่ายเริ่มแล้วหรือยัง
          const startDate = foundCamp.rawStartDate
            ? new Date(foundCamp.rawStartDate)
            : null;

          if (startDate && isBangkokDateBefore(new Date(), startDate)) {
            toast.error("ค่ายยังไม่เริ่ม ไม่สามารถทำภารกิจได้");
            router.replace(`/student/dashboard/camp/${id}`);

            return;
          }
          setCamp({
            ...foundCamp,
            missionResults: payload.missionResults || [],
            preTestMissionIds: payload.preTestMissionIds || [],
            preTestCompleted: payload.preTestCompleted ?? false,
          });

          if (payload.station) {
            setStation(payload.station);
          } else {
            toast.error("ไม่พบฐานกิจกรรม");
          }
        } else {
          toast.error("ไม่พบค่าย");
        }
      } else if (campRes.status === 403) {
        const errorData = await campRes.json().catch(() => null);

        toast.error(errorData?.error || "ค่ายยังไม่เริ่ม ไม่สามารถทำภารกิจได้");
        router.replace(`/student/dashboard/camp/${id}`);
      }
    } catch (error) {
      console.error("Failed to fetch camp", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0); // เลื่อนขึ้นไปบนสุดทุกครั้งที่เข้าหน้าภารกิจ
    fetchCamp();
  }, [id, stationId]);

  const openMission = (mission: any) => {
    setSelectedMission(mission);
    setAnswerPublicIds({});
    setPreviewFullImageUrl(null);

    // Reset QR state
    setQrScanActive(false);
    setQrScanResult(null);
    setQrScanMessage("");
    setShowPinInput(false);
    setPinInput("");
    setCameraError(null);
    qrProcessingRef.current = false;

    const existingResult = camp?.missionResults?.find(
      (r: any) => r.mission_mission_id === mission.mission_id,
    );
    const initialAnswers: any = {};

    if (existingResult && existingResult.mission_answer) {
      existingResult.mission_answer.forEach((ans: any) => {
        const qid = ans.mission_question_question_id;

        if (ans.answer_text && ans.answer_text.length > 0) {
          initialAnswers[qid] = ans.answer_text[0].answer_text;
        } else if (ans.answer_mcq && ans.answer_mcq.length > 0) {
          initialAnswers[qid] = ans.answer_mcq[0].question_text;
        } else if (ans.answer_photo && ans.answer_photo.length > 0) {
          initialAnswers[qid] = ans.answer_photo[0].img_url;
        }
      });
    }

    setAnswers(initialAnswers);
    onOpen();
  };

  const handleQrScan = async (payload: string) => {
    if (qrProcessingRef.current) return;
    qrProcessingRef.current = true;
    setQrScanActive(false); // Stop scanner

    try {
      const res = await fetch("/api/student/mission/qr-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrPayload: payload }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setQrScanResult(data.alreadyCompleted ? "alreadyDone" : "success");
        setQrScanMessage(data.message);
        if (!data.alreadyCompleted && selectedMission?.mission_id) {
          markMissionCompleted(selectedMission.mission_id);
        }
      } else {
        setQrScanResult("error");
        setQrScanMessage(data.error || "QR Code ไม่ถูกต้อง");
        qrProcessingRef.current = false; // Allow retry
      }
    } catch {
      setQrScanResult("error");
      setQrScanMessage("เกิดข้อผิดพลาดในการแสกน");
      qrProcessingRef.current = false;
    }
  };

  const resetQrScan = () => {
    setQrScanResult(null);
    setQrScanMessage("");
    setPinInput("");
    qrProcessingRef.current = false;
    if (showPinInput) {
      // ถ้าอยู่ใน PIN mode ให้คงอยู่ใน PIN mode
    } else {
      requestCameraAndStartScan();
    }
  };

  const handlePinSubmit = async () => {
    if (!pinInput.trim() || !selectedMission) return;
    setPinSubmitting(true);
    try {
      const res = await fetch("/api/student/mission/qr-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: pinInput.trim(),
          missionId: selectedMission.mission_id,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setQrScanResult(data.alreadyCompleted ? "alreadyDone" : "success");
        setQrScanMessage(data.message);
        if (!data.alreadyCompleted && selectedMission?.mission_id) {
          markMissionCompleted(selectedMission.mission_id);
        }
      } else {
        setQrScanResult("error");
        setQrScanMessage(data.error || "รหัส PIN ไม่ถูกต้อง");
      }
    } catch {
      setQrScanResult("error");
      setQrScanMessage("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setPinSubmitting(false);
    }
  };

  const requestCameraAndStartScan = async () => {
    setCameraError(null); // clear ก่อนลอง

    // ตรวจสอบว่า browser รองรับ camera API หรือไม่
    const isSecure =
      window.isSecureContext ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1";
    const hasMediaDevices = !!(
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    );

    if (!isSecure) {
      setCameraError(
        "เบราว์เซอร์นี้ไม่รองรับการเปิดกล้องบนการเชื่อมต่อ HTTP กรุณาใช้ HTTPS หรือกรอก PIN แทน",
      );
      setShowPinInput(true);

      return;
    }

    if (!hasMediaDevices) {
      setCameraError(
        "เบราว์เซอร์หรืออุปกรณ์นี้ไม่รองรับการเข้าถึงกล้อง กรุณากรอก PIN แทน",
      );
      setShowPinInput(true);

      return;
    }

    // ลอง constraint จากเข้มไปหยาบ
    const constraints = [
      { video: { facingMode: { ideal: "environment" } } },
      { video: { facingMode: "user" } },
      { video: true },
    ];

    let lastError: any = null;

    for (const constraint of constraints) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraint);

        stream.getTracks().forEach((track) => track.stop());
        setQrScanActive(true);

        return;
      } catch (err: any) {
        lastError = err;
        if (
          err?.name === "NotAllowedError" ||
          err?.name === "PermissionDeniedError"
        )
          break;
      }
    }

    // แสดงสาเหตุที่เฉพาะเจาะจง
    const isDenied =
      lastError?.name === "NotAllowedError" ||
      lastError?.name === "PermissionDeniedError";
    const isNotFound =
      lastError?.name === "NotFoundError" ||
      lastError?.name === "DevicesNotFoundError";

    if (isDenied) {
      setCameraError(
        'ไม่ได้รับอนุญาตเข้าถึงกล้อง กรุณากด "อนุญาต" ในการตั้งค่าเบราว์เซอร์ แล้วลองใหม่',
      );
      setQrScanResult("error");
      setQrScanMessage(
        "ไม่ได้รับอนุญาตเข้าถึงกล้อง กรุณาอนุญาตในการตั้งค่าเบราว์เซอร์ หรือกรอก PIN แทน",
      );
    } else if (isNotFound) {
      setCameraError("ไม่พบกล้องในอุปกรณ์นี้ กรุณากรอก PIN แทน");
      setShowPinInput(true);
    } else {
      setCameraError("ไม่สามารถเปิดกล้องได้ กรุณากรอก PIN แทน");
      setShowPinInput(true);
    }
  };

  const handleAnswerChange = (questionId: number, value: any) => {
    setAnswers((prev: any) => ({ ...prev, [questionId]: value }));
  };

  const markMissionCompleted = (missionId: number) => {
    setCamp((previous: any) => {
      if (!previous) return previous;

      const missionResults = previous.missionResults || [];
      const existingResult = missionResults.find(
        (result: any) => result.mission_mission_id === missionId,
      );

      if (existingResult?.status === "completed") return previous;

      return {
        ...previous,
        missionResults: existingResult
          ? missionResults.map((result: any) =>
              result.mission_mission_id === missionId
                ? { ...result, status: "completed" }
                : result,
            )
          : [
              ...missionResults,
              {
                mission_mission_id: missionId,
                status: "completed",
                mission_answer: [],
              },
            ],
      };
    });
  };

  const compressImage = async (
    file: File,
    onProgress?: (percentage: number) => void,
  ) => {
    if (!file || !file.type.startsWith("image/")) {
      return { file, compressionFailed: false };
    }

    try {
      const imageCompression = (await import("browser-image-compression"))
        .default;

      return {
        file: await imageCompression(file, {
          maxSizeMB: 2,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: "image/jpeg", // Always convert to JPEG for compatibility
          onProgress: (p) => {
            onProgress?.(Math.round(p * 0.2));
          },
        }),
        compressionFailed: false,
      };
    } catch (e) {
      console.error("Compression error:", e);

      return { file, compressionFailed: true };
    }
  };

  const uploadMissionImageDirect = async ({
    file,
    campId,
    missionId,
    questionId,
    useFallback,
    onProgress,
  }: {
    file: File;
    campId: number;
    missionId: number;
    questionId: number;
    useFallback: boolean;
    onProgress?: (percentage: number) => void;
  }) => {
    onProgress?.(20);

    const signatureResponse = await fetch(
      "/api/student/mission/upload-signature",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campId,
          missionId,
          questionId,
          useFallback,
        }),
      },
    );
    const signatureData = await signatureResponse.json().catch(() => null);

    if (!signatureResponse.ok) {
      const error: any = new Error(
        signatureData?.error || "ไม่สามารถเตรียมการอัปโหลดรูปได้",
      );

      error.status = signatureResponse.status;
      error.retryable = signatureData?.retryable === true;
      throw error;
    }

    onProgress?.(25);

    const uploadForm = new FormData();

    uploadForm.append("file", file, file.name || "mission-image.jpg");
    uploadForm.append("api_key", signatureData.apiKey);
    uploadForm.append("timestamp", String(signatureData.timestamp));
    uploadForm.append("folder", signatureData.folder);
    uploadForm.append("signature", signatureData.signature);

    if (signatureData.uploadPreset) {
      uploadForm.append("upload_preset", signatureData.uploadPreset);
    }

    if (signatureData.transformation) {
      uploadForm.append("transformation", signatureData.transformation);
    }

    const uploadData: any = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open(
        "POST",
        `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
      );

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = 25 + Math.round((event.loaded / event.total) * 65);

          onProgress?.(Math.min(percent, 90));
        }
      };

      xhr.onload = () => {
        try {
          const response = JSON.parse(xhr.responseText);

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(response);
          } else {
            const error: any = new Error(
              response?.error?.message || "อัปโหลดรูปภาพไม่สำเร็จ",
            );

            error.status = xhr.status;
            error.retryable = xhr.status === 429 || xhr.status >= 500;
            reject(error);
          }
        } catch {
          reject(new Error("เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง"));
        }
      };

      xhr.onerror = () => {
        const error: any = new Error("การเชื่อมต่อเพื่ออัปโหลดรูปล้มเหลว");

        error.retryable = true;
        reject(error);
      };

      xhr.send(uploadForm);
    });

    if (!uploadData?.secure_url) {
      const error: any = new Error(
        uploadData?.error?.message || "อัปโหลดรูปภาพไม่สำเร็จ",
      );

      error.status = 500;
      error.retryable = true;
      throw error;
    }

    onProgress?.(90);

    const commitResponse = await fetch("/api/student/mission/upload-commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campId,
        missionId,
        questionId,
        publicId: uploadData.public_id,
        version: uploadData.version,
        responseSignature: uploadData.signature,
        resourceType: uploadData.resource_type,
        bytes: uploadData.bytes,
        width: uploadData.width,
        height: uploadData.height,
        format: uploadData.format,
      }),
    });
    const commitData = await commitResponse.json().catch(() => null);

    if (!commitResponse.ok || !commitData?.url || !commitData?.publicId) {
      const error: any = new Error(
        commitData?.error || "รูปภาพไม่ผ่านการตรวจสอบจากเซิร์ฟเวอร์",
      );

      error.status = commitResponse.status;
      error.retryable = commitData?.retryable === true;
      throw error;
    }

    onProgress?.(100);

    return {
      url: commitData.url,
      public_id: commitData.publicId,
    };
  };

  const handleImageUpload = async (questionId: number, file: File) => {
    if (!file) return;

    // Check file size (20MB limit)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

    if (file.size > MAX_FILE_SIZE) {
      toast.error("ขนาดไฟล์รูปภาพต้องไม่เกิน 20MB");

      return;
    }

    const MAX_RETRIES = 3;

    setUploadingQids((current) =>
      current.includes(questionId) ? current : [...current, questionId],
    );
    setUploadProgress((current) => ({
      ...current,
      [questionId]: 0,
    }));

    try {
      const compressionResult = await compressImage(file, (p) => {
        setUploadProgress((current) => ({
          ...current,
          [questionId]: p,
        }));
      });
      const uploadFile = compressionResult.file;
      // Files up to 5MB go directly to Cloudinary without an incoming
      // transformation. Only larger files use the fallback transformation.
      const useFallback = uploadFile.size > 5 * 1024 * 1024;

      let lastError: string | null = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const data = await uploadMissionImageDirect({
            file: uploadFile,
            campId: Number(id),
            missionId: selectedMission?.mission_id,
            questionId,
            useFallback,
            onProgress: (p) => {
              setUploadProgress((current) => ({
                ...current,
                [questionId]: p,
              }));
            },
          });

          handleAnswerChange(questionId, data.url);
          setAnswerPublicIds((current) => ({
            ...current,
            [questionId]: data.public_id,
          }));
          toast.success("อัปโหลดรูปภาพสำเร็จ");

          return; // สำเร็จ ออกจาก loop
        } catch (error: any) {
          const message = error?.message || "อัปโหลดล้มเหลว";
          const retryable =
            error?.retryable === true ||
            error?.status === 429 ||
            error?.status >= 500 ||
            error instanceof TypeError;

          if (!retryable) {
            toast.error(message);

            return;
          }

          lastError = message;
        }

        if (attempt < MAX_RETRIES) {
          const delayMs =
            attempt === 1
              ? 800 + Math.random() * 1700
              : 2000 + Math.random() * 3000;

          await new Promise((resolve) => window.setTimeout(resolve, delayMs));
        }
      }

      // หมดทุก retry แล้วยังไม่สำเร็จ
      toast.error("อัปโหลดล้มเหลว กรุณาลองใหม่อีกครั้ง");
      console.error(
        "[upload] Failed after",
        MAX_RETRIES,
        "attempts:",
        lastError,
      );
    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการอัปโหลด");
    } finally {
      setUploadingQids((current) =>
        current.filter((qid) => qid !== questionId),
      );
      setUploadProgress((current) => {
        const next = { ...current };

        delete next[questionId];

        return next;
      });
    }
  };

  const submitMission = async () => {
    if (!selectedMission || submitting) return;

    // Do not persist a draft while an image is still being compressed/uploaded.
    // The URL is only added to `answers` after /api/upload succeeds.
    if (uploadingQids.length > 0) {
      toast.error("กรุณารอให้อัปโหลดรูปภาพเสร็จก่อนบันทึกหรือส่ง");

      return;
    }

    setSubmitting(true);

    // Transform answers
    const payloadAnswers = Object.entries(answers).map(([qid, val]) => {
      // Determine type from mission questions
      const q = selectedMission.mission_question.find(
        (mq: any) => mq.question_id === Number(qid),
      );

      return {
        questionId: Number(qid),
        type: q?.question_type as "TEXT" | "MCQ" | "PHOTO",
        value: String(val),
        ...(q?.question_type === "PHOTO" && answerPublicIds[Number(qid)]
          ? { publicId: answerPublicIds[Number(qid)] }
          : {}),
      };
    });

    const isDraft = selectedMission.mission_question.some(
      (q: any) =>
        !answers[q.question_id] || String(answers[q.question_id]).trim() === "",
    );

    try {
      const resultData = await submitStudentMissionWithRetry({
        campId: Number(id),
        missionId: selectedMission.mission_id,
        answers: payloadAnswers,
        isDraft,
      });
      const savedStatus =
        resultData?.status || (isDraft ? "pending" : "completed");
      const savedAnswers = payloadAnswers.map((answer: any) => ({
        mission_question_question_id: answer.questionId,
        answer_text:
          answer.type === "TEXT" ? [{ answer_text: answer.value }] : [],
        answer_mcq:
          answer.type === "MCQ" ? [{ question_text: answer.value }] : [],
        answer_photo:
          answer.type === "PHOTO" ? [{ img_url: answer.value }] : [],
      }));

      setCamp((previous: any) => {
        if (!previous) return previous;

        const missionResults = previous.missionResults || [];
        const nextResult = {
          mission_result_id: resultData?.resultId,
          mission_mission_id: selectedMission.mission_id,
          status: savedStatus,
          mission_answer: savedAnswers,
        };
        const hasExistingResult = missionResults.some(
          (result: any) =>
            result.mission_mission_id === selectedMission.mission_id,
        );

        return {
          ...previous,
          missionResults: hasExistingResult
            ? missionResults.map((result: any) =>
                result.mission_mission_id === selectedMission.mission_id
                  ? { ...result, ...nextResult }
                  : result,
              )
            : [...missionResults, nextResult],
        };
      });

      toast.success(isDraft ? "บันทึกร่างสำเร็จ!" : "ส่งภารกิจสำเร็จ!");
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "เกิดข้อผิดพลาดในการส่ง");
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to check if mission is completed
  const isMissionCompleted = (missionId: number) => {
    if (!camp || !camp.missionResults) return false;

    // status='completed'
    return camp.missionResults.some(
      (r: any) =>
        r.mission_mission_id === missionId && r.status === "completed",
    );
  };

  const isPreTestCompleted = () => {
    if (camp?.preTestCompleted) return true;

    const preTestIds = camp?.preTestMissionIds || [];

    return preTestIds.every((missionId: number) =>
      camp?.missionResults?.some(
        (result: any) =>
          result.mission_mission_id === missionId &&
          result.status === "completed",
      ),
    );
  };

  if (loading) return <StudentStationDetailSkeleton />;
  if (!station)
    return (
      <div className="p-8 text-center bg-[#f5f5f2] min-h-screen flex items-center justify-center">
        <div className="text-gray-400 font-medium">ไม่พบฐานกิจกรรม</div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f5f5f2] pb-12">
      {/* Station Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center gap-4">
          <Button
            isIconOnly
            className="bg-transparent text-gray-400 hover:bg-gray-50 min-w-0 w-8 h-8"
            variant="light"
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[#2D3648] leading-tight">
              {station.name}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 font-medium leading-tight truncate mt-0.5">
              {camp.title}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {station.description && (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                เกี่ยวกับฐานนี้
              </h2>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed font-normal">
              {station.description}
            </p>
          </div>
        )}

        {station.mission?.length === 0 && (
          <div className="text-center text-gray-400 py-16 bg-white/40 rounded-2xl border-2 border-dashed border-gray-100">
            <Circle className="mx-auto mb-3 opacity-20" size={48} />
            <p className="font-medium">ยังไม่มีภารกิจในฐานนี้</p>
          </div>
        )}

        <div className="space-y-4">
          {station.mission?.map((mission: any) => {
            const completed = isMissionCompleted(mission.mission_id);
            const isPostTest = mission.type === "POST_TEST";
            const canDoPostTest = isPreTestCompleted();
            const isLocked = isPostTest && !canDoPostTest && !completed;

            return (
              <button
                key={mission.mission_id}
                className={`
                  w-full bg-white p-6 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 cursor-pointer text-left
                  ${
                    isLocked
                      ? "opacity-60 grayscale border-gray-100"
                      : completed
                        ? "border-[#5D7C6F]/20 shadow-sm"
                        : "border-transparent shadow-sm hover:shadow-md"
                  }
                `}
                type="button"
                onClick={() => {
                  if (isLocked) {
                    toast.error(
                      "คุณต้องทำแบบทดสอบก่อนเรียน (Pre-test) ให้เสร็จก่อน จึงจะทำแบบทดสอบหลังเรียนได้",
                    );

                    return;
                  }
                  openMission(mission);
                }}
              >
                <div
                  className={`w-12 h-12 flex items-center justify-center shrink-0`}
                >
                  {completed ? (
                    <CheckCircle2 className="text-[#10B981]" size={28} />
                  ) : (
                    <div className="w-7 h-7 rounded-full border-2 border-gray-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3
                      className={`text-lg font-medium text-[#2D3648] truncate`}
                    >
                      {mission.title?.replace(
                        /\s*\((ก่อนเรียน|หลังเรียน)\)\s*/g,
                        "",
                      ) || "ภารกิจ"}
                    </h3>
                    {mission.type === "PRE_TEST" && (
                      <span className="shrink-0 bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-medium">
                        ก่อนเรียน
                      </span>
                    )}
                    {mission.type === "POST_TEST" && (
                      <span className="shrink-0 bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-medium">
                        หลังเรียน
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] text-gray-400 font-medium">
                    {mission.description || "กดเพื่อทำภารกิจ"}
                  </p>
                </div>

                {completed && (
                  <div className="bg-[#E6F4EA] text-[#1E8E3E] text-[13px] font-medium px-3 py-1 rounded-full shrink-0">
                    สำเร็จ
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mission Execution Modal */}
      <Modal
        classNames={{
          base: "bg-white",
          header: "border-b border-gray-100",
          footer: "border-t border-gray-100",
        }}
        isOpen={isOpen}
        scrollBehavior="inside"
        size="2xl"
        onOpenChange={(open) => {
          if (!open) {
            setQrScanActive(false);
            setQrScanResult(null);
            qrProcessingRef.current = false;
          }
          if (open) {
            onOpen();
          } else {
            onClose();
          }
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 pb-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#5d7c6f] uppercase tracking-wider">
                  <span>ทำภารกิจ</span>
                  {selectedMission?.type === "PRE_TEST" && (
                    <span className="shrink-0 bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-medium">
                      ก่อนเรียน
                    </span>
                  )}
                  {selectedMission?.type === "POST_TEST" && (
                    <span className="shrink-0 bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-medium">
                      หลังเรียน
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-gray-900 leading-tight">
                  {selectedMission?.title?.replace(
                    /\s*\((ก่อนเรียน|หลังเรียน)\)\s*/g,
                    "",
                  )}
                </h2>
              </ModalHeader>

              <ModalBody className="py-6 space-y-6">
                {/* Mission Description */}
                {selectedMission?.description && (
                  <div className="bg-blue-50/50 p-4 rounded-xl text-gray-700 text-sm leading-relaxed border border-blue-100/50">
                    <h4 className="font-medium text-[#5d7c6f] mb-1">
                      รายละเอียดภารกิจ:
                    </h4>
                    <p className="whitespace-pre-wrap">
                      {selectedMission.description}
                    </p>
                  </div>
                )}

                {/* QR CODE SCANNING */}
                {selectedMission?.type === "QR_CODE_SCANNING" &&
                  (() => {
                    const currentResult = camp?.missionResults?.find(
                      (r: any) =>
                        r.mission_mission_id === selectedMission?.mission_id,
                    );
                    const isCompleted = currentResult?.status === "completed";

                    if (isCompleted) {
                      return (
                        <div className="flex flex-col items-center py-8 gap-3">
                          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2
                              className="text-green-500"
                              size={44}
                            />
                          </div>
                          <p className="text-lg font-medium text-green-700">
                            สแกนสำเร็จแล้ว!
                          </p>
                          <p className="text-sm text-gray-500">
                            คุณได้ทำภารกิจนี้เรียบร้อยแล้ว
                          </p>
                        </div>
                      );
                    }

                    if (qrScanResult === "success") {
                      return (
                        <div className="flex flex-col items-center py-8 gap-3">
                          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2
                              className="text-green-500"
                              size={44}
                            />
                          </div>
                          <p className="text-lg font-medium text-green-700">
                            สำเร็จ!
                          </p>
                          <p className="text-sm text-gray-600">
                            {qrScanMessage}
                          </p>
                        </div>
                      );
                    }

                    if (qrScanResult === "error") {
                      return (
                        <div className="flex flex-col items-center py-6 gap-4 w-full">
                          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
                            <X className="text-red-400" size={40} />
                          </div>
                          <p className="text-base font-medium text-red-600 text-center">
                            {qrScanMessage}
                          </p>
                          <div className="flex flex-col w-full gap-2">
                            {!showPinInput && (
                              <Button
                                className="w-full bg-[#5d7c6f] text-white font-medium"
                                startContent={<ScanLine size={18} />}
                                onPress={resetQrScan}
                              >
                                ลองสแกนอีกครั้ง
                              </Button>
                            )}
                            <Button
                              className="w-full bg-gray-100 text-gray-700 font-medium"
                              variant="flat"
                              onPress={() => {
                                setQrScanResult(null);
                                setQrScanMessage("");
                                setPinInput("");
                                setShowPinInput(true);
                              }}
                            >
                              กรอกรหัส PIN แทน
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    // PIN input mode
                    if (showPinInput) {
                      return (
                        <div className="flex flex-col items-center py-4 gap-5 w-full">
                          {/* Camera error banner */}
                          {cameraError && (
                            <div className="w-full flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                              <span className="text-amber-500 text-lg shrink-0">
                                ⚠️
                              </span>
                              <p className="text-xs text-amber-800 leading-relaxed">
                                {cameraError}
                              </p>
                            </div>
                          )}
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-16 h-16 rounded-2xl bg-[#5d7c6f]/10 flex items-center justify-center mb-1 text-[#5d7c6f]">
                              <KeyRound size={32} strokeWidth={2.5} />
                            </div>
                            <p className="font-medium text-gray-900">
                              กรอกรหัส PIN
                            </p>
                            <p className="text-xs text-gray-600 text-center">
                              ขอรหัส PIN จากครูผู้สอนที่ฐาน
                            </p>
                          </div>
                          <input
                            className="w-60 pl-[0.35em] text-center text-gray-900 text-3xl font-medium tracking-[0.35em] font-mono border-2 border-gray-200 focus:border-[#5d7c6f] rounded-xl py-3 outline-none transition-colors bg-gray-50 placeholder:text-gray-300"
                            inputMode="numeric"
                            maxLength={6}
                            pattern="[0-9]*"
                            placeholder="------"
                            type="text"
                            value={pinInput}
                            onChange={(e) =>
                              setPinInput(
                                e.target.value.replace(/\D/g, "").slice(0, 6),
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && pinInput.length === 6)
                                handlePinSubmit();
                            }}
                          />
                          <div className="flex flex-col w-full gap-2">
                            <Button
                              className="w-full bg-[#5d7c6f] text-white font-medium"
                              isDisabled={pinInput.length !== 6}
                              isLoading={pinSubmitting}
                              size="lg"
                              onPress={handlePinSubmit}
                            >
                              ยืนยันรหัส PIN
                            </Button>
                            <Button
                              className="w-full text-gray-500"
                              startContent={<ScanLine size={16} />}
                              variant="light"
                              onPress={() => {
                                setShowPinInput(false);
                                setPinInput("");
                              }}
                            >
                              กลับไปแสกน QR
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    // Scanner initial UI
                    return (
                      <div className="flex flex-col items-center gap-4">
                        {qrScanActive ? (
                          <div className="w-full max-w-sm mx-auto">
                            <QrScanner
                              active={qrScanActive}
                              onError={(err) => {
                                setQrScanResult("error");
                                setQrScanMessage(err);
                                setQrScanActive(false);
                              }}
                              onScan={handleQrScan}
                            />
                            <p className="text-center text-xs text-gray-600 mt-2">
                              จัดกล้องให้ตรง QR Code ของครู
                            </p>
                            <Button
                              className="w-full mt-3 bg-gray-100 text-gray-600"
                              variant="flat"
                              onPress={() => setQrScanActive(false)}
                            >
                              ยกเลิก
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center py-4 gap-4 w-full">
                            <div className="w-24 h-24 rounded-2xl bg-[#5d7c6f]/10 flex items-center justify-center">
                              <QrCode className="text-[#5d7c6f]" size={52} />
                            </div>
                            <p className="text-base text-gray-700 text-center">
                              กดปุ่มด้านล่างเพื่อเปิดกล้องแสกน
                              <br />
                              <span className="text-sm text-gray-600">
                                QR Code ที่ครูแสดง
                              </span>
                            </p>
                            <Button
                              className="bg-[#5d7c6f] text-white font-medium px-8"
                              size="lg"
                              startContent={<ScanLine size={20} />}
                              onPress={requestCameraAndStartScan}
                            >
                              เปิดกล้องแสกน QR
                            </Button>
                            <button
                              className="text-sm text-gray-600 underline underline-offset-2 hover:text-[#5d7c6f] transition-colors"
                              onClick={() => setShowPinInput(true)}
                            >
                              หรือกรอกรหัส PIN แทน
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {/* Questions (for non-QR missions) */}
                {selectedMission?.type !== "QR_CODE_SCANNING" && (
                  <div className="space-y-5">
                    {(() => {
                      const currentResult = camp?.missionResults?.find(
                        (r: any) =>
                          r.mission_mission_id === selectedMission?.mission_id,
                      );
                      const isSubmitted = currentResult?.status === "completed";

                      return selectedMission?.mission_question?.map(
                        (q: any, idx: number) => {
                          const isVideoSubmission =
                            selectedMission?.type === "VIDEO_SUBMISSION";
                          const videoSource = isVideoSubmission
                            ? getVideoSource(answers[q.question_id] || "")
                            : null;

                          return (
                            <div
                              key={q.question_id}
                              className="p-4 sm:p-5 rounded-2xl bg-white border border-gray-200/80 shadow-xs space-y-4"
                            >
                              <div className="flex items-start gap-3">
                                <span className="shrink-0 w-7 h-7 rounded-xl bg-[#5d7c6f]/10 text-[#5d7c6f] text-xs font-bold flex items-center justify-center mt-0.5">
                                  {idx + 1}
                                </span>
                                <label className="font-semibold text-gray-800 text-sm sm:text-base leading-snug break-words pt-0.5">
                                  {q.question_text}
                                </label>
                              </div>

                              {isVideoSubmission ? (
                                <div className="space-y-3">
                                  <div className="relative">
                                    <Video
                                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                      size={18}
                                    />
                                    <input
                                      className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#5d7c6f] focus:ring-2 focus:ring-[#5d7c6f]/20 disabled:bg-gray-50"
                                      disabled={isSubmitted}
                                      inputMode="url"
                                      placeholder="วางลิงก์ YouTube หรือ Google Drive"
                                      type="url"
                                      value={answers[q.question_id] || ""}
                                      onChange={(e) =>
                                        handleAnswerChange(
                                          q.question_id,
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    {supportedVideoUrlMessage}
                                  </p>
                                  {answers[q.question_id] && !videoSource && (
                                    <p className="text-xs font-medium text-red-500">
                                      ลิงก์นี้ยังไม่รองรับหรือไม่ใช่ HTTPS
                                      กรุณาตรวจสอบอีกครั้ง
                                    </p>
                                  )}
                                  {videoSource && (
                                    <div className="space-y-2 rounded-xl border border-[#5d7c6f]/20 bg-[#5d7c6f]/5 p-3">
                                      <p className="text-xs font-medium text-[#5d7c6f]">
                                        ตัวอย่างวิดีโอ ({videoSource.provider})
                                      </p>
                                      <VideoPlayer
                                        title="ตัวอย่างวิดีโอที่ส่ง"
                                        url={answers[q.question_id]}
                                      />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                q.question_type === "TEXT" && (
                                  <Textarea
                                    classNames={{
                                      input: "text-gray-900 font-medium",
                                    }}
                                    isReadOnly={isSubmitted}
                                    minRows={3}
                                    placeholder={
                                      isSubmitted
                                        ? ""
                                        : "พิมพ์คำตอบของคุณที่นี่..."
                                    }
                                    value={answers[q.question_id] || ""}
                                    variant="bordered"
                                    onValueChange={(val) =>
                                      handleAnswerChange(q.question_id, val)
                                    }
                                  />
                                )
                              )}

                              {q.question_type === "MCQ" && (
                                <div className="space-y-2">
                                  {q.choices?.map(
                                    (c: any, choiceIdx: number) => {
                                      const choiceLetter = String.fromCharCode(
                                        65 + choiceIdx,
                                      );

                                      return (
                                        <button
                                          key={c.choice_id}
                                          className={`
                                      w-full p-3 rounded-lg border flex items-center gap-3 transition-colors text-left
                                      ${
                                        answers[q.question_id] === choiceLetter
                                          ? "bg-[#5d7c6f] text-white border-[#5d7c6f]"
                                          : "bg-white text-gray-700 border-gray-200"
                                      }
                                    ${isSubmitted ? "opacity-75 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"}
                                  `}
                                          disabled={isSubmitted}
                                          type="button"
                                          onClick={() =>
                                            !isSubmitted &&
                                            handleAnswerChange(
                                              q.question_id,
                                              choiceLetter,
                                            )
                                          }
                                        >
                                          <div
                                            className={`
                                        w-6 h-6 rounded-full border flex items-center justify-center shrink-0 font-medium text-xs
                                        ${answers[q.question_id] === choiceLetter ? "border-white" : "border-gray-400"}
                                    `}
                                          >
                                            {choiceLetter}
                                          </div>
                                          <span className="min-w-0 break-words">
                                            {c.choice_text}
                                          </span>
                                        </button>
                                      );
                                    },
                                  )}
                                </div>
                              )}

                              {q.question_type === "PHOTO" && (
                                <div className="space-y-3">
                                  <input
                                    accept="image/*"
                                    className="hidden"
                                    id={`file-${q.question_id}`}
                                    type="file"
                                    onChange={(e) => {
                                      const file = e.currentTarget.files?.[0];

                                      // Allow retrying the same file after a failed upload.
                                      e.currentTarget.value = "";

                                      if (file)
                                        handleImageUpload(q.question_id, file);
                                    }}
                                  />

                                  {answers[q.question_id] ? (
                                    <div className="w-full rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-xs transition-all">
                                      {/* Top status bar */}
                                      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50/90 border-b border-gray-200">
                                        <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                                          <CheckCircle2
                                            className="text-emerald-600 shrink-0"
                                            size={16}
                                          />
                                          <span>อัปโหลดรูปภาพสำเร็จแล้ว</span>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          <button
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-white hover:shadow-xs border border-transparent hover:border-gray-200 transition-all cursor-pointer"
                                            title="ดูรูปภาพขนาดเต็ม"
                                            type="button"
                                            onClick={() =>
                                              setPreviewFullImageUrl(
                                                answers[q.question_id],
                                              )
                                            }
                                          >
                                            <Eye
                                              className="text-gray-500"
                                              size={14}
                                            />
                                            <span className="hidden sm:inline">
                                              ดูรูปขยาย
                                            </span>
                                          </button>

                                          {!isSubmitted && (
                                            <>
                                              <button
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-white hover:shadow-xs border border-transparent hover:border-gray-200 transition-all cursor-pointer"
                                                title="เปลี่ยนรูปภาพใหม่"
                                                type="button"
                                                onClick={() =>
                                                  document
                                                    .getElementById(
                                                      `file-${q.question_id}`,
                                                    )
                                                    ?.click()
                                                }
                                              >
                                                <RefreshCw
                                                  className="text-gray-500"
                                                  size={14}
                                                />
                                                <span className="hidden sm:inline">
                                                  เปลี่ยนรูป
                                                </span>
                                              </button>

                                              <button
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                                                title="ลบรูปภาพนี้"
                                                type="button"
                                                onClick={() => {
                                                  handleAnswerChange(
                                                    q.question_id,
                                                    "",
                                                  );
                                                  setAnswerPublicIds(
                                                    (current) => {
                                                      const next = {
                                                        ...current,
                                                      };

                                                      delete next[
                                                        q.question_id
                                                      ];

                                                      return next;
                                                    },
                                                  );
                                                }}
                                              >
                                                <Trash2 size={14} />
                                                <span className="hidden sm:inline">
                                                  ลบ
                                                </span>
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      {/* Image preview canvas with object-contain to preserve full aspect ratio */}
                                      <button
                                        className="relative group p-3 sm:p-4 bg-slate-900/5 flex items-center justify-center min-h-[220px] max-h-[360px] cursor-pointer overflow-hidden"
                                        type="button"
                                        onClick={() =>
                                          setPreviewFullImageUrl(
                                            answers[q.question_id],
                                          )
                                        }
                                      >
                                        <img
                                          alt="Uploaded preview"
                                          className="max-h-[320px] w-auto max-w-full rounded-xl object-contain shadow-xs transition-transform duration-200 group-hover:scale-[1.01]"
                                          src={toThumbnail(
                                            answers[q.question_id],
                                          )}
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-medium text-xs backdrop-blur-[2px]">
                                          <Eye size={16} />
                                          <span>คลิกเพื่อดูรูปภาพขนาดเต็ม</span>
                                        </div>
                                      </button>
                                    </div>
                                  ) : uploadingQids.includes(q.question_id) ? (
                                    <div className="w-full bg-[#5d7c6f]/5 border-2 border-dashed border-[#5d7c6f]/40 py-8 px-6 rounded-2xl flex flex-col items-center justify-center gap-4 transition-all">
                                      <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-[#5d7c6f]/20 flex items-center justify-center relative">
                                        <div className="w-12 h-12 border-3 border-[#5d7c6f]/20 border-t-[#5d7c6f] rounded-full animate-spin absolute" />
                                        <span className="text-sm font-bold font-mono text-[#5d7c6f]">
                                          {uploadProgress[q.question_id] ?? 0}%
                                        </span>
                                      </div>

                                      <div className="space-y-1 text-center">
                                        <p className="text-sm font-semibold text-gray-800">
                                          กำลังอัปโหลดรูปภาพ...{" "}
                                          {uploadProgress[q.question_id] ?? 0}%
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          ระบบกำลังประมวลผลและบีบอัดภาพเพื่อคุณภาพที่ดีที่สุด
                                        </p>
                                      </div>

                                      <div className="w-full max-w-xs h-2 bg-gray-200/80 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-gradient-to-r from-[#5d7c6f] to-[#3d5a4e] rounded-full transition-all duration-150 ease-out"
                                          style={{
                                            width: `${uploadProgress[q.question_id] ?? 0}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <label
                                      className="w-full bg-white border-2 border-dashed border-gray-300 hover:border-[#5d7c6f] hover:bg-[#5d7c6f]/5 p-6 sm:p-8 rounded-2xl transition-all flex flex-col items-center justify-center gap-3 text-center cursor-pointer group"
                                      htmlFor={`file-${q.question_id}`}
                                    >
                                      <div className="w-14 h-14 rounded-2xl bg-[#5d7c6f]/10 text-[#5d7c6f] flex items-center justify-center group-hover:scale-105 group-hover:bg-[#5d7c6f] group-hover:text-white transition-all shadow-xs">
                                        <Camera size={26} />
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-sm font-semibold text-gray-800 group-hover:text-[#5d7c6f] transition-colors">
                                          ถ่ายรูป หรือ เลือกไฟล์รูปภาพ
                                        </p>
                                        <p className="text-xs text-gray-500 font-normal">
                                          รองรับไฟล์ JPG, PNG, WEBP ขนาดไม่เกิน
                                          20MB
                                        </p>
                                      </div>
                                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gray-100 group-hover:bg-[#5d7c6f]/15 text-xs font-semibold text-gray-700 group-hover:text-[#5d7c6f] transition-colors">
                                        <Camera size={14} />
                                        เลือกรูปภาพ
                                      </span>
                                    </label>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        },
                      );
                    })()}
                  </div>
                )}
              </ModalBody>

              <ModalFooter className="flex items-center justify-between sm:justify-end gap-3 px-6 py-4">
                {(() => {
                  const currentResult = camp?.missionResults?.find(
                    (r: any) =>
                      r.mission_mission_id === selectedMission?.mission_id,
                  );
                  const isSubmitted = currentResult?.status === "completed";
                  const isQr = selectedMission?.type === "QR_CODE_SCANNING";

                  // QR mission: only show close button
                  if (isQr) {
                    return (
                      <Button
                        className="bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                        variant="flat"
                        onPress={onClose}
                      >
                        ปิดหน้าต่าง
                      </Button>
                    );
                  }

                  const allAnswered = selectedMission?.mission_question?.every(
                    (q: any) =>
                      answers[q.question_id] &&
                      String(answers[q.question_id]).trim() !== "",
                  );
                  const photoQuestionCount =
                    selectedMission?.mission_question?.filter(
                      (q: any) => q.question_type === "PHOTO",
                    ).length ?? 0;
                  const isSinglePhotoSubmission =
                    selectedMission?.type === "PHOTO_SUBMISSION" &&
                    photoQuestionCount === 1;
                  const isUploading = uploadingQids.length > 0;
                  const canSubmit = allAnswered && !isUploading;

                  return (
                    <>
                      <Button
                        className="bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                        variant="flat"
                        onPress={onClose}
                      >
                        ปิดหน้าต่าง
                      </Button>
                      {!isSubmitted && (
                        <Button
                          className={`font-semibold text-white transition-all shadow-xs ${
                            canSubmit
                              ? "bg-[#5d7c6f] hover:bg-[#4a6659]"
                              : "bg-gray-400 hover:bg-gray-500"
                          }`}
                          isDisabled={
                            submitting ||
                            isUploading ||
                            (isSinglePhotoSubmission && !allAnswered)
                          }
                          isLoading={submitting}
                          onPress={submitMission}
                        >
                          {isUploading
                            ? `กำลังอัปโหลด... ${
                                uploadingQids.length === 1 &&
                                uploadProgress[uploadingQids[0]] !== undefined
                                  ? `${uploadProgress[uploadingQids[0]]}%`
                                  : ""
                              }`.trim()
                            : allAnswered || isSinglePhotoSubmission
                              ? "ส่งคำตอบ"
                              : "บันทึกร่าง"}
                        </Button>
                      )}
                    </>
                  );
                })()}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Full Image Preview Lightbox Modal */}
      <Modal
        classNames={{
          base: "bg-black/95 text-white max-h-[90vh]",
          header: "border-b border-white/10 text-white",
          body: "p-2 sm:p-4 flex items-center justify-center",
          footer: "border-t border-white/10",
        }}
        isOpen={!!previewFullImageUrl}
        scrollBehavior="inside"
        size="4xl"
        onClose={() => setPreviewFullImageUrl(null)}
      >
        <ModalContent>
          {(onClosePreview) => (
            <>
              <ModalHeader className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Eye className="text-emerald-400" size={18} />
                  <span className="text-sm sm:text-base font-medium">
                    ดูรูปภาพขนาดเต็ม
                  </span>
                </div>
              </ModalHeader>
              <ModalBody>
                {previewFullImageUrl && (
                  <img
                    alt="รูปภาพขนาดเต็ม"
                    className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-2xl mx-auto"
                    src={previewFullImageUrl}
                  />
                )}
              </ModalBody>
              <ModalFooter>
                <Button
                  className="bg-white/15 text-white hover:bg-white/25"
                  variant="flat"
                  onPress={onClosePreview}
                >
                  ปิด
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
