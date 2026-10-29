"use client";

import {
  Avatar,
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Pagination,
  Select,
  SelectItem,
  Tooltip,
} from "@heroui/react";
import {
  Check,
  Clock,
  Copy,
  KeyRound,
  Search,
  Trash2,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  Users,
  UserX,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useStatusModal } from "@/components/StatusModalProvider";

type View = "active" | "requests" | "events";
type ParentAccess = {
  parentId: number;
  parentName: string;
  parentPhone: string;
  source: "PRIMARY" | "STUDENT_APPROVED" | "LEGACY";
  username?: string;
  grantedAt: string | null;
  revocable: boolean;
};
type StudentInfo = {
  studentId: number;
  studentName: string;
  studentNickname: string | null;
  studentImage: string | null;
};
type ActiveRow = StudentInfo & {
  accesses: ParentAccess[];
};
type RequestRow = StudentInfo & {
  id: number;
  parentId: number;
  parentName: string;
  parentPhone: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "REVOKED";
  requestedAt: string;
  expiresAt: string;
  respondedAt: string | null;
};
type EventRow = StudentInfo & {
  id: number;
  parentId: number;
  parentName: string;
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
  PASSWORD_RESET: "รีเซ็ตรหัสผ่านผู้ปกครอง",
};

type Summary = {
  totalStudents: number;
  linkedStudents: number;
  unlinkedStudents: number;
  pendingRequests: number;
  totalParents: number;
};

const viewTitles: Record<View, string> = {
  active: "สถานะการผูก",
  requests: "คำขอผูกบัญชี",
  events: "ประวัติการดำเนินการ",
};
// [หัวคอลัมน์, ความกว้าง, การจัดชิด]
const tableColumns: Record<View, [string, string, "right"?][]> = {
  active: [
    ["นักเรียน", "w-[30%]"],
    ["ผู้ปกครองที่ดูข้อมูลได้", "w-[32%]"],
    ["ประเภทสิทธิ์", "w-[26%]"],
    ["ดำเนินการ", "w-[12%]", "right"],
  ],
  requests: [
    ["นักเรียน", "w-[30%]"],
    ["ผู้ขอสิทธิ์", "w-[30%]"],
    ["สถานะ", "w-[17%]"],
    ["วันที่", "w-[23%]"],
  ],
  events: [
    ["นักเรียน", "w-[28%]"],
    ["ผู้ปกครอง", "w-[27%]"],
    ["เหตุการณ์", "w-[20%]"],
    ["เวลาและผู้ดำเนินการ", "w-[25%]"],
  ],
};
const rowClass =
  "border-b border-gray-100 align-top last:border-b-0 hover:bg-gray-50";
const cellClass = "px-3 py-4";

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

function MoreParentsToggle({
  expanded,
  hiddenCount,
  onToggle,
}: {
  expanded: boolean;
  hiddenCount: number;
  onToggle: () => void;
}) {
  const label = expanded
    ? "ซ่อนผู้ปกครองคนอื่น"
    : `ดูผู้ปกครองอีก ${hiddenCount} คน`;

  return (
    <Tooltip content={label}>
      <button
        aria-expanded={expanded}
        aria-label={label}
        className="inline-flex h-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-[#5d7c6f] px-2 text-[11px] leading-none font-bold text-[#3d6357] transition-colors hover:bg-[#e8f0ee]"
        type="button"
        onClick={onToggle}
      >
        {expanded ? "−" : `+${hiddenCount}`}
      </button>
    </Tooltip>
  );
}

function ParentCell({ name, phone }: { name: string; phone?: string }) {
  const displayName = displayParentName(name);

  return (
    <div>
      <p className="font-medium text-gray-800">{displayName}</p>
      {phone && <p className="mt-0.5 text-xs text-gray-500">เบอร์ {phone}</p>}
      {displayName === "ไม่มี" && (
        <p className="mt-0.5 text-xs text-amber-700">ยังไม่ได้กรอกชื่อ</p>
      )}
    </div>
  );
}

function StudentCell({ student }: { student: StudentInfo }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar
        className="h-9 w-9 shrink-0 bg-[#e8f0ee] text-sm font-medium text-[#3d6357]"
        name={(student.studentName || "?").charAt(0)}
        src={student.studentImage || undefined}
      />
      <div className="min-w-0">
        <p className="truncate font-medium text-gray-800">
          {student.studentName}
        </p>
        <p className="truncate text-xs text-gray-500">
          ชื่อเล่น: {student.studentNickname || "-"}
        </p>
        <p className="truncate text-xs text-gray-400">
          รหัสนักเรียน: {student.studentId}
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number | null;
  note: string;
  tone: string;
}) {
  return (
    <Card className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <CardBody className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-500">{label}</p>
            {value === null ? (
              <div className="mt-3 h-8 w-16 animate-pulse rounded bg-gray-200" />
            ) : (
              <p className="mt-2 text-3xl font-bold text-gray-800">
                {value.toLocaleString("th-TH")}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">{note}</p>
          </div>
          <span className={`shrink-0 rounded-2xl p-3 ${tone}`}>
            <Icon size={22} />
          </span>
        </div>
      </CardBody>
    </Card>
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
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.source === "STUDENT_APPROVED" ? "bg-[#e8f0ee] text-[#3d6357]" : "bg-gray-100 text-gray-700"}`}
      >
        {label}
      </span>
      {row.username && (
        <p className="mt-1.5 text-xs text-gray-500">
          ชื่อผู้ใช้ {row.username}
        </p>
      )}
      {row.grantedAt && (
        <p className="mt-1.5 text-xs text-gray-500">
          เริ่ม {formatDate(row.grantedAt)}
        </p>
      )}
    </div>
  );
}

export default function ParentAccessManager() {
  const {
    close: closeStatusModal,
    showConfirm,
    showError,
    showSuccess,
  } = useStatusModal();
  const [view, setView] = useState<View>("active");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<(ActiveRow | RequestRow | EventRow)[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Students whose additional parents are shown; others show only the first.
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(
    () => new Set(),
  );
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [createdAccount, setCreatedAccount] = useState<{
    kind: "created" | "reset";
    studentName: string;
    username: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(
        () => setCopied((current) => (current === key ? null : current)),
        1500,
      );
    } catch {
      showError("คัดลอกไม่สำเร็จ", "กรุณาเลือกข้อความแล้วคัดลอกเอง");
    }
  }

  const loadSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/parent-links?view=summary", {
        cache: "no-store",
      });

      if (response.ok) setSummary(await response.json());
    } catch {
      // การ์ดสรุปไม่ใช่ข้อมูลหลัก โหลดไม่ได้ก็ปล่อยเป็นโครงไว้
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

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
      setPageSize(data.pageSize ?? 10);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = query.trim();

      if (next === search) return;
      setPage(1);
      setSearch(next);
    }, 400);

    return () => clearTimeout(timer);
  }, [query, search]);

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
          await Promise.all([refresh(), loadSummary()]);
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

  function resetPassword(row: ActiveRow, access: ParentAccess) {
    if (busy) return;

    showConfirm(
      "รีเซ็ตรหัสผ่านผู้ปกครอง",
      `ตั้งรหัสผ่านใหม่ให้บัญชี ${access.username ?? access.parentName} ของ ${row.studentName} รหัสเดิมจะใช้ไม่ได้และอุปกรณ์ที่เข้าสู่ระบบอยู่จะถูกออกจากระบบ ยืนยันหรือไม่?`,
      async () => {
        setBusy(true);
        setError("");
        try {
          const response = await fetch(
            "/api/admin/parent-links/reset-password",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ parentId: access.parentId }),
            },
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
          }
          // The confirm dialog stays open until something replaces it.
          closeStatusModal();
          setCopied(null);
          setCreatedAccount({
            kind: "reset",
            studentName: row.studentName,
            username: data.username,
            password: data.password,
          });
        } catch (reason) {
          showError(
            "รีเซ็ตรหัสผ่านไม่สำเร็จ",
            reason instanceof Error ? reason.message : "กรุณาลองใหม่อีกครั้ง",
          );
        } finally {
          setBusy(false);
        }
      },
      "รีเซ็ตรหัสผ่าน",
    );
  }

  function createAccount(row: ActiveRow) {
    if (busy) return;

    const hasAccount = row.accesses.some(
      (access) => access.source === "PRIMARY",
    );

    showConfirm(
      "สร้างบัญชีผู้ปกครองเพิ่ม",
      `สร้างบัญชีผู้ปกครองใหม่ให้ ${row.studentName} ${hasAccount ? "อีก 1 บัญชี " : ""}รหัสผ่านเริ่มต้นคือ kks${row.studentId} และผู้ปกครองต้องเปลี่ยนรหัสเมื่อเข้าสู่ระบบครั้งแรก ยืนยันหรือไม่?`,
      async () => {
        setBusy(true);
        setError("");
        try {
          const response = await fetch("/api/admin/parent-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId: row.studentId }),
          });
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "สร้างบัญชีไม่สำเร็จ");
          }
          // The confirm dialog stays open until something replaces it.
          closeStatusModal();
          setCopied(null);
          setCreatedAccount({
            kind: "created",
            studentName: row.studentName,
            username: data.username,
            password: data.initialPassword,
          });
          await Promise.all([refresh(), loadSummary()]);
        } catch (reason) {
          showError(
            "สร้างบัญชีไม่สำเร็จ",
            reason instanceof Error ? reason.message : "กรุณาลองใหม่อีกครั้ง",
          );
        } finally {
          setBusy(false);
        }
      },
      "สร้างบัญชี",
    );
  }

  const passwordLabel =
    createdAccount?.kind === "reset" ? "รหัสผ่านใหม่" : "รหัสผ่านเริ่มต้น";
  const passwordNote =
    createdAccount?.kind === "reset"
      ? "รหัสนี้แสดงครั้งเดียว กรุณาคัดลอกส่งให้ผู้ปกครอง ผู้ปกครองจะต้องตั้งรหัสผ่านใหม่เมื่อเข้าสู่ระบบ"
      : "ผู้ปกครองต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก";

  const createAccountButton = (row: ActiveRow) => (
    <Tooltip content="สร้างบัญชีผู้ปกครองเพิ่ม">
      <button
        aria-label="สร้างบัญชีผู้ปกครองเพิ่ม"
        className="inline-flex cursor-pointer items-center text-[#5d7c6f] transition-colors hover:text-[#3d6357] active:opacity-50 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={busy}
        type="button"
        onClick={() => createAccount(row)}
      >
        <UserPlus size={18} />
      </button>
    </Tooltip>
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columns = tableColumns[view];

  return (
    <div className="flex w-full flex-col gap-6 pt-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon={UserRoundCheck}
          label="นักเรียนที่ผูกแล้ว"
          note={
            summary
              ? `จากนักเรียนทั้งหมด ${summary.totalStudents.toLocaleString("th-TH")} คน`
              : "มีผู้ปกครองดูข้อมูลได้"
          }
          tone="bg-[#e8f0ee] text-[#3d6357]"
          value={summary?.linkedStudents ?? null}
        />
        <SummaryCard
          icon={UserRoundX}
          label="ยังไม่ผูกผู้ปกครอง"
          note="ยังไม่มีผู้ปกครองดูข้อมูลได้"
          tone="bg-amber-50 text-amber-700"
          value={summary?.unlinkedStudents ?? null}
        />
        <SummaryCard
          icon={Clock}
          label="คำขอรอยืนยัน"
          note="รอนักเรียนกดยืนยัน"
          tone="bg-sky-50 text-sky-700"
          value={summary?.pendingRequests ?? null}
        />
        <SummaryCard
          icon={Users}
          label="บัญชีผู้ปกครอง"
          note="บัญชีที่สมัครในระบบ"
          tone="bg-violet-50 text-violet-700"
          value={summary?.totalParents ?? null}
        />
      </section>

      <Card
        className="rounded-2xl border border-gray-100 bg-white shadow-sm"
        radius="none"
      >
        <CardBody className="p-4 md:p-6">
          <div className="mb-6 flex flex-col gap-4">
            {/* Top Row: Title */}
            <div className="flex flex-col items-start justify-between gap-4 xl:flex-row xl:items-center">
              <div>
                <h2 className="text-[30px] font-semibold text-gray-800">
                  {viewTitles[view]}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {view === "active"
                    ? "ผูกโดยตรง = บัญชีผู้ปกครองที่เชื่อมกับรหัสนักเรียน · นักเรียนยืนยันแล้ว = ผ่านคำขอ"
                    : view === "requests"
                      ? "คำขอที่ผู้ปกครองส่งมาเพื่อดูข้อมูลนักเรียน ซึ่งนักเรียนต้องเป็นผู้ยืนยัน"
                      : "บันทึกการเปลี่ยนแปลงสิทธิ์ทั้งหมด"}
                </p>
              </div>
            </div>

            {/* Bottom Row: Search & Filters */}
            <div className="flex w-full items-center gap-3">
              {/* แสดงช่องค้นหาตลอด (ปิดไว้ในมุมมองประวัติ) ดรอปดาวน์จะได้ไม่ขยับ */}
              <div className="min-w-0 flex-1 sm:max-w-2xl">
                <Input
                  isClearable
                  aria-label="ค้นหาผู้ปกครองหรือนักเรียน"
                  classNames={{ inputWrapper: "bg-white border-gray-200" }}
                  isDisabled={view === "events"}
                  placeholder={
                    view === "events"
                      ? "ประวัติการดำเนินการค้นหาไม่ได้"
                      : "ค้นหาชื่อ ชื่อเล่น รหัสนักเรียน หรือเบอร์ผู้ปกครอง..."
                  }
                  size="sm"
                  startContent={<Search className="text-gray-400" size={14} />}
                  value={view === "events" ? "" : query}
                  onClear={() => setQuery("")}
                  onValueChange={setQuery}
                />
              </div>
              <div className="w-40 shrink-0 sm:w-80">
                <Select
                  disallowEmptySelection
                  aria-label="ประเภทข้อมูลสิทธิ์ผู้ปกครอง"
                  selectedKeys={new Set([view])}
                  size="sm"
                  onChange={(event) => {
                    const key = event.target.value as View;

                    if (!key || key === view) return;
                    // ล้างข้อมูลแท็บเดิมก่อน กันตารางใหม่ render ด้วย rows คนละรูปแบบ
                    setRows([]);
                    setLoading(true);
                    setView(key);
                    setPage(1);
                  }}
                >
                  {(Object.keys(viewTitles) as View[]).map((key) => (
                    <SelectItem
                      key={key}
                      textValue={`แสดง: ${viewTitles[key]}`}
                    >
                      {viewTitles[key]}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {error && (
            <p aria-live="polite" className="mb-4 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[820px] table-fixed overflow-hidden rounded-xl border border-gray-100 text-left text-sm">
              <thead>
                <tr>
                  {columns.map(([label, width, align]) => (
                    <th
                      key={label}
                      className={`${width} border-b border-gray-100 bg-gray-50/50 px-3 py-4 text-xs font-semibold text-gray-800 ${align === "right" ? "text-right" : ""}`}
                      scope="col"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 6 }, (_, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      {columns.map(([label]) => (
                        <td key={label} className="px-3 py-5">
                          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td
                      className="px-3 py-10 text-center text-sm text-gray-500"
                      colSpan={columns.length}
                    >
                      ไม่มีรายการ
                      {search && view !== "events"
                        ? "ที่ตรงกับคำค้นหา"
                        : "ในขณะนี้"}
                    </td>
                  </tr>
                )}

                {!loading &&
                  view === "active" &&
                  (rows as ActiveRow[]).map((row) =>
                    row.accesses.length === 0 ? (
                      <tr key={row.studentId} className={rowClass}>
                        <td className={cellClass}>
                          <StudentCell student={row} />
                        </td>
                        <td
                          className={`${cellClass} font-medium text-amber-700`}
                        >
                          ยังไม่ได้ผูกกับผู้ปกครอง
                        </td>
                        <td className={`${cellClass} text-gray-400`}>—</td>
                        <td className={`${cellClass} text-right`}>
                          {createAccountButton(row)}
                        </td>
                      </tr>
                    ) : (
                      (expandedStudents.has(row.studentId)
                        ? row.accesses
                        : row.accesses.slice(0, 1)
                      ).map((access, index, visible) => (
                        <tr
                          key={`${row.studentId}:${access.parentId}:${access.source}`}
                          className={rowClass}
                        >
                          {index === 0 && (
                            <td className={cellClass} rowSpan={visible.length}>
                              <StudentCell student={row} />
                            </td>
                          )}
                          <td className={cellClass}>
                            <div className="flex items-start gap-2">
                              <ParentCell
                                name={access.parentName}
                                phone={access.parentPhone}
                              />
                              {index === 0 && row.accesses.length > 1 && (
                                <MoreParentsToggle
                                  expanded={expandedStudents.has(row.studentId)}
                                  hiddenCount={row.accesses.length - 1}
                                  onToggle={() =>
                                    setExpandedStudents((current) => {
                                      const next = new Set(current);

                                      if (!next.delete(row.studentId)) {
                                        next.add(row.studentId);
                                      }

                                      return next;
                                    })
                                  }
                                />
                              )}
                            </div>
                          </td>
                          <td className={cellClass}>
                            <SourceCell row={access} />
                          </td>
                          <td className={`${cellClass} text-right`}>
                            <div className="inline-flex items-center gap-3">
                              {index === 0 && createAccountButton(row)}
                              {access.source === "PRIMARY" && (
                                <Tooltip content="รีเซ็ตรหัสผ่าน">
                                  <button
                                    aria-label="รีเซ็ตรหัสผ่าน"
                                    className="inline-flex cursor-pointer items-center text-[#5d7c6f] transition-colors hover:text-[#3d6357] active:opacity-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    disabled={busy}
                                    type="button"
                                    onClick={() => resetPassword(row, access)}
                                  >
                                    <KeyRound size={18} />
                                  </button>
                                </Tooltip>
                              )}
                              {access.revocable ? (
                                <Tooltip
                                  color="danger"
                                  content={
                                    access.source === "PRIMARY"
                                      ? "ลบบัญชีผู้ปกครอง"
                                      : "เพิกถอนสิทธิ์"
                                  }
                                >
                                  <button
                                    aria-label={
                                      access.source === "PRIMARY"
                                        ? "ลบบัญชีผู้ปกครอง"
                                        : "เพิกถอนสิทธิ์"
                                    }
                                    className="inline-flex cursor-pointer items-center text-[#E84A5F] transition-colors hover:text-[#FF847C] active:opacity-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    disabled={busy}
                                    type="button"
                                    onClick={() => revoke(row, access)}
                                  >
                                    {access.source === "PRIMARY" ? (
                                      <Trash2 size={18} />
                                    ) : (
                                      <UserX size={18} />
                                    )}
                                  </button>
                                </Tooltip>
                              ) : (
                                index !== 0 && (
                                  <span className="text-gray-400">—</span>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ),
                  )}

                {!loading &&
                  view === "requests" &&
                  (rows as RequestRow[]).map((row) => (
                    <tr key={row.id} className={rowClass}>
                      <td className={cellClass}>
                        <StudentCell student={row} />
                      </td>
                      <td className={cellClass}>
                        <ParentCell
                          name={row.parentName}
                          phone={row.parentPhone}
                        />
                      </td>
                      <td className={cellClass}>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === "PENDING" ? "bg-amber-50 text-amber-800" : row.status === "APPROVED" ? "bg-[#e8f0ee] text-[#3d6357]" : "bg-gray-100 text-gray-700"}`}
                        >
                          {statusLabels[row.status]}
                        </span>
                      </td>
                      <td className={`${cellClass} text-xs text-gray-500`}>
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

                {!loading &&
                  view === "events" &&
                  (rows as EventRow[]).map((row) => (
                    <tr key={row.id} className={rowClass}>
                      <td className={cellClass}>
                        <StudentCell student={row} />
                      </td>
                      <td className={cellClass}>
                        <ParentCell name={row.parentName} />
                      </td>
                      <td className={`${cellClass} font-medium text-gray-800`}>
                        {eventLabels[row.action] ?? row.action}
                      </td>
                      <td className={`${cellClass} text-xs text-gray-500`}>
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
          </div>

          <div className="relative mt-6 flex w-full flex-col items-center gap-4 px-2 md:flex-row">
            <p className="order-2 text-sm text-gray-500 md:absolute md:left-2 md:order-1">
              {loading
                ? "กำลังโหลด..."
                : `แสดง ${rows.length} จาก ${total} ${view === "active" ? "คน" : "รายการ"}`}
            </p>
            <div className="order-1 flex w-full flex-1 justify-center md:order-2">
              {total > 0 && (
                <Pagination
                  isCompact
                  showControls
                  showShadow
                  classNames={{ cursor: "bg-sage text-white font-medium" }}
                  color="default"
                  isDisabled={loading}
                  page={page}
                  total={totalPages}
                  onChange={(newPage) => {
                    setPage(newPage);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              )}
            </div>
          </div>
        </CardBody>
      </Card>
      <Modal
        isOpen={createdAccount !== null}
        onOpenChange={(open) => {
          if (!open) setCreatedAccount(null);
        }}
      >
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {createdAccount?.kind === "reset"
                  ? "รีเซ็ตรหัสผ่านแล้ว"
                  : "สร้างบัญชีผู้ปกครองแล้ว"}
                <span className="text-sm font-normal text-gray-500">
                  {createdAccount?.studentName}
                </span>
              </ModalHeader>
              <ModalBody className="gap-3">
                {(
                  [
                    ["username", "ชื่อผู้ใช้", createdAccount?.username ?? ""],
                    ["password", passwordLabel, createdAccount?.password ?? ""],
                  ] as const
                ).map(([key, label, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#f5f5f2] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="select-all font-mono text-base font-semibold text-gray-800">
                        {value}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      startContent={
                        copied === key ? (
                          <Check size={15} />
                        ) : (
                          <Copy size={15} />
                        )
                      }
                      variant="flat"
                      onPress={() => void copyText(key, value)}
                    >
                      {copied === key ? "คัดลอกแล้ว" : "คัดลอก"}
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-gray-500">{passwordNote}</p>
              </ModalBody>
              <ModalFooter>
                <Button
                  startContent={
                    copied === "both" ? <Check size={15} /> : <Copy size={15} />
                  }
                  variant="flat"
                  onPress={() =>
                    void copyText(
                      "both",
                      `ชื่อผู้ใช้: ${createdAccount?.username}\n${passwordLabel}: ${createdAccount?.password}\n(${passwordNote})`,
                    )
                  }
                >
                  {copied === "both" ? "คัดลอกแล้ว" : "คัดลอกทั้งหมด"}
                </Button>
                <Button className="bg-[#5d7c6f] text-white" onPress={close}>
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
