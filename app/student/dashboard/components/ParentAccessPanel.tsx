"use client";

import { useCallback, useEffect, useState } from "react";

type PendingRequest = {
  id: number;
  parentName: string;
  parentPhone: string;
  requestedAt: string;
  expiresAt: string;
};

type ActiveParent = {
  parentId: number;
  parentName: string;
  parentPhone: string;
  source: "PRIMARY" | "STUDENT_APPROVED" | "LEGACY";
  revocable: boolean;
};

function displayParentName(name: string) {
  const knownParts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part !== "รอระบุ");

  return knownParts.join(" ") || "ยังไม่ระบุชื่อผู้ปกครอง";
}

export default function ParentAccessPanel() {
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [active, setActive] = useState<ActiveParent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/student/parent-links", {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok)
      throw new Error(data.error || "โหลดข้อมูลผู้ปกครองไม่สำเร็จ");
    setPending(data.pending ?? []);
    setActive(data.active ?? []);
  }, []);

  useEffect(() => {
    void refresh()
      .catch(() => setError("โหลดข้อมูลผู้ปกครองไม่สำเร็จ"))
      .finally(() => setLoaded(true));
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void refresh().catch(() => {});
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible")
        void refresh().catch(() => {});
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  async function decide(id: number, decision: "approve" | "reject") {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/student/parent-link-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
      await refresh();
      setNotice(
        decision === "approve"
          ? "อนุญาตให้ผู้ปกครองดูข้อมูลแล้ว"
          : "ปฏิเสธคำขอแล้ว",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(parentId: number) {
    if (busy || !window.confirm("เพิกถอนสิทธิ์ผู้ปกครองรายนี้หรือไม่?")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/student/parent-links/${parentId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "เพิกถอนสิทธิ์ไม่สำเร็จ");
      await refresh();
      setNotice("เพิกถอนสิทธิ์แล้ว");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "เพิกถอนสิทธิ์ไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }

  // Keep checking for new requests, but only show the dashboard card while
  // the student has a decision to make.
  if (pending.length === 0) return null;

  return (
    <section
      aria-labelledby="parent-access-heading"
      className="rounded-3xl border border-[#dfe9e0] bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2
            className="text-lg font-semibold text-[#24382e]"
            id="parent-access-heading"
          >
            ผู้ปกครองที่ดูข้อมูลของฉัน
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            ตรวจสอบและจัดการคำขอเข้าดูข้อมูลของคุณ
          </p>
        </div>
        {pending.length > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            รอยืนยัน {pending.length} คำขอ
          </span>
        )}
      </div>

      {pending.length > 0 && (
        <div className="mt-5 space-y-3">
          {pending.map((request) => (
            <div
              key={request.id}
              className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
            >
              <p className="text-sm font-semibold text-gray-900">
                {displayParentName(request.parentName)} ขอเข้าดูข้อมูลของคุณ
              </p>
              <p className="mt-1 text-xs text-gray-600">
                {request.parentPhone && (
                  <>เบอร์ติดต่อ {request.parentPhone} · </>
                )}
                หมดอายุ{" "}
                {new Date(request.expiresAt).toLocaleDateString("th-TH", {
                  timeZone: "Asia/Bangkok",
                })}
              </p>
              <p className="mt-2 text-xs text-gray-600">
                ยืนยันเฉพาะผู้ที่คุณรู้จักและยินยอมให้ดูข้อมูลของคุณ
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  className="rounded-xl bg-[#5d7c6f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={busy}
                  type="button"
                  onClick={() => void decide(request.id, "approve")}
                >
                  ยืนยัน
                </button>
                <button
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
                  disabled={busy}
                  type="button"
                  onClick={() => void decide(request.id, "reject")}
                >
                  ปฏิเสธ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-2">
        {active.map((parent) => (
          <div
            key={parent.parentId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">
                {displayParentName(parent.parentName)}
              </p>
              <p className="text-xs text-gray-500">
                {parent.parentPhone && <>{parent.parentPhone} · </>}
                {parent.source === "PRIMARY"
                  ? "ผูกกับบัญชีผู้ปกครองโดยตรง"
                  : parent.source === "LEGACY"
                    ? "สิทธิ์เดิม"
                    : "คุณยืนยันแล้ว"}
              </p>
            </div>
            {parent.revocable ? (
              <button
                className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                disabled={busy}
                type="button"
                onClick={() => void revoke(parent.parentId)}
              >
                เพิกถอนสิทธิ์
              </button>
            ) : (
              <span className="text-xs text-gray-500">
                ผูกโดยตรง: ติดต่อผู้ดูแลระบบหากข้อมูลไม่ถูกต้อง
              </span>
            )}
          </div>
        ))}
        {!loaded && (
          <p className="text-sm text-gray-500">กำลังโหลดข้อมูลผู้ปกครอง...</p>
        )}
        {loaded && active.length === 0 && !error && (
          <p className="text-sm text-gray-500">ยังไม่ได้ผูกกับผู้ปกครอง</p>
        )}
      </div>
      {notice && (
        <p aria-live="polite" className="mt-3 text-sm text-[#365f4f]">
          {notice}
        </p>
      )}
      {error && (
        <p aria-live="polite" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
