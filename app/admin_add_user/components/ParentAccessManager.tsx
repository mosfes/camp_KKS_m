"use client";

import { useCallback, useEffect, useState } from "react";

import { useStatusModal } from "@/components/StatusModalProvider";

type View = "active" | "requests" | "events";
type ParentAccess = {
  parentId: number;
  parentName: string;
  parentPhone: string;
  source: "PRIMARY" | "STUDENT_APPROVED" | "LEGACY";
  grantedAt: string | null;
  revocable: boolean;
};
type ActiveRow = {
  studentId: number;
  studentName: string;
  accesses: ParentAccess[];
};
type RequestRow = {
  id: number;
  parentId: number;
  parentName: string;
  parentPhone: string;
  studentId: number;
  studentName: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "REVOKED";
  requestedAt: string;
  expiresAt: string;
  respondedAt: string | null;
};
type EventRow = {
  id: number;
  parentId: number;
  parentName: string;
  studentId: number;
  studentName: string;
  action: string;
  actorType: string;
  actorId: number;
  createdAt: string;
};

const statusLabels: Record<RequestRow["status"], string> = {
  PENDING: "รอนักเรียนยืนยัน",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธแล้ว",
  EXPIRED: "หมดอายุ",
  REVOKED: "เพิกถอนแล้ว",
};
const eventLabels: Record<string, string> = {
  REQUESTED: "ส่งคำขอ",
  APPROVED: "นักเรียนยืนยัน",
  REJECTED: "นักเรียนปฏิเสธ",
  REVOKED: "เพิกถอนสิทธิ์",
  ACCOUNT_DELETED: "ลบบัญชีผู้ปกครอง",
  ACCOUNT_CREATED: "สร้างบัญชีผู้ปกครองใหม่",
};

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Bangkok",
      })
    : "—";
}

function displayParentName(name: string) {
  const knownParts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part !== "รอระบุ");

  return knownParts.join(" ") || "ไม่มี";
}

function ParentCell({ name, phone }: { name: string; phone?: string }) {
  const displayName = displayParentName(name);

  return (
    <div>
      <p className="font-semibold text-gray-900">{displayName}</p>
      {phone && <p className="mt-0.5 text-xs text-gray-500">เบอร์ {phone}</p>}
      {displayName === "ไม่มี" && (
        <p className="mt-0.5 text-xs text-amber-700">ยังไม่ได้กรอกชื่อ</p>
      )}
    </div>
  );
}

function StudentCell({ name, id }: { name: string; id: number }) {
  return (
    <div>
      <p className="font-semibold text-gray-900">{name}</p>
      <p className="mt-0.5 text-xs text-gray-500">รหัสนักเรียน #{id}</p>
    </div>
  );
}

function SourceCell({ row }: { row: ParentAccess }) {
  const label =
    row.source === "PRIMARY"
      ? "ผูกโดยตรง"
      : row.source === "LEGACY"
        ? "สิทธิ์เดิม"
        : "นักเรียนยืนยันแล้ว";

  return (
    <div>
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.source === "STUDENT_APPROVED" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700"}`}
      >
        {label}
      </span>
      {row.grantedAt && (
        <p className="mt-1.5 text-xs text-gray-500">
          เริ่ม {formatDate(row.grantedAt)}
        </p>
      )}
    </div>
  );
}

export default function ParentAccessManager() {
  const { showConfirm, showError, showSuccess } = useStatusModal();
  const [view, setView] = useState<View>("active");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<(ActiveRow | RequestRow | EventRow)[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ view, page: String(page) });

      if (search && view !== "events") params.set("search", search);
      const response = await fetch(`/api/admin/parent-links?${params}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setPageSize(data.pageSize ?? 30);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, view]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function revoke(row: ActiveRow, access: ParentAccess) {
    if (busy) return;

    const isPrimary = access.source === "PRIMARY";
    const parentName = displayParentName(access.parentName);
    const parentLabel =
      parentName === "ไม่มี" ? "ผู้ปกครองรายนี้" : `ผู้ปกครอง ${parentName}`;
    const phoneLabel = access.parentPhone
      ? ` (เบอร์ ${access.parentPhone})`
      : "";

    showConfirm(
      isPrimary ? "ลบบัญชีผู้ปกครอง" : "เพิกถอนสิทธิ์",
      isPrimary
        ? `${parentLabel}${phoneLabel} ผูกกับ ${row.studentName} โดยตรง การลบบัญชีจะยกเลิกสิทธิ์ดูนักเรียนทุกคนที่ผูกกับบัญชีนี้ และบัญชีจะเข้าสู่ระบบไม่ได้อีก ยืนยันหรือไม่?`
        : `${parentLabel}${phoneLabel} จะไม่สามารถดูข้อมูลของ ${row.studentName} ได้อีก ยืนยันการเพิกถอนหรือไม่?`,
      async () => {
        setBusy(true);
        setError("");
        try {
          const response = await fetch("/api/admin/parent-links", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              parentId: access.parentId,
              studentId: row.studentId,
              source: access.source,
            }),
          });
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "เพิกถอนสิทธิ์ไม่สำเร็จ");
          }
          showSuccess(
            isPrimary ? "ลบบัญชีผู้ปกครองแล้ว" : "เพิกถอนสิทธิ์แล้ว",
            isPrimary
              ? `บัญชีผู้ปกครองของ ${row.studentName} ถูกลบและยกเลิกสิทธิ์ทั้งหมดแล้ว`
              : `ผู้ปกครองรายนี้จะไม่เห็นข้อมูลของ ${row.studentName} อีก`,
          );
          await refresh();
        } catch (reason) {
          showError(
            "เพิกถอนสิทธิ์ไม่สำเร็จ",
            reason instanceof Error ? reason.message : "กรุณาลองใหม่อีกครั้ง",
          );
        } finally {
          setBusy(false);
        }
      },
      isPrimary ? "ลบบัญชี" : "เพิกถอน",
    );
  }

  return (
    <section className="space-y-5">
      <div
        aria-label="ประเภทข้อมูลสิทธิ์ผู้ปกครอง"
        className="flex flex-wrap gap-2"
        role="group"
      >
        {(
          [
            ["active", "สถานะการผูก"],
            ["requests", "คำขอทั้งหมด"],
            ["events", "ประวัติการดำเนินการ"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={view === key}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${view === key ? "bg-[#5d7c6f] text-white" : "border border-gray-200 bg-white text-gray-700"}`}
            type="button"
            onClick={() => {
              setView(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {view !== "events" && (
        <form
          className="flex max-w-xl gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(query.trim());
          }}
        >
          <input
            aria-label="ค้นหาผู้ปกครองหรือนักเรียน"
            className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm"
            placeholder="ชื่อ รหัสนักเรียน หรือเบอร์ผู้ปกครอง"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            className="rounded-xl bg-[#5d7c6f] px-4 py-2 text-sm font-semibold text-white"
            type="submit"
          >
            ค้นหา
          </button>
        </form>
      )}

      {error && (
        <p aria-live="polite" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="space-y-1 text-sm text-gray-600">
        <p>
          {loading
            ? "กำลังโหลด..."
            : `ทั้งหมด ${total} ${view === "active" ? "คน" : "รายการ"}`}
        </p>
        {view === "active" && (
          <p className="text-xs text-gray-500">
            ผูกโดยตรง = บัญชีผู้ปกครองที่เชื่อมกับรหัสนักเรียน ·
            นักเรียนยืนยันแล้ว = ผ่านคำขอ
          </p>
        )}
      </div>

      {!loading && rows.length === 0 && (
        <p className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
          ไม่มีรายการ
          {search && view !== "events" ? "ที่ตรงกับคำค้นหา" : "ในขณะนี้"}
        </p>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          {view === "active" && (
            <table className="w-full min-w-[820px] table-fixed text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
                <tr>
                  <th className="w-[27%] px-4 py-3" scope="col">
                    นักเรียน
                  </th>
                  <th className="w-[32%] px-4 py-3" scope="col">
                    ผู้ปกครองที่ดูข้อมูลได้
                  </th>
                  <th className="w-[27%] px-4 py-3" scope="col">
                    ประเภทสิทธิ์
                  </th>
                  <th className="w-[14%] px-4 py-3 text-right" scope="col">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(rows as ActiveRow[]).map((row) =>
                  row.accesses.length === 0 ? (
                    <tr
                      key={row.studentId}
                      className="align-top hover:bg-gray-50/70"
                    >
                      <td className="px-4 py-4">
                        <StudentCell
                          id={row.studentId}
                          name={row.studentName}
                        />
                      </td>
                      <td className="px-4 py-4 font-medium text-amber-800">
                        ยังไม่ได้ผูกกับผู้ปกครอง
                      </td>
                      <td className="px-4 py-4 text-gray-400">—</td>
                      <td className="px-4 py-4 text-right text-gray-400">—</td>
                    </tr>
                  ) : (
                    row.accesses.map((access, index) => (
                      <tr
                        key={`${row.studentId}:${access.parentId}:${access.source}`}
                        className="align-top hover:bg-gray-50/70"
                      >
                        {index === 0 && (
                          <td
                            className="px-4 py-4"
                            rowSpan={row.accesses.length}
                          >
                            <StudentCell
                              id={row.studentId}
                              name={row.studentName}
                            />
                          </td>
                        )}
                        <td className="px-4 py-4">
                          <ParentCell
                            name={access.parentName}
                            phone={access.parentPhone}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <SourceCell row={access} />
                        </td>
                        <td className="px-4 py-4 text-right">
                          {access.revocable ? (
                            <button
                              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={busy}
                              type="button"
                              onClick={() => revoke(row, access)}
                            >
                              {access.source === "PRIMARY"
                                ? "ลบบัญชี"
                                : "เพิกถอน"}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">ไม่มี</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ),
                )}
              </tbody>
            </table>
          )}

          {view === "requests" && (
            <table className="w-full min-w-[760px] table-fixed text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
                <tr>
                  <th className="w-[27%] px-4 py-3" scope="col">
                    นักเรียน
                  </th>
                  <th className="w-[30%] px-4 py-3" scope="col">
                    ผู้ขอสิทธิ์
                  </th>
                  <th className="w-[18%] px-4 py-3" scope="col">
                    สถานะ
                  </th>
                  <th className="w-[25%] px-4 py-3" scope="col">
                    วันที่
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(rows as RequestRow[]).map((row) => (
                  <tr key={row.id} className="align-top hover:bg-gray-50/70">
                    <td className="px-4 py-4">
                      <StudentCell id={row.studentId} name={row.studentName} />
                    </td>
                    <td className="px-4 py-4">
                      <ParentCell
                        name={row.parentName}
                        phone={row.parentPhone}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === "PENDING" ? "bg-amber-50 text-amber-800" : row.status === "APPROVED" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700"}`}
                      >
                        {statusLabels[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-600">
                      <p>ขอเมื่อ {formatDate(row.requestedAt)}</p>
                      {row.respondedAt && (
                        <p className="mt-1">
                          ตอบเมื่อ {formatDate(row.respondedAt)}
                        </p>
                      )}
                      {row.status === "PENDING" && (
                        <p className="mt-1">
                          หมดอายุ {formatDate(row.expiresAt)}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {view === "events" && (
            <table className="w-full min-w-[760px] table-fixed text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
                <tr>
                  <th className="w-[25%] px-4 py-3" scope="col">
                    นักเรียน
                  </th>
                  <th className="w-[27%] px-4 py-3" scope="col">
                    ผู้ปกครอง
                  </th>
                  <th className="w-[23%] px-4 py-3" scope="col">
                    เหตุการณ์
                  </th>
                  <th className="w-[25%] px-4 py-3" scope="col">
                    เวลาและผู้ดำเนินการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(rows as EventRow[]).map((row) => (
                  <tr key={row.id} className="align-top hover:bg-gray-50/70">
                    <td className="px-4 py-4">
                      <StudentCell id={row.studentId} name={row.studentName} />
                    </td>
                    <td className="px-4 py-4">
                      <ParentCell name={row.parentName} />
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-800">
                      {eventLabels[row.action] ?? row.action}
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-600">
                      <p>{formatDate(row.createdAt)}</p>
                      <p className="mt-1">
                        {row.actorType === "STUDENT"
                          ? "นักเรียน"
                          : row.actorType === "ADMIN"
                            ? "แอดมิน"
                            : row.actorType === "SYSTEM"
                              ? "ระบบ"
                              : "ผู้ปกครอง"}{" "}
                        #{row.actorId}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
            disabled={page <= 1 || loading}
            type="button"
            onClick={() => setPage((value) => value - 1)}
          >
            ก่อนหน้า
          </button>
          <span className="text-sm text-gray-600">
            หน้า {page} / {Math.ceil(total / pageSize)}
          </span>
          <button
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
            disabled={page >= Math.ceil(total / pageSize) || loading}
            type="button"
            onClick={() => setPage((value) => value + 1)}
          >
            ถัดไป
          </button>
        </div>
      )}
    </section>
  );
}
