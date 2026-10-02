"use client";

import type { CertificateRenderManifest } from "@/lib/certificate-renderer";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@heroui/button";
import {
  Calendar,
  Clock,
  ChevronLeft,
  Flag,
  CheckCircle2,
  Award,
  Download,
  Lock,
  Shirt,
  LayoutDashboard,
  ClipboardList,
  ImageOff,
  Users,
  FileText,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  X,
  ScanLine,
  QrCode,
  KeyRound,
  Nfc,
  Bus,
  MapPin,
} from "lucide-react";
import { toast } from "react-hot-toast";
import dynamic from "next/dynamic";

import StudentCampDetailSkeleton from "./components/StudentCampDetailSkeleton";

import CampDestinationCard from "@/components/camp-location/CampDestinationCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  BANGKOK_TIME_ZONE,
  formatCampScheduleDate,
  getBangkokDaysUntil,
  getCampScheduleSlotState,
  isCampScheduleDayToday,
  isBangkokDateBefore,
  isBangkokDateInRange,
} from "@/lib/bangkok-date";

const QrScanner = dynamic(() => import("@/components/QrScanner"), {
  ssr: false,
});
const TakeSurveyModal = dynamic(() => import("../TakeSurveyModal"), {
  ssr: false,
});
const CampLocationTracker = dynamic(
  () => import("@/components/camp-location/CampLocationTracker"),
  { ssr: false },
);

function LazyCampLocationTracker({ campId }: { campId: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const element = containerRef.current;

    if (!element || shouldLoad) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={containerRef} className="min-h-24">
      {shouldLoad && <CampLocationTracker campId={campId} viewer="student" />}
    </div>
  );
}

const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL"];

type CertificateRequirements = {
  missionCompletionPercent?: number;
  totalMissions?: number;
  completedMissions?: number;
  requiredMissions?: number;
  missionRequirementMet?: boolean;
  requiresSurvey?: boolean;
  hasSurvey?: boolean;
  surveyCompleted?: boolean;
  surveyRequirementMet?: boolean;
  hasIssuedCertificate?: boolean;
};

function CertificateActionSection({
  hasCertificate,
  requirements,
  surveyCompleted,
  compact = false,
  onOpen,
}: {
  hasCertificate: boolean;
  requirements?: CertificateRequirements;
  surveyCompleted: boolean;
  compact?: boolean;
  onOpen: () => void;
}) {
  if (!hasCertificate) return null;

  const totalMissions = requirements?.totalMissions ?? 0;
  const requiredMissions = requirements?.requiredMissions ?? 0;
  const completedMissions = requirements?.completedMissions ?? 0;
  const missionRequirementMet = requirements?.missionRequirementMet ?? false;
  const requiresSurvey = requirements?.requiresSurvey ?? false;
  const hasSurvey = requirements?.hasSurvey ?? false;
  const surveyIsCompleted = Boolean(
    surveyCompleted || requirements?.surveyCompleted,
  );
  const surveyRequirementMet =
    !requiresSurvey ||
    surveyIsCompleted ||
    (requirements?.surveyRequirementMet ?? false);
  const hasIssuedCertificate = requirements?.hasIssuedCertificate ?? false;
  const canDownload =
    hasIssuedCertificate || (missionRequirementMet && surveyRequirementMet);
  const hasMissionRequirement = totalMissions > 0 && requiredMissions > 0;
  const hasAdditionalRequirements = hasMissionRequirement || requiresSurvey;

  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-2.5">
      <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-gray-400">
        <Award size={compact ? 14 : 13} />
        <span>เกียรติบัตร</span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
        <p className="mb-2 text-[11px] font-bold text-slate-600">
          เงื่อนไขการรับเกียรติบัตร
        </p>
        <div className="space-y-2">
          {hasMissionRequirement && (
            <div className="flex items-start gap-2">
              <CheckCircle2
                className={
                  missionRequirementMet
                    ? "mt-0.5 shrink-0 text-emerald-600"
                    : "mt-0.5 shrink-0 text-gray-300"
                }
                size={15}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-snug text-slate-700">
                  ทำภารกิจอย่างน้อย {requiredMissions} จาก {totalMissions}
                  ภารกิจ
                  {requirements?.missionCompletionPercent != null &&
                    ` (${requirements.missionCompletionPercent}%)`}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  ตอนนี้ทำสำเร็จแล้ว {completedMissions} ภารกิจ
                </p>
              </div>
            </div>
          )}

          {requiresSurvey && (
            <div className="flex items-start gap-2">
              <CheckCircle2
                className={
                  surveyRequirementMet
                    ? "mt-0.5 shrink-0 text-emerald-600"
                    : "mt-0.5 shrink-0 text-gray-300"
                }
                size={15}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-snug text-slate-700">
                  ทำแบบประเมินของค่ายให้เสร็จ
                </p>
                {!hasSurvey && !surveyIsCompleted && (
                  <p className="mt-0.5 text-[10px] text-amber-600">
                    รอครูเปิดแบบประเมินของค่ายนี้
                  </p>
                )}
              </div>
            </div>
          )}

          {!hasAdditionalRequirements && (
            <div className="flex items-start gap-2">
              <CheckCircle2
                className="mt-0.5 shrink-0 text-emerald-600"
                size={15}
              />
              <p className="text-xs font-semibold leading-snug text-slate-700">
                ลงทะเบียนเข้าร่วมค่ายแล้วรับเกียรติบัตรได้
              </p>
            </div>
          )}
        </div>
      </div>

      <Button
        fullWidth
        className={`${compact ? "text-xs" : "text-sm"} h-10 rounded-xl font-bold ${
          canDownload
            ? "bg-slate-700 text-white shadow-sm shadow-slate-700/20 hover:bg-slate-800"
            : "border border-dashed border-gray-200 bg-gray-50 text-gray-400"
        }`}
        isDisabled={!canDownload}
        startContent={
          canDownload ? (
            <Download size={compact ? 16 : 18} />
          ) : (
            <Award className="opacity-40" size={compact ? 16 : 18} />
          )
        }
        onPress={onOpen}
      >
        ดาวน์โหลดเกียรติบัตร
      </Button>

      {!canDownload && (
        <p className="flex items-center justify-center gap-1 text-center text-[11px] font-medium text-gray-400">
          <Lock size={11} /> ทำเงื่อนไขด้านบนให้ครบก่อนดาวน์โหลด
        </p>
      )}
    </div>
  );
}

function formatDate(dateString: string, endDate?: string) {
  if (!dateString) return "";

  const s = new Date(dateString).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: BANGKOK_TIME_ZONE,
  });

  if (!endDate || dateString === endDate) return s;
  const e = new Date(endDate).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: BANGKOK_TIME_ZONE,
  });

  return `${s} - ${e}`;
}

function getDaysRemaining(endDate: string) {
  if (!endDate) return null;

  return getBangkokDaysUntil(endDate);
}

/** คืน true ถ้าวันนี้อยู่ในช่วงจองเสื้อ (ไม่ย้อนหลัง ไม่เกินวันหมดเขต) */
function isInShirtPeriod(startDate?: string, endDate?: string): boolean {
  return isBangkokDateInRange(startDate, endDate);
}

export default function StudentCampDetailPage({
  initialCamp,
}: {
  initialCamp: any;
}) {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const hasInitialCampRef = useRef(initialCamp !== null);

  const [camp, setCamp] = useState<any>(initialCamp);
  const [loading, setLoading] = useState(initialCamp === null);
  const [registering, setRegistering] = useState(false);
  const [shirtSize, setShirtSize] = useState(initialCamp?.shirtSize || "");
  const [selectedSize, setSelectedSize] = useState(
    initialCamp?.shirtSize || "",
  );
  const [savingShirt, setSavingShirt] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [isEditingShirt, setIsEditingShirt] = useState(false);
  const [isBottomMenuExpanded, setIsBottomMenuExpanded] = useState(true);

  // Survey State
  const [surveyData, setSurveyData] = useState<any>(null);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);

  // Schedule Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleNow, setScheduleNow] = useState(() => new Date());

  // Certificate Preview Modal State
  const [isCertPreviewModalOpen, setIsCertPreviewModalOpen] = useState(false);
  const [certImageLoading, setCertImageLoading] = useState(true);
  const [certPreviewUrl, setCertPreviewUrl] = useState<string | null>(null);
  const [certPreviewError, setCertPreviewError] = useState<string | null>(null);
  const certificateManifestRef = useRef<{
    campId: string;
    manifest: CertificateRenderManifest;
  } | null>(null);
  const certificateRequestRef = useRef<{
    campId: string;
    request: Promise<CertificateRenderManifest>;
  } | null>(null);
  const certificatePreviewBlobRef = useRef<Blob | null>(null);
  const certificatePreviewUrlRef = useRef<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<
    "pdf" | "png" | null
  >(null);

  // Shirt Selection Modal State (Auto-open after register)
  const [isShirtSelectionModalOpen, setIsShirtSelectionModalOpen] =
    useState(false);

  // Attendance State
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceCheckedIn, setAttendanceCheckedIn] = useState(false);
  const [attendanceCheckedAt, setAttendanceCheckedAt] = useState<string | null>(
    null,
  );
  const [attendanceMethod, setAttendanceMethod] = useState<"QR" | "NFC" | null>(
    null,
  );
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
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fetchCamp = async () => {
    try {
      const res = await fetch(`/api/student/camps/${id}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (res.ok) {
        const found = await res.json();

        if (found) {
          setCamp(found);
          if (found.shirtSize) {
            setShirtSize(found.shirtSize);
            setSelectedSize(found.shirtSize);
          }
        } else {
          toast.error("ไม่พบค่าย");
        }
      }
    } catch (error) {
      console.error("Failed to fetch camp", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0); // เลื่อนขึ้นไปบนสุดทุกครั้งที่เข้าหน้าค่าย
    if (hasInitialCampRef.current) {
      hasInitialCampRef.current = false;

      return;
    }

    fetchCamp();
  }, [id]);

  useEffect(() => {
    certificateManifestRef.current = null;
    certificateRequestRef.current = null;
    certificatePreviewBlobRef.current = null;

    if (certificatePreviewUrlRef.current) {
      URL.revokeObjectURL(certificatePreviewUrlRef.current);
      certificatePreviewUrlRef.current = null;
    }

    setCertPreviewUrl(null);
    setCertPreviewError(null);

    return () => {
      if (certificatePreviewUrlRef.current) {
        URL.revokeObjectURL(certificatePreviewUrlRef.current);
        certificatePreviewUrlRef.current = null;
      }
    };
  }, [id]);

  useEffect(() => {
    if (camp?.isRegistered && id) {
      fetchSurvey();
    } else {
      setSurveyData(null);
      setSurveyCompleted(false);
    }
  }, [camp?.isRegistered, id]);

  useEffect(() => {
    if (camp?.isRegistered && id) {
      checkAttendanceStatus();
    }
  }, [camp?.isRegistered, id]);

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setScheduleNow(new Date()),
      30_000,
    );

    return () => window.clearInterval(intervalId);
  }, []);

  // พับเมนูอัตโนมัติเมื่อค่ายยังไม่เริ่ม
  useEffect(() => {
    if (!camp) return;
    const startDate = camp.rawStartDate ? new Date(camp.rawStartDate) : null;
    const campNotStarted = Boolean(
      startDate && isBangkokDateBefore(new Date(), startDate),
    );

    if (camp.isRegistered && campNotStarted) {
      setIsBottomMenuExpanded(false);
    }
  }, [camp]);

  const fetchSurvey = async () => {
    try {
      const res = await fetch(`/api/student/surveys?campId=${id}`);

      if (res.ok) {
        const data = await res.json();

        if (data.survey) {
          setSurveyData(data.survey);
          setSurveyCompleted(data.isCompleted);
        }
      } else {
        setSurveyData(null);
        setSurveyCompleted(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSurveyCompleted = () => {
    setSurveyCompleted(true);
  };

  const checkAttendanceStatus = async () => {
    try {
      const res = await fetch(`/api/student/attendance/checkin?campId=${id}`);

      if (res.ok) {
        const data = await res.json();

        setAttendanceCheckedIn(data.isCheckedIn);
        setAttendanceCheckedAt(data.checkedAt);
        setAttendanceMethod(data.method === "NFC" ? "NFC" : data.method);
      }
    } catch (err) {
      console.error("Failed to check attendance status", err);
    }
  };

  const handleQrScan = async (payload: string) => {
    if (qrProcessingRef.current) return;
    qrProcessingRef.current = true;
    setQrScanActive(false);
    setAttendanceLoading(true);
    try {
      const res = await fetch("/api/student/attendance/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrPayload: payload }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setQrScanResult(data.alreadyCheckedIn ? "alreadyDone" : "success");
        setQrScanMessage(data.message);
        setAttendanceCheckedIn(true);
        setAttendanceCheckedAt(data.checkedAt);
      } else {
        setQrScanResult("error");
        setQrScanMessage(data.error || "QR Code ไม่ถูกต้อง");
        qrProcessingRef.current = false;
      }
    } catch {
      setQrScanResult("error");
      setQrScanMessage("เกิดข้อผิดพลาดในการแสกน");
      qrProcessingRef.current = false;
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handlePinSubmit = async () => {
    if (!pinInput.trim() || !id) return;
    setPinSubmitting(true);
    try {
      const res = await fetch("/api/student/attendance/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput.trim(), campId: Number(id) }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setQrScanResult(data.alreadyCheckedIn ? "alreadyDone" : "success");
        setQrScanMessage(data.message);
        setAttendanceCheckedIn(true);
        setAttendanceCheckedAt(data.checkedAt);
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
    setCameraError(null);
    const isSecure =
      window.isSecureContext ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1";

    if (!isSecure) {
      setCameraError(
        "เบราว์เซอร์นี้ไม่รองรับการเปิดกล้องบน HTTP กรุณาใช้ HTTPS หรือกรอก PIN แทน",
      );
      setShowPinInput(true);

      return;
    }
    const hasMedia = !!navigator.mediaDevices?.getUserMedia;

    if (!hasMedia) {
      setCameraError("อุปกรณ์นี้ไม่รองรับกล้อง กรุณากรอก PIN แทน");
      setShowPinInput(true);

      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });

      stream.getTracks().forEach((t) => t.stop());
      setQrScanActive(true);
    } catch (err: any) {
      const isDenied =
        err?.name === "NotAllowedError" ||
        err?.name === "PermissionDeniedError";

      if (isDenied) {
        setCameraError(
          "ไม่ได้รับอนุญาตเข้าถึงกล้อง กรุณาอนุญาตในการตั้งค่าเบราว์เซอร์",
        );
        setQrScanResult("error");
        setQrScanMessage("ไม่ได้รับอนุญาตเข้าถึงกล้อง หรือกรอก PIN แทน");
      } else {
        setCameraError("ไม่สามารถเปิดกล้องได้ กรุณากรอก PIN แทน");
        setShowPinInput(true);
      }
    }
  };

  const openAttendanceModal = () => {
    if (attendanceMethod === "NFC" && !attendanceCheckedIn) {
      toast("รอบนี้ครูจะเช็คชื่อด้วยบัตร NFC กรุณานำบัตรไปแตะที่โทรศัพท์ครู");

      return;
    }

    setQrScanActive(false);
    setIsAttendanceModalOpen(true);
    if (!attendanceCheckedIn && !showPinInput) {
      setTimeout(() => {
        requestCameraAndStartScan();
      }, 500);
    }
  };

  const getCertificateManifest = async () => {
    const currentCampId = String(id);

    if (certificateManifestRef.current?.campId === currentCampId) {
      return certificateManifestRef.current.manifest;
    }

    if (certificateRequestRef.current?.campId === currentCampId) {
      return certificateRequestRef.current.request;
    }

    const request = (async () => {
      const response = await fetch(`/api/camps/${id}/certificate`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.certificate) {
        const requestError = new Error(
          data.error || "ไม่สามารถเตรียมเกียรติบัตรได้",
        ) as Error & { status?: number };

        requestError.status = response.status;
        throw requestError;
      }

      const manifest = data.certificate as CertificateRenderManifest;

      certificateManifestRef.current = { campId: currentCampId, manifest };

      return manifest;
    })();

    certificateRequestRef.current = { campId: currentCampId, request };

    try {
      return await request;
    } finally {
      if (certificateRequestRef.current?.request === request) {
        certificateRequestRef.current = null;
      }
    }
  };

  const cacheCertificatePreview = (blob: Blob) => {
    certificatePreviewBlobRef.current = blob;

    if (certificatePreviewUrlRef.current) {
      URL.revokeObjectURL(certificatePreviewUrlRef.current);
    }

    const previewUrl = URL.createObjectURL(blob);

    certificatePreviewUrlRef.current = previewUrl;
    setCertPreviewUrl(previewUrl);
  };

  const handleCertDownload = async (format: "pdf" | "png") => {
    if (downloadingFormat) return;
    setDownloadingFormat(format);

    try {
      const manifest = await getCertificateManifest();
      const renderer = await import("@/lib/certificate-renderer");
      const blob =
        format === "png"
          ? (certificatePreviewBlobRef.current ??
            (await renderer.renderCertificatePng(manifest)))
          : await renderer.renderCertificatesPdf(manifest);

      if (format === "png" && !certificatePreviewBlobRef.current) {
        cacheCertificatePreview(blob);
      }

      renderer.downloadCertificateBlob(blob, `certificate_${id}.${format}`);
    } catch (error) {
      const requestError = error as Error & { status?: number };

      toast.error(
        requestError.status === 429
          ? "คุณดาวน์โหลดบ่อยเกินไป กรุณารอสักครู่ก่อนดาวน์โหลดใหม่"
          : requestError.message || "เกิดข้อผิดพลาดในการดาวน์โหลด",
      );
    } finally {
      setDownloadingFormat(null);
    }
  };

  const openCertPreview = () => {
    setIsCertPreviewModalOpen(true);
    setCertPreviewError(null);

    if (certificatePreviewUrlRef.current) {
      setCertPreviewUrl(certificatePreviewUrlRef.current);
      setCertImageLoading(false);

      return;
    }

    setCertImageLoading(true);

    void (async () => {
      try {
        const manifest = await getCertificateManifest();
        const { renderCertificatePng } = await import(
          "@/lib/certificate-renderer"
        );
        const blob = await renderCertificatePng(manifest);

        cacheCertificatePreview(blob);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการสร้างเกียรติบัตร";

        setCertPreviewError(message);
        toast.error(message);
        setCertImageLoading(false);
      }
    })();
  };

  const handleRegister = async () => {
    setRegistering(true);
    try {
      const res = await fetch("/api/student/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campId: Number(id) }),
      });

      if (res.ok) {
        toast.success("ลงทะเบียนสำเร็จ!");
        await fetchCamp();
        fetchSurvey();

        // ถ้าค่ายมีเสื้อ ให้เปิด Modal จองเสื้อทันที
        if (camp?.hasShirt) {
          setIsShirtSelectionModalOpen(true);
        }
      } else {
        toast.error("ลงทะเบียนล้มเหลว");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setRegistering(false);
    }
  };

  const handleShirtUpdate = async (size: string) => {
    setSavingShirt(true);
    try {
      const res = await fetch("/api/student/enroll", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campId: Number(id), shirtSize: size }),
      });

      if (res.ok) {
        toast.success("อัปเดตไซส์เสื้อเรียบร้อย!");
        setShirtSize(size);
        setIsEditingShirt(false);
        setIsShirtSelectionModalOpen(false);
      } else {
        toast.error("ไม่สามารถอัปเดตไซส์เสื้อได้");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSavingShirt(false);
    }
  };

  if (loading) return <StudentCampDetailSkeleton />;
  if (!camp) return <div className="p-8 text-center">ไม่พบค่าย</div>;

  const totalMissions =
    camp.station?.reduce(
      (acc: number, s: any) => acc + (s.mission?.length || 0),
      0,
    ) || 0;
  const completedMissions = 0;

  const daysLeftToReserve = getDaysRemaining(camp.endShirtDate);
  const shirtPeriodActive = isInShirtPeriod(
    camp.startShirtDate,
    camp.endShirtDate,
  );

  const startDate = camp.rawStartDate ? new Date(camp.rawStartDate) : null;
  const campNotStarted = Boolean(
    startDate && isBangkokDateBefore(new Date(), startDate),
  );
  const menuLocked = camp.isRegistered && campNotStarted;

  const currentScheduleSlot = camp.camp_daily_schedule
    ?.flatMap((day: any) =>
      (day.time_slots || []).map((slot: any) => ({ day: day.day, slot })),
    )
    .find(
      ({ day, slot }: any) =>
        getCampScheduleSlotState(
          camp.rawStartDate,
          day,
          slot.startTime,
          slot.endTime,
          scheduleNow,
        ) === "current",
    );

  const openSurvey = () => {
    if (campNotStarted) {
      toast.error("ค่ายยังไม่เริ่ม ไม่สามารถทำแบบประเมินได้");

      return;
    }

    setIsSurveyModalOpen(true);
  };

  return (
    <div
      className={`student-camp-page min-h-screen bg-[#F5F5F3] transition-[padding] duration-300 pb-28 lg:pb-16`}
    >
      {/* Hero Section */}
      <div className="relative h-44 overflow-hidden bg-gray-200 sm:h-80 lg:h-96">
        {camp.img_camp_url ? (
          <Image
            fill
            priority
            alt={camp.title}
            className="w-full h-full object-cover"
            fetchPriority="high"
            sizes="100vw"
            src={camp.img_camp_url}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#2d3748] to-[#1a202c] flex items-center justify-center text-white/20">
            <Flag className="animate-pulse" size={80} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />

        <div className="absolute top-6 left-6 z-20">
          <Button
            isIconOnly
            className="bg-white/80 backdrop-blur-md text-gray-700 shadow-sm border border-white/40 rounded-xl hover:bg-white transition-all"
            variant="flat"
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} />
          </Button>
        </div>
      </div>

      <div className="relative z-20 mx-auto -mt-10 max-w-6xl px-4 sm:-mt-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Content Column (8 cols on desktop) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Main Info Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200/80 p-6 sm:p-8">
              <div className="mb-6">
                {/* Status Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {camp.isRegistered && !camp.isEnded && (
                    <span className="inline-flex items-center gap-1.5 bg-[#E6F4EA] text-[#1E8E3E] text-xs sm:text-[13px] font-bold px-3.5 py-1.5 rounded-full">
                      <CheckCircle2 className="text-[#1E8E3E]" size={15} />{" "}
                      ลงทะเบียนแล้ว
                    </span>
                  )}
                  {camp.isEnded && (
                    <span className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-xs sm:text-[13px] font-bold px-3.5 py-1.5 rounded-full">
                      <Flag size={15} /> ค่ายจบแล้ว
                    </span>
                  )}
                  {camp.academicYear && (
                    <span className="inline-flex items-center bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-full">
                      ปีการศึกษา {(camp.academicYear + 543).toString()}
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 leading-tight tracking-tight">
                  {camp.title}
                </h1>
              </div>

              {/* Description Section */}
              <div className="mb-8">
                <div className="flex items-center gap-2.5 mb-3">
                  <FileText className="text-[#5d7c6f]" size={20} />
                  <h2 className="text-base font-bold text-gray-900">
                    รายละเอียดค่าย
                  </h2>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line pl-1 font-normal">
                  {camp.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                </p>
              </div>

              {/* Detailed Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Camp Dates */}
                <div className="flex items-center gap-3.5 bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-xs flex items-center justify-center shrink-0 border border-gray-100 text-[#5d7c6f]">
                    <Calendar size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-400">
                      วันจัดค่าย
                    </p>
                    <p className="text-gray-900 font-bold text-sm truncate">
                      {formatDate(camp.rawStartDate, camp.rawEndDate)}
                    </p>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-3.5 bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-xs flex items-center justify-center shrink-0 border border-gray-100 text-[#5d7c6f]">
                    <MapPin size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-400">
                      สถานที่จัดค่าย
                    </p>
                    <p className="text-gray-900 font-bold text-sm truncate">
                      {camp.location || "ไม่ระบุสถานที่"}
                    </p>
                  </div>
                </div>
              </div>

              <CampDestinationCard
                className="mt-4"
                destination={camp.destination}
                fallbackName={camp.location}
              />

              {/* Registration Count & Progress */}
              <div className="mt-4 bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between gap-4 mb-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                    <Users className="text-[#5d7c6f]" size={16} />
                    <span>จำนวนผู้ลงทะเบียน</span>
                  </div>
                  <p className="text-sm font-bold text-[#5d7c6f]">
                    {camp.totalEnrolled} / {camp.totalCapacity} คน
                  </p>
                </div>
                <div className="w-full h-2.5 bg-gray-200/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#5d7c6f] rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (camp.totalEnrolled / camp.totalCapacity) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Mobile Quick Links (Schedule & Bus) */}
              <div className="lg:hidden mt-6 space-y-3">
                {camp.camp_daily_schedule &&
                  camp.camp_daily_schedule.length > 0 && (
                    <button
                      className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-[#5d7c6f]/5 hover:bg-[#5d7c6f]/10 transition-all border border-[#5d7c6f]/15"
                      onClick={() => setIsScheduleModalOpen(true)}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 bg-[#5d7c6f] rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm">
                          <CalendarDays size={18} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-gray-900 text-sm">
                            กำหนดการค่าย
                          </p>
                          <p className="text-xs text-gray-500 font-medium">
                            {camp.camp_daily_schedule.length} วัน ·
                            กดเพื่อดูตารางเวลา
                          </p>
                        </div>
                      </div>
                      <ChevronLeft
                        className="text-[#5d7c6f] rotate-180"
                        size={18}
                      />
                    </button>
                  )}

                {camp.isRegistered && camp.hasTransport && (
                  <button
                    className="flex w-full items-center justify-between rounded-2xl border border-[#5d7c6f]/15 bg-[#5d7c6f]/5 px-5 py-3.5 text-left transition-all hover:bg-[#5d7c6f]/10"
                    type="button"
                    onClick={() =>
                      router.push(`/student/dashboard/camp/${id}/bus`)
                    }
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5d7c6f] text-white shadow-sm">
                        <Bus size={18} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-900">
                          ผังรถและที่นั่งของฉัน
                        </p>
                        <p className="text-xs text-gray-500 font-medium">
                          ตรวจสอบรถ ตำแหน่งที่นั่ง และยืนยันขึ้นรถ
                        </p>
                      </div>
                    </div>
                    <ChevronLeft
                      className="shrink-0 rotate-180 text-[#5d7c6f]"
                      size={18}
                    />
                  </button>
                )}
              </div>
            </div>

            <LazyCampLocationTracker campId={Number(id)} />

            {/* Mission Progress Section (Only if registered) */}
            {camp.isRegistered && (
              <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-8 border border-gray-200/80">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <LayoutDashboard className="text-[#5d7c6f]" size={18} />
                  ความคืบหน้าภารกิจ
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50/80 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2.5 text-sm font-bold text-gray-700">
                      <CheckCircle2 className="text-[#5d7c6f]" size={18} />
                      <span>ฐานที่ทำเสร็จ</span>
                    </div>
                    <span className="font-bold text-sm text-[#5d7c6f]">
                      0/{camp.station?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50/80 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2.5 text-sm font-bold text-gray-700">
                      <Flag className="text-[#5d7c6f]" size={18} />
                      <span>ภารกิจทั้งหมด</span>
                    </div>
                    <span className="font-bold text-sm text-[#5d7c6f]">
                      {completedMissions} สำเร็จ
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Shirt Reservation Section */}
            {camp.isRegistered && camp.hasShirt && (
              <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-8 border border-gray-200/80">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2.5">
                    <Shirt className="text-[#5d7c6f]" size={20} />
                    <h2 className="text-base font-bold text-gray-900">
                      จองเสื้อค่าย
                    </h2>
                  </div>
                  <div className="flex gap-2">
                    {isEditingShirt && (
                      <Button
                        className="text-gray-500 font-bold hover:bg-gray-100"
                        size="sm"
                        variant="light"
                        onPress={() => {
                          setSelectedSize(shirtSize);
                          setIsEditingShirt(false);
                        }}
                      >
                        ยกเลิก
                      </Button>
                    )}
                    {shirtSize && shirtPeriodActive && !isEditingShirt && (
                      <Button
                        className="bg-[#e8f0ee] text-[#3d6357] font-bold"
                        size="sm"
                        variant="flat"
                        onPress={() => setIsEditingShirt(true)}
                      >
                        แก้ไขไซส์เสื้อ
                      </Button>
                    )}
                  </div>
                </div>

                {shirtSize && !isEditingShirt ? (
                  <div className="bg-gray-50/80 rounded-2xl p-6 flex flex-col items-center justify-center border border-gray-100">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-xs flex items-center justify-center text-[#5d7c6f] font-black text-2xl mb-2 border border-gray-200/80">
                      {shirtSize}
                    </div>
                    <p className="text-gray-900 text-base font-bold">
                      ไซส์ที่เลือก: {shirtSize}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {shirtPeriodActive
                        ? "สามารถแก้ไขไซส์ได้ภายในระยะเวลาการจอง"
                        : "หมดเขตระยะเวลาการจอง/แก้ไขไซส์เสื้อแล้ว"}
                    </p>
                  </div>
                ) : !shirtSize && !shirtPeriodActive ? (
                  <div className="bg-amber-50/80 rounded-2xl p-6 flex flex-col items-center justify-center border border-amber-200/60">
                    <p className="text-amber-800 text-sm font-bold">
                      หมดเขตการจองเสื้อแล้ว
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      คุณไม่ได้ทำรายการในช่วงเวลาที่กำหนด
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-600 text-sm mb-4">
                      กรุณาเลือกไซส์เสื้อค่ายของคุณก่อน{" "}
                      {formatDate(camp.endShirtDate)}
                    </p>
                    {daysLeftToReserve !== null && (
                      <div className="bg-blue-50/80 border border-blue-100 rounded-2xl p-3.5 text-blue-700 text-xs sm:text-sm flex items-center gap-2 mb-6 font-medium">
                        <Clock size={16} />
                        <span>
                          {daysLeftToReserve === 0
                            ? "วันนี้วันสุดท้ายของการจอง"
                            : `เหลือเวลาอีก ${daysLeftToReserve} วัน`}
                        </span>
                        <span className="text-blue-500 ml-auto text-xs">
                          หมดเขต: {formatDate(camp.endShirtDate)}
                        </span>
                      </div>
                    )}
                    <div className="mb-6">
                      {(() => {
                        let shirtUrls: string[] = [];

                        if (camp.img_shirt_url) {
                          try {
                            const parsed = JSON.parse(camp.img_shirt_url);

                            shirtUrls = Array.isArray(parsed)
                              ? parsed.filter(Boolean)
                              : [camp.img_shirt_url];
                          } catch (e) {
                            shirtUrls = [camp.img_shirt_url];
                          }
                        }
                        if (shirtUrls.length > 0) {
                          return (
                            <div
                              className={`grid gap-4 ${shirtUrls.length === 1 ? "grid-cols-1 max-w-xs mx-auto" : "grid-cols-2 md:grid-cols-3"}`}
                            >
                              {shirtUrls.map((url, idx) => (
                                <button
                                  key={idx}
                                  className="bg-gray-100 rounded-2xl overflow-hidden aspect-square border border-gray-200 shadow-xs relative group cursor-pointer"
                                  type="button"
                                  onClick={() => setSelectedImage(url)}
                                >
                                  <img
                                    alt="Shirt"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    src={url}
                                  />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-white text-xs font-bold bg-black/50 px-2.5 py-1 rounded-full backdrop-blur-xs">
                                      ดูรูปขนาดเต็ม
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          );
                        }

                        return (
                          <div className="h-40 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 font-medium text-xs">
                            <ImageOff className="mb-2 opacity-40" size={28} />
                            ไม่มีรูปตัวอย่างเสื้อ
                          </div>
                        );
                      })()}
                    </div>
                    <div className="mb-6">
                      <p className="block text-xs font-bold text-gray-700 mb-2.5 uppercase tracking-wider">
                        เลือกไซส์เสื้อ:
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {SHIRT_SIZES.map((size) => (
                          <button
                            key={size}
                            className={`py-3 px-2 rounded-xl border text-sm font-bold transition-all ${
                              selectedSize === size
                                ? "bg-[#5d7c6f] text-white border-[#5d7c6f] shadow-md shadow-[#5d7c6f]/20"
                                : "bg-white text-gray-700 border-gray-200 hover:border-[#5d7c6f]/50"
                            } ${!shirtPeriodActive ? "opacity-60 cursor-not-allowed" : ""}`}
                            disabled={savingShirt || !shirtPeriodActive}
                            type="button"
                            onClick={() => setSelectedSize(size)}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      fullWidth
                      className="font-bold bg-[#5d7c6f] text-white h-12 rounded-xl shadow-md shadow-[#5d7c6f]/20 hover:bg-[#4d695e]"
                      isDisabled={!shirtPeriodActive || !selectedSize}
                      isLoading={savingShirt}
                      onPress={() => {
                        if (shirtSize === selectedSize)
                          setIsEditingShirt(false);
                        else handleShirtUpdate(selectedSize);
                      }}
                    >
                      {!shirtPeriodActive
                        ? "ไม่อยู่ในช่วงเวลาการจอง"
                        : shirtSize
                          ? shirtSize === selectedSize
                            ? "ยกเลิกการแก้ไข"
                            : "ยืนยันการแก้ไข"
                          : "ยืนยันการจองเสื้อ"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Desktop Sidebar Column (4 cols on desktop) */}
          <div className="hidden lg:block lg:col-span-4 sticky top-20 space-y-4">
            {/* Main Action Box */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200/80 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  การเข้าร่วมค่าย
                </span>
                <span className="text-xs font-semibold text-[#5d7c6f]">
                  {camp.isRegistered ? "ลงทะเบียนแล้ว" : "ยังไม่ได้ลงทะเบียน"}
                </span>
              </div>

              {!camp.isRegistered ? (
                camp.isEnded ? (
                  <Button
                    fullWidth
                    isDisabled
                    className="bg-gray-100 text-gray-400 font-bold text-sm h-12 rounded-xl cursor-not-allowed border border-gray-200"
                  >
                    สิ้นสุดการรับสมัครแล้ว
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    className="bg-[#5d7c6f] text-white font-bold text-base h-12 rounded-xl shadow-lg shadow-[#5d7c6f]/25 hover:bg-[#4d695e] active:scale-[0.98] transition-all"
                    isLoading={registering}
                    onPress={handleRegister}
                  >
                    เข้าร่วมค่าย
                  </Button>
                )
              ) : (
                <div className="space-y-3">
                  {/* Attendance Button (if active) */}
                  {!camp.isEnded && (
                    <Button
                      fullWidth
                      className={`h-11 rounded-xl font-bold text-sm border ${
                        attendanceCheckedIn
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-[#5d7c6f]/10 text-[#5d7c6f] border-[#5d7c6f]/30 hover:bg-[#5d7c6f]/20"
                      }`}
                      isDisabled={!!campNotStarted}
                      startContent={
                        attendanceCheckedIn ? (
                          <CheckCircle2 size={18} />
                        ) : attendanceMethod === "NFC" ? (
                          <Nfc size={18} />
                        ) : (
                          <QrCode size={18} />
                        )
                      }
                      onPress={openAttendanceModal}
                    >
                      {attendanceCheckedIn
                        ? "เช็คชื่อแล้ว"
                        : attendanceMethod === "NFC"
                          ? "แตะบัตรกับครู"
                          : "เช็คชื่อเข้าค่าย"}
                    </Button>
                  )}

                  {/* Mission Button */}
                  <Button
                    fullWidth
                    className="h-11 rounded-xl bg-[#5d7c6f] text-sm font-bold text-white shadow-md shadow-[#5d7c6f]/20 hover:bg-[#4d695e]"
                    isDisabled={navigating || !!campNotStarted}
                    isLoading={navigating}
                    startContent={<LayoutDashboard size={18} />}
                    onPress={() => {
                      setNavigating(true);
                      router.push(`/student/dashboard/camp/${id}/missions`);
                    }}
                  >
                    {camp.isEnded ? "สรุปผลการทำภารกิจ" : "เข้าสู่ภารกิจค่าย"}
                  </Button>

                  {/* Survey Button */}
                  {surveyData && (
                    <Button
                      fullWidth
                      className={`h-11 rounded-xl border text-sm font-bold ${
                        surveyData && !surveyCompleted
                          ? "border-yellow-300 bg-[#FFECC9] text-yellow-800 hover:bg-[#ffe4b0]"
                          : surveyCompleted
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-gray-200 bg-gray-50 text-gray-400"
                      }`}
                      isDisabled={
                        campNotStarted || !surveyData || surveyCompleted
                      }
                      startContent={
                        surveyCompleted ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <ClipboardList size={18} />
                        )
                      }
                      onPress={openSurvey}
                    >
                      {surveyCompleted ? "ประเมินแล้ว" : "ทำแบบประเมิน"}
                    </Button>
                  )}

                  <CertificateActionSection
                    compact
                    hasCertificate={!!camp.img_certificate_url}
                    requirements={camp.certificateRequirements}
                    surveyCompleted={surveyCompleted}
                    onOpen={openCertPreview}
                  />
                </div>
              )}
            </div>

            {/* Quick Navigation Cards on Desktop */}
            {camp.camp_daily_schedule &&
              camp.camp_daily_schedule.length > 0 && (
                <button
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-200/80 shadow-xs hover:border-[#5d7c6f]/40 hover:shadow-sm transition-all text-left"
                  onClick={() => setIsScheduleModalOpen(true)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#e8f0ee] text-[#3d6357] rounded-xl flex items-center justify-center shrink-0">
                      <CalendarDays size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900">
                        กำหนดการค่าย
                      </p>
                      <p className="text-xs text-gray-500">
                        {camp.camp_daily_schedule.length} วัน · คลิกเพื่อดูตาราง
                      </p>
                    </div>
                  </div>
                  <ChevronLeft className="text-gray-400 rotate-180" size={16} />
                </button>
              )}

            {camp.isRegistered && camp.hasTransport && (
              <button
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-200/80 shadow-xs hover:border-[#5d7c6f]/40 hover:shadow-sm transition-all text-left"
                onClick={() => router.push(`/student/dashboard/camp/${id}/bus`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#e8f0ee] text-[#3d6357] rounded-xl flex items-center justify-center shrink-0">
                    <Bus size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900">
                      ผังรถและที่นั่ง
                    </p>
                    <p className="text-xs text-gray-500">
                      ตรวจสอบรถ & ยืนยันขึ้นรถ
                    </p>
                  </div>
                </div>
                <ChevronLeft className="text-gray-400 rotate-180" size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Fixed Bottom Menu (Hidden on Desktop) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100/80 bg-white/90 px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-2xl shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="relative max-w-xl mx-auto rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          <button
            aria-controls="camp-bottom-menu-content"
            aria-expanded={isBottomMenuExpanded}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d7c6f]/40 hover:bg-gray-50"
            type="button"
            onClick={() => {
              setIsBottomMenuExpanded((expanded) => !expanded);
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e8f0ee] text-[#3d6357]">
                <LayoutDashboard size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-gray-800">
                  เมนูการทำค่าย
                </span>
                {!isBottomMenuExpanded && (
                  <span className="block truncate text-[11px] font-medium text-gray-400">
                    {menuLocked
                      ? `เปิดใช้งานวันที่ ${formatDate(camp.rawStartDate)}`
                      : "แตะเพื่อแสดงภารกิจและเมนูอื่น ๆ"}
                  </span>
                )}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#5d7c6f]">
              {isBottomMenuExpanded ? "พับเมนู" : "กางเมนู"}
              <ChevronDown
                aria-hidden="true"
                className={`transition-transform duration-300 ${
                  isBottomMenuExpanded ? "rotate-180" : ""
                }`}
                size={18}
              />
            </span>
          </button>

          <div
            aria-hidden={!isBottomMenuExpanded}
            className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
              isBottomMenuExpanded
                ? "mt-3 grid-rows-[1fr] opacity-100"
                : "mt-0 grid-rows-[0fr] opacity-0"
            }`}
            id="camp-bottom-menu-content"
            inert={!isBottomMenuExpanded}
          >
            <div className="relative min-h-0 overflow-hidden">
              {menuLocked && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 rounded-2xl border border-gray-200 bg-white/95 px-4 text-center shadow-sm backdrop-blur-sm">
                  <Lock className="text-[#5d7c6f]" size={24} />
                  <p className="text-sm font-black text-gray-900">
                    เมนูนี้จะเปิดให้ใช้งานในวันเข้าค่าย
                  </p>
                  <p className="text-xs font-bold text-gray-400">
                    เริ่มใช้งานได้วันที่ {formatDate(camp.rawStartDate)}
                  </p>
                </div>
              )}
              {!camp.isRegistered ? (
                camp.isEnded ? (
                  <Button
                    fullWidth
                    isDisabled
                    className="bg-gray-100 text-gray-400 font-black text-base h-12 rounded-xl cursor-not-allowed border border-gray-200"
                  >
                    สิ้นสุดการรับสมัครแล้ว
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    className="bg-[#5d7c6f] text-white font-black text-base h-12 rounded-xl shadow-lg shadow-[#5d7c6f]/25 hover:scale-[1.01] active:scale-[0.98] transition-all"
                    isLoading={registering}
                    onPress={handleRegister}
                  >
                    เข้าร่วมค่าย
                  </Button>
                )
              ) : (
                <div className="relative">
                  {(() => {
                    const hasCertTemplate = !!camp?.img_certificate_url;
                    const requirements = camp?.certificateRequirements;

                    return (
                      <>
                        <div className="flex flex-col gap-3">
                          {camp.isEnded ? (
                            <>
                              <Button
                                fullWidth
                                className="bg-[#5d7c6f] text-white font-bold text-base h-12 rounded-xl shadow-md shadow-[#5d7c6f]/20"
                                isLoading={navigating}
                                startContent={<LayoutDashboard size={22} />}
                                onPress={() => {
                                  setNavigating(true);
                                  router.push(
                                    `/student/dashboard/camp/${id}/missions`,
                                  );
                                }}
                              >
                                สรุปผลการทำภารกิจ
                              </Button>
                              {surveyData && (
                                <Button
                                  fullWidth
                                  className={`h-11 rounded-xl font-bold text-sm border ${
                                    surveyCompleted
                                      ? "bg-green-50 text-green-700 border-green-200"
                                      : "bg-[#FFECC9] text-yellow-800 border-yellow-300 shadow-md shadow-yellow-200/30"
                                  }`}
                                  isDisabled={surveyCompleted}
                                  startContent={
                                    surveyCompleted ? (
                                      <CheckCircle2 size={18} />
                                    ) : (
                                      <ClipboardList size={18} />
                                    )
                                  }
                                  onPress={openSurvey}
                                >
                                  {surveyCompleted
                                    ? "ประเมินแล้ว"
                                    : "ทำแบบประเมิน"}
                                </Button>
                              )}
                              <CertificateActionSection
                                hasCertificate={hasCertTemplate}
                                requirements={requirements}
                                surveyCompleted={surveyCompleted}
                                onOpen={openCertPreview}
                              />
                            </>
                          ) : (
                            <>
                              <div className="grid grid-cols-1 gap-2">
                                <Button
                                  fullWidth
                                  className={`h-10 rounded-xl font-bold text-sm border ${
                                    attendanceCheckedIn
                                      ? "bg-green-50 text-green-700 border-green-200"
                                      : "bg-[#5d7c6f]/10 text-[#5d7c6f] border-[#5d7c6f]/30"
                                  }`}
                                  isDisabled={!!campNotStarted}
                                  startContent={
                                    attendanceCheckedIn ? (
                                      <CheckCircle2 size={16} />
                                    ) : attendanceMethod === "NFC" ? (
                                      <Nfc size={16} />
                                    ) : (
                                      <QrCode size={16} />
                                    )
                                  }
                                  onPress={openAttendanceModal}
                                >
                                  {attendanceCheckedIn
                                    ? "เช็คชื่อแล้ว"
                                    : attendanceMethod === "NFC"
                                      ? "แตะบัตรกับครู"
                                      : "เช็คชื่อ"}
                                </Button>
                              </div>

                              <div
                                className={
                                  surveyData ? "grid grid-cols-2 gap-2" : ""
                                }
                              >
                                <Button
                                  fullWidth
                                  className="h-10 rounded-xl bg-[#5d7c6f] text-sm font-bold text-white shadow-md shadow-[#5d7c6f]/20"
                                  isDisabled={navigating || !!campNotStarted}
                                  isLoading={navigating}
                                  startContent={<LayoutDashboard size={18} />}
                                  onPress={() => {
                                    setNavigating(true);
                                    router.push(
                                      `/student/dashboard/camp/${id}/missions`,
                                    );
                                  }}
                                >
                                  ภารกิจ
                                </Button>
                                {surveyData && (
                                  <Button
                                    fullWidth
                                    className={`h-10 rounded-xl border text-sm font-bold ${
                                      surveyData && !surveyCompleted
                                        ? "border-yellow-300 bg-[#FFECC9] text-yellow-800"
                                        : surveyCompleted
                                          ? "border-green-200 bg-green-50 text-green-700"
                                          : "border-gray-200 bg-gray-50 text-gray-400"
                                    }`}
                                    isDisabled={
                                      campNotStarted ||
                                      !surveyData ||
                                      surveyCompleted
                                    }
                                    startContent={<ClipboardList size={16} />}
                                    onPress={openSurvey}
                                  >
                                    {surveyCompleted
                                      ? "ประเมินแล้ว"
                                      : "แบบประเมิน"}
                                  </Button>
                                )}
                              </div>

                              <CertificateActionSection
                                hasCertificate={hasCertTemplate}
                                requirements={requirements}
                                surveyCompleted={surveyCompleted}
                                onOpen={openCertPreview}
                              />
                            </>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isSurveyModalOpen && (
        <TakeSurveyModal
          campId={Number(id)}
          isOpen={isSurveyModalOpen}
          survey={surveyData}
          onClose={() => setIsSurveyModalOpen(false)}
          onCompleted={handleSurveyCompleted}
        />
      )}

      {/* Schedule Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CalendarDays className="text-[#5d7c6f]" size={20} />
                <h2 className="text-lg font-bold text-gray-800">
                  กำหนดการค่าย
                </h2>
              </div>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500"
                onClick={() => setIsScheduleModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-4 space-y-4">
              {camp.camp_daily_schedule.map((day: any, dayIdx: number) => {
                const isToday = isCampScheduleDayToday(
                  camp.rawStartDate,
                  day.day,
                  scheduleNow,
                );

                return (
                  <div
                    key={day.daily_schedule_id ?? dayIdx}
                    className={`rounded-2xl border overflow-hidden ${
                      isToday ? "border-emerald-300" : "border-gray-100"
                    }`}
                  >
                    {/* Day Header */}
                    <div className="bg-[#5d7c6f] px-4 py-2.5 flex items-center gap-2 flex-wrap">
                      <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {day.day}
                      </div>
                      <span className="text-white font-semibold text-sm">
                        วันที่ {day.day}
                      </span>
                      {camp.rawStartDate && (
                        <span className="text-white/80 text-xs font-normal">
                          ({formatCampScheduleDate(camp.rawStartDate, day.day)})
                        </span>
                      )}
                      {isToday && (
                        <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white">
                          วันนี้
                        </span>
                      )}
                    </div>

                    {/* Time Slots */}
                    {day.time_slots && day.time_slots.length > 0 ? (
                      <div className="divide-y divide-gray-50">
                        {day.time_slots.map((slot: any, slotIdx: number) => {
                          const isCurrent =
                            getCampScheduleSlotState(
                              camp.rawStartDate,
                              day.day,
                              slot.startTime,
                              slot.endTime,
                              scheduleNow,
                            ) === "current";

                          return (
                            <div
                              key={slot.time_slot_id ?? slotIdx}
                              aria-current={isCurrent ? "step" : undefined}
                              className={`flex flex-col items-stretch gap-2 px-4 py-3 transition-colors sm:flex-row sm:items-start sm:gap-3 ${
                                isCurrent
                                  ? "bg-emerald-50 ring-1 ring-inset ring-emerald-200"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <div className="mt-0.5 flex w-full flex-wrap items-center gap-1 text-[#5d7c6f] sm:w-auto sm:min-w-[110px] sm:flex-shrink-0">
                                <Clock className="flex-shrink-0" size={13} />
                                <span className="text-xs font-mono font-semibold">
                                  {slot.startTime?.slice(0, 5)} –{" "}
                                  {slot.endTime?.slice(0, 5)}
                                </span>
                                {isCurrent && (
                                  <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white md:hidden">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                                    กำลังดำเนินการ
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 md:flex md:items-center md:gap-2">
                                <p className="text-sm leading-relaxed text-gray-700">
                                  {slot.activity}
                                </p>
                                {isCurrent && (
                                  <span className="hidden items-center gap-1 whitespace-nowrap rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white md:inline-flex">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                                    กำลังดำเนินการ
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 px-4 py-3">
                        ไม่มีกิจกรรม
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100">
              <Button
                fullWidth
                className="bg-[#5d7c6f] text-white font-semibold"
                onPress={() => setIsScheduleModalOpen(false)}
              >
                ปิด
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <QrCode className="text-[#5d7c6f]" size={20} />
                <h2 className="text-lg font-bold text-gray-800">เช็คชื่อ</h2>
              </div>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500"
                onClick={() => setIsAttendanceModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-6 flex flex-col items-center gap-5">
              {attendanceCheckedIn ? (
                // Already checked in
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="text-green-500" size={52} />
                  </div>
                  <p className="text-xl font-bold text-green-700">
                    เช็คชื่อสำเร็จแล้ว!
                  </p>
                  {attendanceCheckedAt && (
                    <p className="text-sm text-gray-500">
                      เวลา:{" "}
                      {new Date(attendanceCheckedAt).toLocaleString("th-TH", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: BANGKOK_TIME_ZONE,
                      })}
                    </p>
                  )}
                </div>
              ) : qrScanResult === "success" ||
                qrScanResult === "alreadyDone" ? (
                // Just checked in successfully
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="text-green-500" size={52} />
                  </div>
                  <p className="text-xl font-bold text-green-700">
                    {qrScanResult === "alreadyDone"
                      ? "เช็คชื่อไปแล้ว"
                      : "เช็คชื่อสำเร็จ!"}
                  </p>
                  <p className="text-sm text-gray-500">{qrScanMessage}</p>
                </div>
              ) : qrScanResult === "error" ? (
                // Error state
                <div className="flex flex-col items-center gap-4 w-full py-4">
                  <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
                    <X className="text-red-400" size={40} />
                  </div>
                  <p className="text-base font-semibold text-red-600 text-center">
                    {qrScanMessage}
                  </p>
                  <div className="flex flex-col w-full gap-2">
                    {!showPinInput && (
                      <Button
                        className="w-full bg-[#5d7c6f] text-white font-semibold"
                        startContent={<ScanLine size={18} />}
                        onPress={() => {
                          setQrScanResult(null);
                          setQrScanMessage("");
                          qrProcessingRef.current = false;
                          requestCameraAndStartScan();
                        }}
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
              ) : showPinInput ? (
                // PIN input mode
                <div className="flex flex-col items-center gap-5 w-full">
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
                    <p className="font-bold text-gray-800">กรอกรหัส PIN</p>
                    <p className="text-xs text-gray-400 text-center">
                      ขอรหัส PIN จากครูผู้ดูแลที่ค่าย
                    </p>
                  </div>
                  <input
                    className="w-60 pl-[0.35em] text-center text-gray-900 text-3xl font-black tracking-[0.35em] font-mono border-2 border-gray-200 focus:border-[#5d7c6f] rounded-xl py-3 outline-none transition-colors bg-gray-50 placeholder:text-gray-300"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]*"
                    placeholder="------"
                    type="text"
                    value={pinInput}
                    onChange={(e) =>
                      setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && pinInput.length === 6)
                        handlePinSubmit();
                    }}
                  />
                  <div className="flex flex-col w-full gap-2">
                    <Button
                      className="w-full bg-[#5d7c6f] text-white font-bold"
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
              ) : qrScanActive ? (
                // QR Scanner active
                <div className="w-full max-w-sm mx-auto">
                  <QrScanner
                    active={qrScanActive}
                    onError={(err: string) => {
                      setQrScanResult("error");
                      setQrScanMessage(err);
                      setQrScanActive(false);
                    }}
                    onScan={handleQrScan}
                  />
                  <p className="text-center text-xs text-gray-400 mt-2">
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
                // Initial state
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-24 h-24 rounded-2xl bg-[#5d7c6f]/10 flex items-center justify-center">
                    <QrCode className="text-[#5d7c6f]" size={52} />
                  </div>
                  <p className="text-base text-gray-600 text-center">
                    กดปุ่มด้านล่างเพื่อเปิดกล้องแสกน
                    <br />
                    <span className="text-sm text-gray-400">
                      QR Code ที่ครูแสดง
                    </span>
                  </p>
                  <Button
                    className="bg-[#5d7c6f] text-white font-bold px-8"
                    size="lg"
                    startContent={<ScanLine size={20} />}
                    onPress={requestCameraAndStartScan}
                  >
                    เปิดกล้องแสกน QR
                  </Button>
                  <button
                    className="text-sm text-gray-400 underline underline-offset-2 hover:text-[#5d7c6f] transition-colors"
                    onClick={() => setShowPinInput(true)}
                  >
                    หรือกรอกรหัส PIN แทน
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100">
              <Button
                fullWidth
                className="bg-gray-100 text-gray-700 font-semibold"
                onPress={() => setIsAttendanceModalOpen(false)}
              >
                ปิดหน้าต่าง
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Preview Modal */}
      {isCertPreviewModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1A202C] rounded-xl flex items-center justify-center shadow-lg shadow-gray-900/20">
                  <Award className="text-white" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900">
                    เกียรติบัตรของคุณ
                  </h2>
                  <p className="text-xs text-gray-500 font-bold">
                    สามารถดาวน์โหลดเก็บไว้เป็นไฟล์ PDF หรือ PNG
                  </p>
                </div>
              </div>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500"
                onClick={() => setIsCertPreviewModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-6 flex flex-col items-center">
              <div className="w-full bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-inner flex items-center justify-center min-h-[250px] relative p-2">
                {certPreviewUrl && (
                  <img
                    alt="Certificate Preview"
                    className={`w-full h-auto object-contain rounded-xl shadow-md transition-opacity duration-300 ${certImageLoading ? "opacity-0" : "opacity-100"}`}
                    src={certPreviewUrl}
                    onLoad={() => setCertImageLoading(false)}
                  />
                )}
                {certImageLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/50 backdrop-blur-sm z-10">
                    <LoadingSpinner size="md" />
                    <p className="text-sm font-bold text-gray-500 animate-pulse">
                      กำลังสร้างเกียรติบัตรบนอุปกรณ์ รอสักครู่....
                    </p>
                  </div>
                )}
                {certPreviewError && !certImageLoading && (
                  <p className="px-6 text-center text-sm font-bold text-red-500">
                    {certPreviewError}
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50/50">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  fullWidth
                  className="font-bold text-base h-14 rounded-2xl bg-[#5d7c6f] text-white shadow-lg shadow-[#5d7c6f]/20"
                  isDisabled={!!downloadingFormat || certImageLoading}
                  isLoading={downloadingFormat === "pdf"}
                  startContent={
                    downloadingFormat !== "pdf" && <FileText size={20} />
                  }
                  onPress={() => handleCertDownload("pdf")}
                >
                  โหลด PDF
                </Button>
                <Button
                  fullWidth
                  className="font-bold text-base h-14 rounded-2xl bg-[#1A202C] text-white shadow-lg shadow-gray-900/20"
                  isDisabled={!!downloadingFormat || certImageLoading}
                  isLoading={downloadingFormat === "png"}
                  startContent={
                    downloadingFormat !== "png" && <Download size={20} />
                  }
                  onPress={() => handleCertDownload("png")}
                >
                  โหลด PNG
                </Button>
              </div>
              <button
                className="w-full mt-4 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setIsCertPreviewModalOpen(false)}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            aria-label="ปิดภาพตัวอย่าง"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            type="button"
            onClick={() => setSelectedImage(null)}
          />
          <div className="relative z-10 max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <button
              className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors z-10"
              onClick={() => setSelectedImage(null)}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M6 18L18 6M6 6l12 12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </button>
            <img
              alt="Expanded view"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              src={selectedImage}
            />
          </div>
        </div>
      )}
      {/* Shirt Selection Modal (Auto-open after register) */}
      {isShirtSelectionModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 bg-[#5d7c6f]/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#5d7c6f] rounded-xl flex items-center justify-center shadow-lg shadow-[#5d7c6f]/20">
                  <Shirt className="text-white" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900">
                    จองเสื้อค่ายของคุณ
                  </h2>
                  <p className="text-xs text-gray-500 font-bold">
                    เลือกไซส์เสื้อเพื่อยืนยันการเข้าร่วม
                  </p>
                </div>
              </div>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-500"
                onClick={() => setIsShirtSelectionModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-6 space-y-6">
              {/* Shirt Preview Images */}
              {(() => {
                let shirtUrls: string[] = [];

                if (camp?.img_shirt_url) {
                  try {
                    const parsed = JSON.parse(camp.img_shirt_url);

                    shirtUrls = Array.isArray(parsed)
                      ? parsed.filter(Boolean)
                      : [camp.img_shirt_url];
                  } catch {
                    shirtUrls = [camp.img_shirt_url];
                  }
                }

                if (shirtUrls.length > 0) {
                  return (
                    <div
                      className={`grid gap-3 ${shirtUrls.length === 1 ? "grid-cols-1 max-w-[200px] mx-auto" : "grid-cols-2"}`}
                    >
                      {shirtUrls.map((url, idx) => (
                        <div
                          key={idx}
                          className="bg-gray-50 rounded-2xl overflow-hidden aspect-square border border-gray-200 shadow-sm"
                        >
                          <img
                            alt="Shirt Preview"
                            className="w-full h-full object-cover"
                            src={url}
                          />
                        </div>
                      ))}
                    </div>
                  );
                }

                return null;
              })()}

              <div>
                <p className="block text-sm font-black text-gray-700 mb-4 text-center">
                  กรุณาเลือกไซส์เสื้อ:
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {SHIRT_SIZES.map((size) => (
                    <button
                      key={size}
                      className={`py-4 px-2 rounded-2xl border-2 text-base font-black transition-all ${
                        selectedSize === size
                          ? "bg-[#5d7c6f] text-white border-[#5d7c6f] shadow-xl shadow-[#5d7c6f]/30 scale-105"
                          : "bg-white text-gray-700 border-gray-100 hover:border-[#5d7c6f]/30"
                      }`}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarCheck className="text-blue-600" size={14} />
                </div>
                <p className="text-xs text-blue-700 font-bold leading-relaxed">
                  คุณสามารถแก้ไขไซส์เสื้อได้ในภายหลังที่หน้าข้อมูลค่าย
                  ภายในวันที่ {formatDate(camp?.endShirtDate)}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50/50">
              <Button
                fullWidth
                className="bg-[#5d7c6f] text-white font-black text-lg h-14 rounded-2xl shadow-xl shadow-[#5d7c6f]/30"
                isDisabled={!selectedSize}
                isLoading={savingShirt}
                onPress={() => handleShirtUpdate(selectedSize)}
              >
                ยืนยันการจองเสื้อ
              </Button>
              <button
                className="w-full mt-4 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setIsShirtSelectionModalOpen(false)}
              >
                ไว้เลือกภายหลัง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
