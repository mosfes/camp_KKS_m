"use client";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Avatar,
  Select,
  SelectItem,
} from "@heroui/react";
import { Button } from "@heroui/button";
import {
  ArrowLeft,
  ArrowRightLeft,
  AlertTriangle,
  Bus,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  History,
  LogIn,
  LogOut,
  Mars,
  MapPin,
  Pencil,
  Plus,
  Search,
  Save,
  Trash2,
  UserCheck,
  UserRound,
  Users,
  Venus,
  BellRing,
  ChevronDown,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import CampBreadcrumb from "./CampBreadcrumb";

import { useStatusModal } from "@/components/StatusModalProvider";
import {
  BUS_LAYOUT_TEMPLATES,
  getBusLayoutTemplate,
} from "@/lib/camp-bus-layout-templates";
import { getCurrentDeviceLocation } from "@/lib/device-location";

type Classroom = {
  classroomId: number;
  grade: string;
  roomName: string;
  teacherName: string;
  studentCount: number;
  busId: number | null;
  busCount: number;
  assignedStudentCount: number;
  unassignedStudentCount: number;
};

type BusStatusEvent = {
  eventType: "BOARD" | "ALIGHT";
  happenedAt: string;
  tripNumber: number;
  actorType: "TEACHER" | "STUDENT";
  actorName: string;
};

type Assignment = {
  assignmentId: number;
  studentEnrollmentId: number;
  studentId: number;
  studentName: string;
  firstName: string;
  prefixName: string | null;
  nickname: string | null;
  profileImageUrl: string | null;
  positionId: number | null;
  positionLabel: string | null;
  floorNumber: number | null;
  status: "OFF_BUS" | "ON_BUS";
  participationStatus: "ACTIVE" | "NOT_TRAVELING";
  lastBoardedAt: string | null;
  lastStatusEvent: BusStatusEvent | null;
  isRegistered: boolean;
  isPendingBusAssignment?: boolean;
  sourceClassroom?: {
    grade: string;
    roomName: string;
  } | null;
};

type TeacherAssignment = {
  assignmentId: number;
  teacherId: number;
  teacherName: string;
  firstName: string;
  prefixName: string | null;
  positionId: number | null;
  positionLabel: string | null;
  floorNumber: number | null;
  status: "OFF_BUS" | "ON_BUS";
  lastBoardedAt: string | null;
  lastStatusEvent: BusStatusEvent | null;
  isCurrentTeacher: boolean;
};

type EligibleTeacher = {
  teacherId: number;
  prefixName: string | null;
  firstName: string;
  lastName: string;
  teacherName: string;
  email: string;
  assignedBus: { busId: number; busName: string } | null;
};

type UnassignedCampStudent = {
  studentEnrollmentId: number;
  studentId: number;
  studentName: string;
  firstName: string;
  prefixName: string | null;
  nickname: string | null;
  profileImageUrl: string | null;
  isRegistered: boolean;
  classroom: {
    classroomId: number;
    grade: string;
    roomName: string;
  } | null;
};

type Position = {
  positionId: number;
  rowNumber: number;
  seatIndex: number;
  label: string;
  assignmentId: number | null;
  teacherAssignmentId: number | null;
  x: number | null;
  y: number | null;
  width: number;
  height: number;
  rotation: number;
};

type LayoutDecoration = {
  elementId: number;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label: string;
  zIndex: number;
};

type PublishedLayoutTemplate = {
  templateId: number;
  name: string;
  description: string;
  status: "DRAFT" | "PUBLISHED";
  capacity: number;
  floorCount: number;
  floors: Array<{
    floorNumber: number;
    canvasColumns: number;
    canvasRows: number;
    elements: Array<{ type: string; isAssignable: boolean }>;
  }>;
};

type RowCountValue = number | "";
type StudentStatusFilter = "all" | "registered" | "unregistered";
type BusStudentStatusFilter = "all" | "on" | "off";

function StudentAvatarFallback({
  prefixName,
  size,
}: {
  prefixName: string | null;
  size: "xs" | "sm" | "md";
}) {
  const isFemale = prefixName === "เด็กหญิง" || prefixName === "นางสาว";
  const isMale = prefixName === "เด็กชาย" || prefixName === "นาย";
  const personSize = size === "xs" ? 10 : size === "sm" ? 13 : 18;
  const genderSize = size === "xs" ? 6 : size === "sm" ? 8 : 10;

  if (isFemale || isMale) {
    const GenderIcon = isFemale ? Venus : Mars;

    return (
      <span
        aria-label={isFemale ? "นักเรียนหญิง" : "นักเรียนชาย"}
        className="relative inline-flex h-full w-full items-center justify-center"
      >
        <UserRound aria-hidden="true" size={personSize} />
        <GenderIcon
          aria-hidden="true"
          className={`absolute bottom-0 right-0 rounded-full bg-white ${isFemale ? "text-rose-500" : "text-blue-500"}`}
          size={genderSize}
          strokeWidth={2.75}
        />
      </span>
    );
  }

  return (
    <UserRound
      aria-label="นักเรียน"
      size={size === "xs" ? 10 : size === "sm" ? 12 : 17}
    />
  );
}

type BusSeatOccupant = {
  firstName: string;
  secondaryName: string;
  prefixName: string | null;
  profileImageUrl?: string | null;
  accessibleName: string;
};

function seatOccupant(
  assignment: Assignment | null | undefined,
  teacher: EligibleTeacher | TeacherAssignment | null | undefined,
): BusSeatOccupant | null {
  if (assignment) {
    return {
      firstName: assignment.firstName,
      secondaryName: assignment.nickname || "นักเรียน",
      prefixName: assignment.prefixName,
      profileImageUrl: assignment.profileImageUrl,
      accessibleName: assignment.studentName,
    };
  }

  if (teacher) {
    return {
      firstName: teacher.firstName,
      secondaryName: "ครู",
      prefixName: teacher.prefixName,
      accessibleName: teacher.teacherName,
    };
  }

  return null;
}

function BusSeatCard({
  label,
  occupant,
  isOnBus = false,
  selected = false,
  disabled = false,
  compact = false,
  fillContainer = false,
  className = "",
  onSelect,
}: {
  label: string;
  occupant: BusSeatOccupant | null;
  isOnBus?: boolean;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  fillContainer?: boolean;
  className?: string;
  onSelect: () => void;
}) {
  const seatStateClass = occupant
    ? isOnBus
      ? "border-green-400 bg-green-200 text-green-900"
      : "border-yellow-300 bg-yellow-100 text-yellow-800"
    : "border-[#5f806f] bg-white text-gray-600 hover:border-[#365f4f]";

  return (
    <button
      aria-pressed={selected}
      className={`flex w-full min-w-0 flex-col overflow-hidden border text-left transition ${
        fillContainer ? "h-full" : "aspect-[3/2]"
      } ${compact ? "rounded-lg p-1" : "rounded-xl p-1.5"} ${seatStateClass} ${
        selected ? "ring-2 ring-[#365f4f] ring-offset-1" : ""
      } ${className}`}
      disabled={disabled}
      title={occupant?.accessibleName || `${label} ว่าง`}
      type="button"
      onClick={onSelect}
    >
      <span
        className={`flex w-full shrink-0 items-center justify-between gap-1 ${compact ? "h-3" : "h-4"}`}
      >
        <span
          className={`truncate font-bold text-gray-700 ${compact ? "text-[8px]" : "text-[9px]"}`}
        >
          {label}
        </span>
        {occupant && (
          <span
            className={`shrink-0 rounded-full font-semibold leading-none ${
              compact ? "px-0.5 py-px text-[6px]" : "px-1 py-0.5 text-[7px]"
            } ${
              isOnBus
                ? "bg-green-200 text-green-800"
                : "bg-yellow-200 text-yellow-800"
            }`}
          >
            {compact ? (isOnBus ? "บน" : "ลง") : isOnBus ? "บนรถ" : "ลงรถ"}
          </span>
        )}
      </span>
      {occupant ? (
        <span
          className={`mt-1 flex min-h-0 flex-1 items-center ${compact ? "gap-1" : "gap-1.5"}`}
        >
          <Avatar
            className={`shrink-0 border border-[#cbd9d3] bg-[#e8f0ee] text-[#3d6357] ${compact ? "h-4 w-4" : "h-5 w-5"}`}
            fallback={
              <StudentAvatarFallback
                prefixName={occupant.prefixName}
                size={compact ? "xs" : "sm"}
              />
            }
            src={occupant.profileImageUrl || undefined}
          />
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate font-bold leading-tight text-gray-800 ${compact ? "text-[8px]" : "text-[10px]"}`}
            >
              {occupant.firstName}
            </span>
            <span
              className={`block truncate font-semibold leading-tight text-[#46695c] ${compact ? "text-[7px]" : "text-[9px]"}`}
            >
              {occupant.secondaryName}
            </span>
          </span>
        </span>
      ) : (
        <span
          className={`flex min-h-0 flex-1 items-center justify-center font-medium ${compact ? "text-[8px]" : "text-[10px]"}`}
        >
          ว่าง
        </span>
      )}
    </button>
  );
}

type SavingAction =
  | "create"
  | "save"
  | "update"
  | "delete"
  | "status"
  | "transfer";

type TripHistoryEntry = {
  tripNumber: number;
  departedAt: string;
  parkedAt: string | null;
  departedBy: string | null;
  parkedBy: string | null;
  departedLocation: BusEventLocation | null;
  parkedLocation: BusEventLocation | null;
};

type BusEventLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type Bus = {
  busId: number;
  name: string;
  registrationPlate: string;
  floorCount: number;
  layoutTemplateId: string | number | null;
  layoutTemplateName: string | null;
  status: "PARKED" | "TRAVELING";
  lastParkedAt: string | null;
  lastDepartedAt: string | null;
  classroomId: number;
  capacity: number;
  availableCapacity: number;
  classroom: {
    classroomId: number;
    grade: string;
    roomName: string;
    teacherName: string;
  };
  floors: {
    floorId: number;
    floorNumber: number;
    rowCount: number;
    canvasColumns: number | null;
    canvasRows: number | null;
    elements: LayoutDecoration[];
    positions: Position[];
  }[];
  assignments: Assignment[];
  teacherAssignments: TeacherAssignment[];
  checkedInCount: number;
  studentCheckedInCount: number;
  teacherCheckedInCount: number;
  assignedCount: number;
  assignedStudentCount: number;
  assignedTeacherCount: number;
  unassignedSeatCount: number;
  permissions: {
    canConfigure: boolean;
    canOperate: boolean;
    canManageTeachers: boolean;
  };
};

type LiveBusStatus = {
  busId: number;
  status: "PARKED" | "TRAVELING";
  checkedInCount: number;
  studentCheckedInCount: number;
  teacherCheckedInCount: number;
  assignmentStatuses: {
    assignmentId: number;
    status: "OFF_BUS" | "ON_BUS";
    participationStatus: "ACTIVE" | "NOT_TRAVELING";
    lastBoardedAt: string | null;
    lastStatusEvent: BusStatusEvent | null;
  }[];
  teacherAssignmentStatuses: {
    assignmentId: number;
    teacherId: number;
    status: "OFF_BUS" | "ON_BUS";
    lastBoardedAt: string | null;
    lastStatusEvent: BusStatusEvent | null;
  }[];
};

interface BusManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  campId: number;
  campName?: string;
  pageMode?: boolean;
}

function BusManagementShell({
  pageMode,
  isOpen,
  onClose,
  children,
}: {
  pageMode: boolean;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (pageMode) {
    return (
      <main className="bus-checkin-theme h-full min-h-0 overflow-y-auto bg-[#f5f5f2]">
        {children}
      </main>
    );
  }

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "bg-white rounded-2xl shadow-xl max-h-[92vh]",
        backdrop: "bg-black/60 backdrop-blur-sm",
      }}
      isDismissable={true}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="5xl"
      onOpenChange={onClose}
    >
      <ModalContent className="bus-checkin-theme">{children}</ModalContent>
    </Modal>
  );
}

function gradeLabel(grade: string) {
  return grade?.startsWith("Level_")
    ? `ม.${grade.replace("Level_", "")}`
    : grade;
}

function formatEventAt(value: string | null) {
  if (!value) return "ยังไม่มีข้อมูล";

  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

function statusEventLabel(event: BusStatusEvent | null) {
  if (!event) return "ยังไม่มีประวัติการกด";

  const actor =
    event.actorType === "TEACHER"
      ? `ครู ${event.actorName} เป็นผู้กด`
      : "นักเรียนกดเอง";

  return `รอบที่ ${event.tripNumber} · ${actor} · ${formatEventAt(event.happenedAt)}`;
}

function BusEventLocationLink({
  location,
}: {
  location: BusEventLocation | null;
}) {
  const coordinates = location
    ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
    : "";

  if (!location) return null;

  return (
    <a
      className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-[#365f4f] underline decoration-[#365f4f]/30 underline-offset-2 hover:text-[#244638]"
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`}
      rel="noreferrer"
      target="_blank"
    >
      <MapPin aria-hidden="true" size={11} />
      <span>{coordinates}</span>
    </a>
  );
}

function floorLabel(floorNumber: number, floorCount: number) {
  if (floorCount <= 1) return "";
  if (floorNumber === 1) return "ชั้นล่าง";
  if (floorNumber === 2) return "ชั้นบน";

  return `ชั้น ${floorNumber}`;
}

function floorSuffix(floorNumber: number | null, floorCount: number) {
  if (!floorNumber) return "";

  const label = floorLabel(floorNumber, floorCount);

  return label ? ` · ${label}` : "";
}

function rowCountLabel(floorNumber: number, floorCount: number) {
  const label = floorLabel(floorNumber, floorCount);

  return label ? `จำนวนแถว ${label}` : "จำนวนแถว";
}

function seatGridColumnClass(seatIndex: number) {
  return ["col-start-1", "col-start-2", "col-start-4", "col-start-5"][
    seatIndex
  ];
}

function FreeformFloorCanvas({
  floor,
  renderPosition,
  compact = false,
}: {
  floor: Bus["floors"][number];
  renderPosition: (position: Position) => ReactNode;
  compact?: boolean;
}) {
  if (!floor.canvasColumns || !floor.canvasRows) return null;
  const layoutItems = [
    ...floor.elements,
    ...floor.positions.filter(
      (position): position is Position & { x: number; y: number } =>
        position.x !== null && position.y !== null,
    ),
  ];
  const occupiedLeft = layoutItems.length
    ? Math.min(...layoutItems.map((item) => item.x))
    : 0;
  const occupiedRight = layoutItems.length
    ? Math.max(...layoutItems.map((item) => item.x + item.width))
    : floor.canvasColumns;
  const occupiedTop = layoutItems.length
    ? Math.min(...layoutItems.map((item) => item.y))
    : 0;
  const occupiedBottom = layoutItems.length
    ? Math.max(...layoutItems.map((item) => item.y + item.height))
    : floor.canvasRows;
  // Keep a small, even gutter around the actual layout instead of rendering
  // every unused editor grid column. This matches the legacy bus inset while
  // preserving the relative coordinates from the drag-and-drop editor.
  const horizontalPadding = 1 / 3;
  const verticalPadding = 0.4;
  const displayLeft = Math.max(0, occupiedLeft - horizontalPadding);
  const displayRight = Math.min(
    floor.canvasColumns,
    occupiedRight + horizontalPadding,
  );
  const displayTop = Math.max(0, occupiedTop);
  const displayBottom = Math.min(
    floor.canvasRows,
    occupiedBottom + verticalPadding,
  );
  const displayCanvasColumns = Math.max(1, displayRight - displayLeft);
  const displayCanvasRows = Math.max(1, displayBottom - displayTop);
  // At the display width used below, this makes a 2x2 custom seat the same
  // visual ratio as the legacy 3:2 seat card and leaves an even row gap.
  const displayVerticalScale = 0.72;

  return (
    <div
      className={`relative mx-auto w-full overflow-hidden rounded-[2.5rem] border-4 border-[#5f806f] bg-[#fbfcfb] shadow-sm ${
        compact ? "min-w-[280px]" : "min-w-[330px]"
      }`}
    >
      <div className="pointer-events-none mx-[5%] mt-[4%] flex min-h-8 items-center justify-center rounded-2xl bg-[#deebe4] px-3 py-1.5 text-center text-[10px] font-bold text-[#365f4f] sm:min-h-10 sm:text-sm">
        ด้านหน้ารถ / คนขับ
      </div>
      <div
        className={compact ? "relative mt-3" : "relative mt-3.5"}
        style={{
          aspectRatio: `${displayCanvasColumns} / ${
            displayCanvasRows * displayVerticalScale
          }`,
        }}
      >
        {floor.elements.map((element) => (
          <div
            key={`element-${element.elementId}`}
            className="absolute flex items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-100/90 px-1 text-center text-[8px] font-semibold text-gray-600"
            style={{
              left: `${((element.x - displayLeft) / displayCanvasColumns) * 100}%`,
              top: `${((element.y - displayTop) / displayCanvasRows) * 100}%`,
              width: `${(element.width / displayCanvasColumns) * 100}%`,
              height: `${(element.height / displayCanvasRows) * 100}%`,
              transform: `rotate(${element.rotation}deg)`,
              zIndex: element.zIndex,
            }}
            title={element.label}
          >
            {element.label}
          </div>
        ))}
        {floor.positions.map((position) => {
          if (position.x === null || position.y === null) return null;

          return (
            <div
              key={`position-${position.positionId}`}
              className={`absolute ${compact ? "p-0.5" : "p-1 sm:p-1.5"}`}
              style={{
                left: `${((position.x - displayLeft) / displayCanvasColumns) * 100}%`,
                top: `${((position.y - displayTop) / displayCanvasRows) * 100}%`,
                width: `${(position.width / displayCanvasColumns) * 100}%`,
                height: `${(position.height / displayCanvasRows) * 100}%`,
                transform: `rotate(${position.rotation}deg)`,
                zIndex: 20,
              }}
            >
              {renderPosition(position)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BusManagementSkeleton() {
  return (
    <div aria-label="กำลังโหลดข้อมูลรถ" className="animate-pulse space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="flex flex-1 gap-2 overflow-hidden">
          <div className="h-12 w-28 shrink-0 rounded-xl bg-gray-200" />
          <div className="h-12 w-28 shrink-0 rounded-xl bg-gray-100" />
          <div className="h-12 w-28 shrink-0 rounded-xl bg-gray-100" />
        </div>
        <div className="h-9 w-24 self-end rounded-lg bg-gray-200 md:self-auto" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 h-32 rounded-2xl bg-white shadow-sm sm:col-span-2" />
        <div className="h-32 rounded-2xl bg-white shadow-sm" />
        <div className="h-32 rounded-2xl bg-white shadow-sm" />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="space-y-2">
            <div className="h-5 w-36 rounded bg-gray-200" />
            <div className="h-3 w-56 rounded bg-gray-100" />
          </div>
          <div className="h-8 w-24 rounded-lg bg-gray-100" />
        </div>
        <div className="mx-auto max-w-xl rounded-[2rem] border-4 border-gray-100 bg-gray-50 p-4 sm:p-6">
          <div className="mb-5 h-9 rounded-xl bg-gray-200" />
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, rowIndex) => (
              <div
                key={rowIndex}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_0.35fr_minmax(0,1fr)_minmax(0,1fr)] gap-1.5"
              >
                {Array.from({ length: 4 }, (_, seatIndex) => (
                  <div
                    key={seatIndex}
                    className={`h-16 rounded-xl bg-white ${
                      seatIndex === 2 ? "col-start-4" : ""
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type FloorCountRadioGroupProps = {
  name: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

function FloorCountRadioGroup({
  name,
  value,
  disabled = false,
  onChange,
}: FloorCountRadioGroupProps) {
  const options = [
    { value: "1", label: "ชั้นเดียว" },
    { value: "2", label: "สองชั้น" },
  ];

  return (
    <div
      aria-label="จำนวนชั้น"
      className="mt-2 grid grid-cols-2 gap-3"
      role="radiogroup"
    >
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <label
            key={option.value}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
              disabled
                ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                : isSelected
                  ? "border-[#6b857a] bg-[#edf5f0] text-[#365f4f] shadow-sm"
                  : "border-gray-200 bg-white text-gray-700 hover:border-[#9ab4a7] hover:bg-[#f8fbf9]"
            }`}
          >
            <input
              checked={isSelected}
              className="sr-only"
              disabled={disabled}
              name={name}
              type="radio"
              value={option.value}
              onChange={() => onChange(option.value)}
            />
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                isSelected ? "border-[#6b857a]" : "border-gray-300 bg-white"
              }`}
            >
              {isSelected && (
                <span className="h-2.5 w-2.5 rounded-full bg-[#6b857a]" />
              )}
            </span>
            <span className="text-sm font-medium">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export default function BusManagementModal({
  isOpen,
  onClose,
  campId,
  campName,
  pageMode = false,
}: BusManagementModalProps) {
  const { showError, showSuccess, showConfirm } = useStatusModal();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [publishedLayoutTemplates, setPublishedLayoutTemplates] = useState<
    PublishedLayoutTemplate[]
  >([]);
  const [eligibleTeachers, setEligibleTeachers] = useState<EligibleTeacher[]>(
    [],
  );
  const [unassignedCampStudents, setUnassignedCampStudents] = useState<
    UnassignedCampStudent[]
  >([]);
  const [busPermissions, setBusPermissions] = useState({
    canManageTeachers: false,
    canConfigureAny: false,
  });
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [draftAssignments, setDraftAssignments] = useState<
    Record<number, number | null>
  >({});
  const [draftTeacherAssignments, setDraftTeacherAssignments] = useState<
    Record<number, number | null>
  >({});
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(
    null,
  );
  const [studentSearch, setStudentSearch] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [seatSelectionTab, setSeatSelectionTab] = useState<
    "STUDENT" | "TEACHER"
  >("STUDENT");
  const [studentStatusFilter, setStudentStatusFilter] =
    useState<StudentStatusFilter>("all");
  const [busStudentSearch, setBusStudentSearch] = useState("");
  const [busStudentStatusFilter, setBusStudentStatusFilter] =
    useState<BusStudentStatusFilter>("all");
  const [loading, setLoading] = useState(false);
  const [savingAction, setSavingAction] = useState<SavingAction | null>(null);
  const [changingAssignmentAction, setChangingAssignmentAction] = useState<{
    assignmentId: number;
    action: "status" | "not_traveling" | "active";
  } | null>(null);
  const [changingTeacherSelfStatus, setChangingTeacherSelfStatus] =
    useState(false);
  const [changingTeacherAssignmentId, setChangingTeacherAssignmentId] =
    useState<number | null>(null);
  const [showReminderOptions, setShowReminderOptions] = useState(false);
  const [sendingReminderAction, setSendingReminderAction] = useState<
    "board" | "alight" | null
  >(null);
  const [recentlySentReminderActions, setRecentlySentReminderActions] =
    useState<Array<"board" | "alight">>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showEditBus, setShowEditBus] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTargetBusId, setTransferTargetBusId] = useState("");
  const [transferStudentEnrollmentIds, setTransferStudentEnrollmentIds] =
    useState<number[]>([]);
  const [showUnassignedConfirm, setShowUnassignedConfirm] = useState(false);
  const [pendingBusStatus, setPendingBusStatus] = useState<
    "PARKED" | "TRAVELING" | null
  >(null);
  const [parkClearPassengers, setParkClearPassengers] = useState<
    boolean | null
  >(null);
  const [createForm, setCreateForm] = useState({
    classroomId: "",
    name: "",
    layoutTemplateId: "custom",
    floorCount: "1",
    rowCounts: [10] as RowCountValue[],
  });
  const [editBusForm, setEditBusForm] = useState({
    name: "",
    floorCount: "1",
    rowCounts: [10] as RowCountValue[],
  });
  const [showTripHistory, setShowTripHistory] = useState(false);
  const [tripHistory, setTripHistory] = useState<TripHistoryEntry[] | null>(
    null,
  );
  const [tripHistoryLoading, setTripHistoryLoading] = useState(false);

  const selectedBus = useMemo(
    () => buses.find((bus) => bus.busId === selectedBusId) || null,
    [buses, selectedBusId],
  );

  const hasLiveBoardingStarted = Boolean(selectedBus?.checkedInCount);
  const needsFastLiveRefresh =
    hasLiveBoardingStarted && selectedBus?.status === "PARKED";
  const selectedBusLayoutVersion = useMemo(
    () =>
      selectedBus
        ? JSON.stringify({
            busId: selectedBus.busId,
            name: selectedBus.name,
            floorCount: selectedBus.floorCount,
            layoutTemplateId: selectedBus.layoutTemplateId,
            floors: selectedBus.floors.map((floor) => ({
              floorId: floor.floorId,
              floorNumber: floor.floorNumber,
              rowCount: floor.rowCount,
              positionIds: floor.positions.map(
                (position) => position.positionId,
              ),
            })),
            assignments: selectedBus.assignments.map((assignment) => ({
              assignmentId: assignment.assignmentId,
              positionId: assignment.positionId,
            })),
            teacherAssignments: selectedBus.teacherAssignments.map(
              (assignment) => ({
                assignmentId: assignment.assignmentId,
                positionId: assignment.positionId,
              }),
            ),
          })
        : "",
    [selectedBus],
  );
  const hasMultipleFloors = selectedBus ? selectedBus.floorCount > 1 : false;
  const selectedLayoutTemplate = getBusLayoutTemplate(
    typeof selectedBus?.layoutTemplateId === "string"
      ? selectedBus.layoutTemplateId
      : null,
  );
  const isFreeformBusLayout = typeof selectedBus?.layoutTemplateId === "number";

  const selectedCreateLayoutTemplate = useMemo(() => {
    if (!createForm.layoutTemplateId.startsWith("db:")) {
      return getBusLayoutTemplate(createForm.layoutTemplateId);
    }

    const templateId = Number(createForm.layoutTemplateId.slice(3));

    return (
      publishedLayoutTemplates.find(
        (template) => template.templateId === templateId,
      ) || null
    );
  }, [createForm.layoutTemplateId, publishedLayoutTemplates]);

  const currentFloor = selectedBus?.floors.find(
    (floor) => floor.floorNumber === selectedFloor,
  );

  const selectableAssignments = useMemo<Assignment[]>(
    () => [
      ...(selectedBus?.assignments || []),
      ...unassignedCampStudents.map((student) => ({
        assignmentId: -student.studentEnrollmentId,
        studentEnrollmentId: student.studentEnrollmentId,
        studentId: student.studentId,
        studentName: student.studentName,
        firstName: student.firstName,
        prefixName: student.prefixName,
        nickname: student.nickname,
        profileImageUrl: student.profileImageUrl,
        positionId: null,
        positionLabel: null,
        floorNumber: null,
        status: "OFF_BUS" as const,
        participationStatus: "ACTIVE" as const,
        lastBoardedAt: null,
        lastStatusEvent: null,
        isRegistered: student.isRegistered,
        isPendingBusAssignment: true,
        sourceClassroom: student.classroom,
      })),
    ],
    [selectedBus, unassignedCampStudents],
  );
  const assignmentById = useMemo(
    () =>
      new Map(
        selectableAssignments.map((assignment) => [
          assignment.assignmentId,
          assignment,
        ]),
      ),
    [selectableAssignments],
  );

  const assignedStudentCount = Object.values(draftAssignments).filter(
    (positionId) => positionId !== null,
  ).length;
  const assignedTeacherCount = Object.values(draftTeacherAssignments).filter(
    (positionId) => positionId !== null,
  ).length;
  const assignedCount = assignedStudentCount + assignedTeacherCount;
  const hasAssignedSeat = assignedCount > 0;

  const unassignedStudents = selectedBus?.assignments.filter(
    (assignment) => draftAssignments[assignment.assignmentId] === null,
  );
  const selectedClassroom = classrooms.find(
    (classroom) => classroom.classroomId === selectedBus?.classroomId,
  );
  const classroomAssignedStudentCount = selectedBus
    ? selectedClassroom?.assignedStudentCount || 0
    : 0;
  const classroomRemainingStudentCount = Math.max(
    0,
    (selectedClassroom?.studentCount || 0) - classroomAssignedStudentCount,
  );
  const transferTargetBuses = selectedBus
    ? buses.filter(
        (bus) =>
          bus.busId !== selectedBus.busId && bus.permissions.canConfigure,
      )
    : [];
  const transferTargetBus = transferTargetBuses.find(
    (bus) => bus.busId === Number(transferTargetBusId),
  );
  const transferTargetAvailableCapacity =
    transferTargetBus?.availableCapacity || 0;
  const transferSelectableStudentCount = Math.min(
    selectedBus?.assignments.length || 0,
    transferTargetAvailableCapacity,
  );
  const areAllTransferStudentsSelected =
    transferSelectableStudentCount > 0 &&
    transferStudentEnrollmentIds.length === transferSelectableStudentCount;
  const selectedBusAvailableCapacity = selectedBus?.availableCapacity || 0;

  const fetchBuses = async (preferredBusId?: number | null) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/camps/${campId}/buses`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "โหลดข้อมูลรถไม่สำเร็จ");

      const busList: Bus[] = data.buses || [];

      setClassrooms(data.classrooms || []);
      setBuses(busList);
      setEligibleTeachers(data.eligibleTeachers || []);
      setUnassignedCampStudents(data.unassignedStudents || []);
      setBusPermissions({
        canManageTeachers: Boolean(data.permissions?.canManageTeachers),
        canConfigureAny: Boolean(data.permissions?.canConfigureAny),
      });

      const isCurrentSelectedValid = busList.some(
        (b: Bus) => b.busId === selectedBusId,
      );

      const nextBusId =
        preferredBusId !== undefined
          ? preferredBusId
          : isCurrentSelectedValid
            ? selectedBusId
            : busList[0]?.busId;

      setSelectedBusId(nextBusId || null);
      setShowCreate(!nextBusId && Boolean(data.permissions?.canConfigureAny));
    } catch (error: any) {
      showError(
        "โหลดข้อมูลไม่สำเร็จ",
        error.message || "ไม่สามารถโหลดข้อมูลรถได้",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !campId) return;
    void fetchBuses();
    void fetch("/api/bus-layout-templates?includeDraft=true", {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) throw new Error(data.error);
        setPublishedLayoutTemplates(data.templates || []);
      })
      .catch(() => setPublishedLayoutTemplates([]));
  }, [isOpen, campId]);

  useEffect(() => {
    if (
      !isOpen ||
      !campId ||
      !selectedBusId ||
      showCreate ||
      showEditBus ||
      savingAction !== null
    ) {
      return;
    }

    let active = true;
    let requestInFlight = false;
    const refreshIntervalMs = needsFastLiveRefresh ? 5000 : 10000;

    const refreshLiveStatus = async () => {
      if (
        !active ||
        requestInFlight ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      requestInFlight = true;

      try {
        const response = await fetch(
          `/api/camps/${campId}/buses/${selectedBusId}/live-status`,
          { cache: "no-store" },
        );

        if (!response.ok) return;

        const liveStatus = (await response.json()) as LiveBusStatus;

        if (!active) return;

        const assignmentStatuses = new Map(
          liveStatus.assignmentStatuses.map((assignment) => [
            assignment.assignmentId,
            assignment,
          ]),
        );
        const teacherAssignmentStatuses = new Map(
          liveStatus.teacherAssignmentStatuses.map((assignment) => [
            assignment.assignmentId,
            assignment,
          ]),
        );

        setBuses((current) => {
          let hasChanges = false;
          const next = current.map((bus) => {
            if (bus.busId !== liveStatus.busId) return bus;

            let assignmentsChanged = false;
            const assignments = bus.assignments.map((assignment) => {
              const liveAssignment = assignmentStatuses.get(
                assignment.assignmentId,
              );

              if (!liveAssignment) return assignment;

              const status: Assignment["status"] = liveAssignment.status;
              const participationStatus: Assignment["participationStatus"] =
                liveAssignment.participationStatus;
              const lastBoardedAt = liveAssignment.lastBoardedAt;
              const lastStatusEvent = liveAssignment.lastStatusEvent;

              if (
                assignment.status === status &&
                assignment.participationStatus === participationStatus &&
                assignment.lastBoardedAt === lastBoardedAt &&
                JSON.stringify(assignment.lastStatusEvent) ===
                  JSON.stringify(lastStatusEvent)
              ) {
                return assignment;
              }

              assignmentsChanged = true;

              return {
                ...assignment,
                status,
                participationStatus,
                lastBoardedAt,
                lastStatusEvent,
              };
            });
            let teacherAssignmentsChanged = false;
            const teacherAssignments = bus.teacherAssignments.map(
              (assignment) => {
                const liveAssignment = teacherAssignmentStatuses.get(
                  assignment.assignmentId,
                );

                if (!liveAssignment) return assignment;

                if (
                  assignment.status === liveAssignment.status &&
                  assignment.lastBoardedAt === liveAssignment.lastBoardedAt &&
                  JSON.stringify(assignment.lastStatusEvent) ===
                    JSON.stringify(liveAssignment.lastStatusEvent)
                ) {
                  return assignment;
                }

                teacherAssignmentsChanged = true;

                return {
                  ...assignment,
                  status: liveAssignment.status,
                  lastBoardedAt: liveAssignment.lastBoardedAt,
                  lastStatusEvent: liveAssignment.lastStatusEvent,
                };
              },
            );

            if (
              !assignmentsChanged &&
              !teacherAssignmentsChanged &&
              bus.status === liveStatus.status &&
              bus.checkedInCount === liveStatus.checkedInCount
            ) {
              return bus;
            }

            hasChanges = true;

            return {
              ...bus,
              status: liveStatus.status,
              checkedInCount: liveStatus.checkedInCount,
              studentCheckedInCount: liveStatus.studentCheckedInCount,
              teacherCheckedInCount: liveStatus.teacherCheckedInCount,
              assignments,
              teacherAssignments,
            };
          });

          return hasChanges ? next : current;
        });
      } catch {
        // A later polling cycle will retry without interrupting the teacher.
      } finally {
        requestInFlight = false;
      }
    };

    const refreshTimer = window.setInterval(
      () => void refreshLiveStatus(),
      refreshIntervalMs,
    );
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshLiveStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    campId,
    isOpen,
    savingAction,
    selectedBusId,
    needsFastLiveRefresh,
    showCreate,
    showEditBus,
  ]);

  useEffect(() => {
    if (!selectedBus) {
      setDraftAssignments({});
      setDraftTeacherAssignments({});

      return;
    }

    setDraftAssignments(
      Object.fromEntries(
        selectedBus.assignments.map((assignment) => [
          assignment.assignmentId,
          assignment.positionId,
        ]),
      ),
    );
    setDraftTeacherAssignments(
      Object.fromEntries(
        selectedBus.teacherAssignments.map((assignment) => [
          assignment.teacherId,
          assignment.positionId,
        ]),
      ),
    );
    setSelectedFloor(selectedBus.floorCount === 2 ? 2 : 1);
    setSelectedPositionId(null);
    setEditBusForm({
      name: selectedBus.name,
      floorCount: String(selectedBus.floorCount),
      rowCounts: selectedBus.floors
        .slice()
        .sort((a, b) => a.floorNumber - b.floorNumber)
        .map((floor) => floor.rowCount),
    });
  }, [selectedBusLayoutVersion]);

  const handleCreate = async () => {
    const layoutTemplate = selectedCreateLayoutTemplate;
    const floorCount =
      layoutTemplate?.floors.length || Number(createForm.floorCount);
    const rowCountValues = layoutTemplate
      ? layoutTemplate.floors.map((floor: any) =>
          "rowCount" in floor ? floor.rowCount : floor.canvasRows,
        )
      : createForm.rowCounts.slice(0, floorCount);

    if (
      rowCountValues.length !== floorCount ||
      rowCountValues.some((value) => value === "" || Number(value) < 1)
    ) {
      return;
    }

    const rowCounts = rowCountValues.map(Number);

    if (!createForm.classroomId || !createForm.name.trim()) {
      showError("ข้อมูลไม่ครบ", "กรุณากรอกห้องเรียนและชื่อรถ");

      return;
    }

    try {
      setSavingAction("create");
      const response = await fetch(`/api/camps/${campId}/buses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classroomId: Number(createForm.classroomId),
          name: createForm.name,
          registrationPlate: "",
          floorCount,
          rowCounts,
          layoutTemplateId: createForm.layoutTemplateId.startsWith("db:")
            ? Number(createForm.layoutTemplateId.slice(3))
            : (layoutTemplate as any)?.id,
        }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "สร้างรถไม่สำเร็จ");

      showSuccess("สร้างรถสำเร็จ", "ระบบสร้างผังตำแหน่งและรายชื่อนักเรียนแล้ว");
      setShowCreate(false);
      setCreateForm({
        classroomId: "",
        name: "",
        layoutTemplateId: "custom",
        floorCount: "1",
        rowCounts: [10],
      });
      await fetchBuses(data.busId);
    } catch (error: any) {
      showError("สร้างรถไม่สำเร็จ", error.message || "กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSavingAction(null);
    }
  };

  const handleUpdateBus = async () => {
    if (!selectedBus) return;

    const floorCount = Number(editBusForm.floorCount);
    const rowCountValues = editBusForm.rowCounts.slice(0, floorCount);

    if (
      rowCountValues.length !== floorCount ||
      rowCountValues.some((value) => value === "" || Number(value) < 1)
    ) {
      return;
    }

    const rowCounts = rowCountValues.map(Number);

    if (!editBusForm.name.trim()) {
      showError("ข้อมูลไม่ครบ", "กรุณากรอกชื่อรถ");

      return;
    }

    if (rowCounts.length !== floorCount) {
      showError("ข้อมูลไม่ถูกต้อง", "จำนวนแถวต้องตรงกับจำนวนชั้นของรถ");

      return;
    }

    try {
      setSavingAction("update");
      const response = await fetch(
        "/api/camps/" + campId + "/buses/" + selectedBus.busId,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editBusForm.name,
            registrationPlate: selectedBus.registrationPlate || "",
            floorCount,
            rowCounts,
            layoutTemplateId: selectedLayoutTemplate?.id,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "แก้ไขข้อมูลรถไม่สำเร็จ");

      setShowEditBus(false);
      showSuccess("บันทึกแล้ว", data.message || "อัปเดตข้อมูลรถเรียบร้อยแล้ว");
      await fetchBuses(selectedBus.busId);
    } catch (error: any) {
      showError(
        "แก้ไขข้อมูลรถไม่สำเร็จ",
        error.message || "กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setSavingAction(null);
    }
  };

  const handleDeleteBus = async () => {
    if (!selectedBus) return;

    try {
      setSavingAction("delete");
      const response = await fetch(
        "/api/camps/" + campId + "/buses/" + selectedBus.busId,
        { method: "DELETE" },
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "ลบรถไม่สำเร็จ");

      setShowDeleteConfirm(false);
      setShowEditBus(false);
      setSelectedPositionId(null);
      await fetchBuses(null);
      showSuccess("ลบรถแล้ว", data.message || "ลบรถเรียบร้อยแล้ว");
    } catch (error: any) {
      showError("ลบรถไม่สำเร็จ", error.message || "กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSavingAction(null);
    }
  };

  const openTransferStudents = () => {
    if (!selectedBus) return;

    setTransferTargetBusId(String(transferTargetBuses[0]?.busId || ""));
    setTransferStudentEnrollmentIds([]);
    setShowTransfer(true);
  };

  const handleTransferStudents = async () => {
    if (
      !selectedBus ||
      !transferTargetBusId ||
      transferStudentEnrollmentIds.length === 0
    ) {
      showError("ข้อมูลไม่ครบ", "กรุณาเลือกรถปลายทางและนักเรียนอย่างน้อย 1 คน");

      return;
    }

    try {
      setSavingAction("transfer");
      const response = await fetch(
        `/api/camps/${campId}/buses/${selectedBus.busId}/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetBusId: Number(transferTargetBusId),
            studentEnrollmentIds: transferStudentEnrollmentIds,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "ย้ายนักเรียนไม่สำเร็จ");

      setShowTransfer(false);
      setTransferStudentEnrollmentIds([]);
      showSuccess("ย้ายนักเรียนแล้ว", data.message);
      await fetchBuses(Number(transferTargetBusId));
    } catch (error: any) {
      showError(
        "ย้ายนักเรียนไม่สำเร็จ",
        error.message || "กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setSavingAction(null);
    }
  };

  const setStudentAtPosition = (
    positionId: number,
    assignmentId: number | null,
  ) => {
    if (
      assignmentId !== null &&
      assignmentId < 0 &&
      draftAssignments[assignmentId] == null &&
      Object.entries(draftAssignments).filter(
        ([id, currentPositionId]) =>
          Number(id) < 0 && currentPositionId !== null,
      ).length >= selectedBusAvailableCapacity
    ) {
      showError("รถเต็มแล้ว", "ไม่สามารถเพิ่มนักเรียนเกินความจุของรถคันนี้ได้");

      return;
    }

    const occupyingTeacherId = Object.entries(draftTeacherAssignments).find(
      ([, teacherPositionId]) => teacherPositionId === positionId,
    )?.[0];

    if (occupyingTeacherId && !selectedBus?.permissions.canManageTeachers) {
      showError("เปลี่ยนที่นั่งไม่ได้", "ตำแหน่งนี้ถูกจัดให้ครูในรถแล้ว");

      return;
    }

    if (occupyingTeacherId) {
      setDraftTeacherAssignments((current) => {
        const next = { ...current };

        delete next[Number(occupyingTeacherId)];

        return next;
      });
    }

    setDraftAssignments((current) => {
      const next = { ...current };

      Object.keys(next).forEach((key) => {
        const id = Number(key);

        if (next[id] === positionId || id === assignmentId) next[id] = null;
      });

      if (assignmentId !== null) next[assignmentId] = positionId;

      return next;
    });
  };

  const setTeacherAtPosition = (
    positionId: number,
    teacherId: number | null,
  ) => {
    if (!selectedBus?.permissions.canManageTeachers) return;

    setDraftAssignments((current) => {
      const next = { ...current };

      Object.keys(next).forEach((key) => {
        if (next[Number(key)] === positionId) next[Number(key)] = null;
      });

      return next;
    });
    setDraftTeacherAssignments((current) => {
      const next = { ...current };

      Object.keys(next).forEach((key) => {
        const id = Number(key);

        if (next[id] === positionId || id === teacherId) delete next[id];
      });

      if (teacherId !== null) next[teacherId] = positionId;

      return next;
    });
  };

  const saveLayout = async (
    showMessage = true,
    action: SavingAction = "save",
  ) => {
    if (!selectedBus) return false;

    if (!hasAssignedSeat) {
      showError(
        "ยังจัดที่นั่งไม่ครบ",
        "กรุณาจัดที่นั่งให้ผู้โดยสารอย่างน้อย 1 คนก่อนบันทึกผัง",
      );

      return false;
    }

    try {
      setSavingAction(action);
      const response = await fetch(
        `/api/camps/${campId}/buses/${selectedBus.busId}/layout`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignments: [
              ...selectedBus.assignments.map((assignment) => ({
                assignmentId: assignment.assignmentId,
                positionId: draftAssignments[assignment.assignmentId] ?? null,
              })),
              ...Object.entries(draftAssignments)
                .filter(
                  ([assignmentId, positionId]) =>
                    Number(assignmentId) < 0 && positionId !== null,
                )
                .map(([assignmentId, positionId]) => ({
                  studentEnrollmentId: -Number(assignmentId),
                  positionId: Number(positionId),
                })),
            ],
            ...(selectedBus.permissions.canManageTeachers
              ? {
                  teacherAssignments: Object.entries(draftTeacherAssignments)
                    .filter(([, positionId]) => positionId !== null)
                    .map(([teacherId, positionId]) => ({
                      teacherId: Number(teacherId),
                      positionId: Number(positionId),
                    })),
                }
              : {}),
          }),
        },
      );
      const responseText = await response.text();
      let data: { error?: string; message?: string } = {};

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { error: responseText || "เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง" };
      }

      if (!response.ok) throw new Error(data.error || "บันทึกผังไม่สำเร็จ");

      await fetchBuses(selectedBus.busId);
      setShowUnassignedConfirm(false);
      setSelectedPositionId(null);

      if (showMessage) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        showSuccess(
          "บันทึกผังสำเร็จ",
          data.message || "อัปเดตผังที่นั่งแล้ว นักเรียนยังต้องยืนยันขึ้นรถเอง",
        );
      }

      return true;
    } catch (error: any) {
      showError("บันทึกผังไม่สำเร็จ", error.message || "กรุณาลองใหม่อีกครั้ง");

      return false;
    } finally {
      setSavingAction(null);
    }
  };

  const requestSaveLayout = () => {
    if (unassignedStudents && unassignedStudents.length > 0) {
      setShowUnassignedConfirm(true);

      return;
    }

    void saveLayout();
  };

  const fetchTripHistory = async (busId: number) => {
    setTripHistoryLoading(true);
    setTripHistory(null);
    setShowTripHistory(true);

    try {
      const response = await fetch(
        `/api/camps/${campId}/buses/${busId}/trip-history`,
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "โหลดประวัติไม่สำเร็จ");
      setTripHistory(data.trips);
    } catch {
      setTripHistory([]);
    } finally {
      setTripHistoryLoading(false);
    }
  };

  const requestBusStatusChange = () => {
    if (!selectedBus) return;

    const nextStatus = selectedBus.status === "PARKED" ? "TRAVELING" : "PARKED";

    setPendingBusStatus(nextStatus);
    setParkClearPassengers(nextStatus === "PARKED" ? null : true);
  };

  const changeBusStatus = async (clearPassengers = true) => {
    if (!selectedBus || !pendingBusStatus) return;

    try {
      setSavingAction("status");
      const location = await getCurrentDeviceLocation();
      const response = await fetch(
        `/api/camps/${campId}/buses/${selectedBus.busId}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: pendingBusStatus,
            clearPassengers,
            location,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok)
        throw new Error(data.error || "เปลี่ยนสถานะรถไม่สำเร็จ");

      showSuccess("อัปเดตสถานะรถแล้ว", data.message);
      setPendingBusStatus(null);
      setParkClearPassengers(null);
      await fetchBuses(selectedBus.busId);
    } catch (error: any) {
      showError(
        "เปลี่ยนสถานะรถไม่สำเร็จ",
        error.message || "กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setSavingAction(null);
    }
  };

  const changeStudentBusStatus = async (assignment: Assignment) => {
    if (!selectedBus || changingAssignmentAction !== null) return;

    const action = assignment.status === "ON_BUS" ? "alight" : "board";

    try {
      setChangingAssignmentAction({
        assignmentId: assignment.assignmentId,
        action: "status",
      });
      const response = await fetch(
        `/api/camps/${campId}/buses/${selectedBus.busId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: assignment.assignmentId,
            passengerType: "STUDENT",
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "เปลี่ยนสถานะนักเรียนไม่สำเร็จ");
      }

      showSuccess(
        assignment.status === "ON_BUS"
          ? "บันทึกการลงรถแล้ว"
          : "บันทึกการขึ้นรถแล้ว",
        `${assignment.studentName} · บันทึกว่าครูเป็นผู้กดในรอบนี้แล้ว`,
      );
      await fetchBuses(selectedBus.busId);
      setSelectedPositionId(null);
    } catch (error: any) {
      showError(
        "เปลี่ยนสถานะนักเรียนไม่สำเร็จ",
        error.message || "กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setChangingAssignmentAction(null);
    }
  };

  const changeStudentParticipation = async (
    assignment: Assignment,
    participationStatus: Assignment["participationStatus"],
  ) => {
    if (!selectedBus || changingAssignmentAction !== null) return;

    try {
      setChangingAssignmentAction({
        assignmentId: assignment.assignmentId,
        action:
          participationStatus === "NOT_TRAVELING" ? "not_traveling" : "active",
      });
      const response = await fetch(
        `/api/camps/${campId}/buses/${selectedBus.busId}/participation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: assignment.assignmentId,
            participationStatus,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "เปลี่ยนสถานะการร่วมเดินทางไม่สำเร็จ");
      }

      showSuccess(
        participationStatus === "NOT_TRAVELING"
          ? "จำสถานะไว้ในค่ายนี้แล้ว"
          : "นำนักเรียนกลับเข้าร่วมแล้ว",
        `${assignment.studentName} · ${data.message}`,
      );
      await fetchBuses(selectedBus.busId);
    } catch (error: any) {
      showError(
        "เปลี่ยนสถานะการร่วมเดินทางไม่สำเร็จ",
        error.message || "กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setChangingAssignmentAction(null);
    }
  };

  const currentTeacherAssignment = selectedBus?.teacherAssignments.find(
    (assignment) => assignment.isCurrentTeacher,
  );

  const changeTeacherPassengerBusStatus = async (
    assignment: TeacherAssignment,
  ) => {
    if (
      !selectedBus ||
      changingTeacherAssignmentId !== null ||
      changingTeacherSelfStatus
    ) {
      return;
    }

    const action = assignment.status === "ON_BUS" ? "alight" : "board";

    try {
      setChangingTeacherAssignmentId(assignment.assignmentId);
      const response = await fetch(
        `/api/camps/${campId}/buses/${selectedBus.busId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: assignment.assignmentId,
            passengerType: "TEACHER",
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "เปลี่ยนสถานะครูไม่สำเร็จ");
      }

      showSuccess(
        action === "board" ? "บันทึกการขึ้นรถแล้ว" : "บันทึกการลงรถแล้ว",
        `${assignment.teacherName} · บันทึกว่าครูเป็นผู้กดในรอบนี้แล้ว`,
      );
      await fetchBuses(selectedBus.busId);
      setSelectedPositionId(null);
    } catch (error: any) {
      showError(
        "เปลี่ยนสถานะครูไม่สำเร็จ",
        error.message || "กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setChangingTeacherAssignmentId(null);
    }
  };

  const changeOwnTeacherBusStatus = async () => {
    if (!currentTeacherAssignment || changingTeacherSelfStatus) return;

    const action =
      currentTeacherAssignment.status === "ON_BUS" ? "alight" : "board";

    try {
      setChangingTeacherSelfStatus(true);
      const response = await fetch(
        `/api/teacher/camps/${campId}/bus/${action}`,
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "เปลี่ยนสถานะขึ้นลงรถไม่สำเร็จ");
      }

      showSuccess(
        action === "board" ? "บันทึกการขึ้นรถแล้ว" : "บันทึกการลงรถแล้ว",
        data.message,
      );
      await fetchBuses(selectedBus?.busId || null);
    } catch (error: any) {
      showError(
        "เปลี่ยนสถานะขึ้นลงรถไม่สำเร็จ",
        error.message || "กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setChangingTeacherSelfStatus(false);
    }
  };

  const sendStudentBusReminder = async (action: "board" | "alight") => {
    if (!selectedBus || sendingReminderAction !== null) return;

    try {
      setSendingReminderAction(action);
      const response = await fetch(
        `/api/teacher/camps/${campId}/bus/remind`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, busId: selectedBus.busId }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "ส่งการเตือนไม่สำเร็จ");
      }

      setRecentlySentReminderActions((current) => [
        ...current.filter((item) => item !== action),
        action,
      ]);
      window.setTimeout(() => {
        setRecentlySentReminderActions((current) =>
          current.filter((item) => item !== action),
        );
      }, 60_000);
      showSuccess("ส่งการเตือนแล้ว", data.message);
      await fetchBuses(selectedBus.busId);
    } catch (error: any) {
      showError(
        "ส่งการเตือนไม่สำเร็จ",
        error.message || "กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setSendingReminderAction(null);
    }
  };

  const requestStudentBusReminder = (action: "board" | "alight") => {
    const count = action === "board" ? busStudentCounts.off : busStudentCounts.on;
    const actionLabel = action === "board" ? "ขึ้นรถ" : "ลงรถ";

    showConfirm(
      `เตือนให้นักเรียนกด${actionLabel}`,
      `ระบบจะแจ้งเฉพาะนักเรียน ${count} คนที่ยังไม่ได้กด${actionLabel} การแจ้งเตือนจะแสดงเป็นเวลา 30 นาที`,
      () => void sendStudentBusReminder(action),
      `ส่งเตือน ${count} คน`,
    );
  };

  const availableClassrooms = classrooms;
  const activePositionAssignmentId = selectedPositionId
    ? Object.entries(draftAssignments).find(
        ([, positionId]) => positionId === selectedPositionId,
      )?.[0]
    : undefined;
  const activePositionTeacherId = selectedPositionId
    ? Object.entries(draftTeacherAssignments).find(
        ([, positionId]) => positionId === selectedPositionId,
      )?.[0]
    : undefined;
  const selectedPosition = selectedPositionId
    ? currentFloor?.positions.find(
        (position) => position.positionId === selectedPositionId,
      )
    : null;
  const orderedPositions = useMemo(
    () =>
      selectedBus
        ? selectedBus.floors
            .slice()
            .sort((a, b) => a.floorNumber - b.floorNumber)
            .flatMap((floor) =>
              floor.positions
                .slice()
                .sort(
                  (a, b) =>
                    a.rowNumber - b.rowNumber || a.seatIndex - b.seatIndex,
                )
                .map((position) => ({
                  ...position,
                  floorNumber: floor.floorNumber,
                })),
            )
        : [],
    [selectedBus],
  );
  const selectedPositionIndex = selectedPositionId
    ? orderedPositions.findIndex(
        (position) => position.positionId === selectedPositionId,
      )
    : -1;

  const activeAssignment = activePositionAssignmentId
    ? assignmentById.get(Number(activePositionAssignmentId)) || null
    : null;
  const activeTeacherAssignment = activePositionTeacherId
    ? selectedBus?.teacherAssignments.find(
        (assignment) =>
          assignment.teacherId === Number(activePositionTeacherId),
      ) || null
    : null;
  const activeTeacher = activePositionTeacherId
    ? eligibleTeachers.find(
        (teacher) => teacher.teacherId === Number(activePositionTeacherId),
      ) ||
      (activeTeacherAssignment
        ? {
            teacherId: activeTeacherAssignment.teacherId,
            prefixName: activeTeacherAssignment.prefixName,
            firstName: activeTeacherAssignment.firstName,
            lastName: "",
            teacherName: activeTeacherAssignment.teacherName,
            email: "",
            assignedBus: selectedBus
              ? { busId: selectedBus.busId, busName: selectedBus.name }
              : null,
          }
        : null)
    : null;
  const seatedAssignmentIds = useMemo(
    () =>
      new Set(
        Object.entries(draftAssignments)
          .filter(
            ([, positionId]) => positionId !== null && positionId !== undefined,
          )
          .map(([assignmentId]) => Number(assignmentId)),
      ),
    [draftAssignments],
  );
  const seatedTeacherIds = useMemo(
    () =>
      new Set(
        Object.entries(draftTeacherAssignments)
          .filter(([, positionId]) => positionId !== null)
          .map(([teacherId]) => Number(teacherId)),
      ),
    [draftTeacherAssignments],
  );
  const pendingBusAssignmentCount = Array.from(seatedAssignmentIds).filter(
    (assignmentId) => assignmentId < 0,
  ).length;
  const studentCounts = useMemo(() => {
    const assignments = selectableAssignments;

    return {
      all: assignments.length,
      registered: assignments.filter((assignment) => assignment.isRegistered)
        .length,
      unregistered: assignments.filter((assignment) => !assignment.isRegistered)
        .length,
    };
  }, [selectableAssignments]);
  const allStudentsHaveSeats = useMemo(
    () =>
      selectableAssignments.length > 0 &&
      selectableAssignments.every((assignment) =>
        seatedAssignmentIds.has(assignment.assignmentId),
      ),
    [seatedAssignmentIds, selectableAssignments],
  );
  const filteredAssignments = useMemo(() => {
    const query = studentSearch.trim().toLocaleLowerCase();

    return selectableAssignments.filter((assignment) => {
      const matchesStatus =
        Boolean(query) ||
        studentStatusFilter === "all" ||
        (studentStatusFilter === "registered"
          ? assignment.isRegistered
          : !assignment.isRegistered);
      const matchesSearch =
        !query ||
        assignment.studentName.toLocaleLowerCase().includes(query) ||
        assignment.nickname?.toLocaleLowerCase().includes(query) ||
        String(assignment.studentId).includes(query);
      const isAlreadySeated = seatedAssignmentIds.has(assignment.assignmentId);

      return (
        matchesStatus && matchesSearch && (!isAlreadySeated || Boolean(query))
      );
    });
  }, [
    seatedAssignmentIds,
    selectableAssignments,
    studentSearch,
    studentStatusFilter,
  ]);
  const filteredTeachers = useMemo(() => {
    const query = teacherSearch.trim().toLocaleLowerCase();

    return eligibleTeachers.filter((teacher) => {
      const matchesSearch =
        !query ||
        teacher.teacherName.toLocaleLowerCase().includes(query) ||
        teacher.email.toLocaleLowerCase().includes(query) ||
        String(teacher.teacherId).includes(query);
      const isAlreadySeated = seatedTeacherIds.has(teacher.teacherId);

      return matchesSearch && (!isAlreadySeated || Boolean(query));
    });
  }, [eligibleTeachers, seatedTeacherIds, teacherSearch]);

  const busStudentCounts = useMemo(() => {
    const assignments = selectedBus?.assignments || [];

    return {
      all: assignments.length,
      on: assignments.filter(
        (assignment) =>
          assignment.participationStatus === "ACTIVE" &&
          assignment.status === "ON_BUS",
      ).length,
      off: assignments.filter(
        (assignment) =>
          assignment.participationStatus === "ACTIVE" &&
          assignment.status === "OFF_BUS",
      ).length,
      notTraveling: assignments.filter(
        (assignment) => assignment.participationStatus === "NOT_TRAVELING",
      ).length,
    };
  }, [selectedBus]);

  const seatedNotBoardedAssignments = useMemo(
    () =>
      (selectedBus?.assignments || []).filter(
        (assignment) =>
          assignment.participationStatus === "ACTIVE" &&
          assignment.positionId !== null &&
          assignment.status !== "ON_BUS",
      ),
    [selectedBus],
  );
  const unseatedAssignments = useMemo(
    () =>
      (selectedBus?.assignments || []).filter(
        (assignment) =>
          assignment.participationStatus === "ACTIVE" &&
          assignment.positionId === null,
      ),
    [selectedBus],
  );
  const notTravelingAssignments = useMemo(
    () =>
      (selectedBus?.assignments || []).filter(
        (assignment) => assignment.participationStatus === "NOT_TRAVELING",
      ),
    [selectedBus],
  );

  const filteredBusAssignments = useMemo(() => {
    const query = busStudentSearch.trim().toLocaleLowerCase();

    return (selectedBus?.assignments || []).filter((assignment) => {
      const matchesStatus =
        busStudentStatusFilter === "all" ||
        (busStudentStatusFilter === "on"
          ? assignment.participationStatus === "ACTIVE" &&
            assignment.status === "ON_BUS"
          : assignment.participationStatus === "ACTIVE" &&
            assignment.status === "OFF_BUS");
      const matchesSearch =
        !query ||
        assignment.studentName.toLocaleLowerCase().includes(query) ||
        assignment.nickname?.toLocaleLowerCase().includes(query) ||
        String(assignment.studentId).includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [busStudentSearch, busStudentStatusFilter, selectedBus]);

  useEffect(() => {
    setStudentSearch("");
    setTeacherSearch("");
    setStudentStatusFilter("all");
    setSeatSelectionTab(
      selectedPositionId !== null &&
        Object.values(draftTeacherAssignments).includes(selectedPositionId)
        ? "TEACHER"
        : "STUDENT",
    );
  }, [selectedPositionId]);

  useEffect(() => {
    setBusStudentSearch("");
    setBusStudentStatusFilter("all");
    setShowReminderOptions(false);
    setRecentlySentReminderActions([]);
  }, [selectedBusId]);

  const moveToSeat = (direction: -1 | 1) => {
    if (selectedPositionIndex < 0) return;

    const nextPosition = orderedPositions[selectedPositionIndex + direction];

    if (!nextPosition) return;

    setSelectedFloor(nextPosition.floorNumber);
    setSelectedPositionId(nextPosition.positionId);
  };

  const Header = pageMode ? "header" : ModalHeader;
  const Body = pageMode ? "section" : ModalBody;

  return (
    <BusManagementShell isOpen={isOpen} pageMode={pageMode} onClose={onClose}>
      <>
        <Header
          className={`relative flex flex-col gap-1 px-6 ${
            pageMode
              ? "mx-auto w-full max-w-7xl border-0 pb-8 pt-8 sm:px-8"
              : "border-b border-gray-100 p-6 pb-4"
          }`}
        >
          {pageMode && (
            <CampBreadcrumb
              campId={campId}
              className="mb-6"
              currentPage="เช็กชื่อขึ้นรถ"
            />
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-[#6b857a]">
              <Bus size={pageMode ? 20 : 24} />
              <h2
                className={`${
                  pageMode ? "text-lg leading-tight" : "text-xl"
                } truncate font-bold text-gray-900`}
              >
                เช็คชื่อขึ้นรถ
              </h2>
            </div>
            {busPermissions.canConfigureAny && (
              <Button
                className="shrink-0 bg-[#6b857a] px-3 text-sm font-medium text-white"
                size="sm"
                startContent={
                  showCreate ? <ArrowLeft size={15} /> : <Plus size={15} />
                }
                onPress={() => {
                  setShowCreate((current) => !current);
                  setSelectedBusId(null);
                }}
              >
                {showCreate ? "กลับไปรายการรถ" : "สร้างรถ"}
              </Button>
            )}
          </div>
          {campName && (
            <p className="text-sm font-normal text-gray-500">
              ค่าย: {campName}
            </p>
          )}
        </Header>

        <Body
          className={
            pageMode
              ? "mx-auto block w-full max-w-7xl overflow-visible bg-[#f5f5f2] px-4 pb-10 pt-0 sm:px-8"
              : "bg-[#f5f5f2]/30 p-4 sm:p-6"
          }
        >
          {loading && buses.length === 0 ? (
            <BusManagementSkeleton />
          ) : (
            <div className="space-y-4">
              {/* Clean Bus Selector Tabs */}
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  เลือกรถที่ต้องการจัดการ ({buses.length} คัน)
                </p>
                <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                  {buses.map((bus) => {
                    const isSelected = selectedBusId === bus.busId;

                    return (
                      <button
                        key={bus.busId}
                        className={`whitespace-nowrap rounded-xl border px-3.5 py-2 text-left text-sm transition ${
                          isSelected
                            ? "border-[#6b857a] bg-[#6b857a] font-semibold text-white shadow-sm"
                            : "border-gray-200 bg-gray-50 font-medium text-gray-700 hover:border-[#6b857a] hover:bg-gray-100"
                        }`}
                        type="button"
                        onClick={() => {
                          setSelectedBusId(bus.busId);
                          setShowCreate(false);
                        }}
                      >
                        <span>{bus.name}</span>
                        <span
                          className={`ml-2 text-[11px] ${
                            isSelected ? "text-white/80" : "text-gray-400"
                          }`}
                        >
                          {bus.assignments.length}/{bus.capacity}
                        </span>
                      </button>
                    );
                  })}
                  {buses.length === 0 && (
                    <p className="text-sm text-gray-500">ยังไม่มีรถในค่ายนี้</p>
                  )}
                </div>
              </div>

              {showCreate ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Plus className="text-[#6b857a]" size={20} />
                    <h3 className="font-bold text-gray-900">
                      สร้างรถสำหรับห้องเรียน
                    </h3>
                  </div>
                  {availableClassrooms.length === 0 ? (
                    <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                      ยังไม่มีห้องเรียนที่ลงทะเบียนในค่ายนี้
                    </p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="text-sm font-semibold text-gray-700">
                        ห้องเรียน
                        <Select
                          aria-label="ห้องเรียน"
                          className="mt-1 w-full"
                          classNames={{
                            trigger:
                              "min-h-11 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-none",
                            value: "text-sm font-normal text-gray-800",
                            popoverContent:
                              "rounded-xl border border-gray-200 bg-white p-1 shadow-lg",
                          }}
                          placeholder="เลือกห้องเรียน"
                          selectedKeys={
                            createForm.classroomId
                              ? new Set([createForm.classroomId])
                              : new Set()
                          }
                          onSelectionChange={(keys) => {
                            const selectedValue = Array.from(keys)[0] || "";

                            setCreateForm((form) => ({
                              ...form,
                              classroomId: String(selectedValue),
                            }));
                          }}
                        >
                          {availableClassrooms.map((classroom) => (
                            <SelectItem
                              key={classroom.classroomId}
                              className="rounded-lg text-sm text-gray-700 hover:bg-[#e2eee7] data-[selected=true]:bg-[#6b857a] data-[selected=true]:text-white"
                              textValue={`${gradeLabel(classroom.grade)} ห้อง ${classroom.roomName}`}
                            >
                              {gradeLabel(classroom.grade)} ห้อง{" "}
                              {classroom.roomName} · จัดแล้ว{" "}
                              {classroom.assignedStudentCount}/
                              {classroom.studentCount} คน · เหลือ{" "}
                              {classroom.unassignedStudentCount} คน
                            </SelectItem>
                          ))}
                        </Select>
                      </label>
                      <label className="text-sm font-semibold text-gray-700">
                        ชื่อรถ
                        <input
                          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-normal outline-none focus:border-[#6b857a]"
                          placeholder="เช่น คันที่1 ก123"
                          value={createForm.name}
                          onChange={(event) =>
                            setCreateForm((form) => ({
                              ...form,
                              name: event.target.value,
                            }))
                          }
                        />
                      </label>
                      {createForm.classroomId && (
                        <div className="rounded-xl bg-[#edf5f0] px-4 py-3 text-sm text-[#365f4f] md:col-span-2">
                          {(() => {
                            const classroom = classrooms.find(
                              (item) =>
                                item.classroomId ===
                                Number(createForm.classroomId),
                            );

                            return classroom
                              ? `ห้องนี้มีรถ ${classroom.busCount} คัน · จัดแล้ว ${classroom.assignedStudentCount}/${classroom.studentCount} คน · เหลือ ${classroom.unassignedStudentCount} คน ระบบจะนำนักเรียนที่เหลือลงรถคันใหม่นี้ตามความจุ`
                              : null;
                          })()}
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <p className="text-sm font-semibold text-gray-700">
                          เทมเพลตผังรถ
                        </p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          <button
                            className={`rounded-2xl border p-4 text-left transition ${
                              createForm.layoutTemplateId === "custom"
                                ? "border-[#6b857a] bg-[#edf5f0] ring-2 ring-[#6b857a]/15"
                                : "border-gray-200 bg-white hover:border-[#9ab4a7]"
                            }`}
                            type="button"
                            onClick={() =>
                              setCreateForm((form) => ({
                                ...form,
                                layoutTemplateId: "custom",
                              }))
                            }
                          >
                            <span className="block text-sm font-bold text-gray-900">
                              ผังรถทั่วไป
                            </span>
                            <span className="mt-1 block text-xs font-normal text-gray-500">
                              กำหนดจำนวนชั้นและจำนวนแถวเอง
                            </span>
                          </button>
                          {BUS_LAYOUT_TEMPLATES.map((template) => (
                            <button
                              key={template.id}
                              className={`rounded-2xl border p-4 text-left transition ${
                                createForm.layoutTemplateId === template.id
                                  ? "border-[#6b857a] bg-[#edf5f0] ring-2 ring-[#6b857a]/15"
                                  : "border-gray-200 bg-white hover:border-[#9ab4a7]"
                              }`}
                              type="button"
                              onClick={() =>
                                setCreateForm((form) => ({
                                  ...form,
                                  name: form.name || template.defaultBusName,
                                  layoutTemplateId: template.id,
                                  floorCount: String(template.floors.length),
                                  rowCounts: template.floors.map(
                                    (floor) => floor.rowCount,
                                  ),
                                }))
                              }
                            >
                              <span className="block text-sm font-bold text-gray-900">
                                {template.name}
                              </span>
                              <span className="mt-1 block text-xs font-normal text-gray-500">
                                {template.description}
                              </span>
                            </button>
                          ))}
                          {publishedLayoutTemplates.length > 0 && (
                            <div className="md:col-span-2 mt-1 flex items-center gap-2 border-t border-gray-100 pt-3">
                              <span className="text-xs font-semibold text-[#557267]">
                                ผังที่สร้างจากหน้าแอดมิน
                              </span>
                              <span className="text-[11px] font-normal text-gray-400">
                                เลือกใช้ได้เมื่อเผยแพร่แล้ว
                              </span>
                            </div>
                          )}
                          {publishedLayoutTemplates.map((template) => {
                            const templateKey = `db:${template.templateId}`;
                            const isDraft = template.status === "DRAFT";

                            return (
                              <button
                                key={templateKey}
                                className={`rounded-2xl border p-4 text-left transition ${
                                  isDraft
                                    ? "cursor-not-allowed border-amber-200 bg-amber-50/60 opacity-80"
                                    : createForm.layoutTemplateId ===
                                        templateKey
                                      ? "border-[#6b857a] bg-[#edf5f0] ring-2 ring-[#6b857a]/15"
                                      : "border-gray-200 bg-white hover:border-[#9ab4a7]"
                                }`}
                                disabled={isDraft}
                                type="button"
                                onClick={() =>
                                  setCreateForm((form) => ({
                                    ...form,
                                    name: form.name || template.name,
                                    layoutTemplateId: templateKey,
                                    floorCount: String(template.floorCount),
                                    rowCounts: template.floors.map(
                                      (floor) => floor.canvasRows,
                                    ),
                                  }))
                                }
                              >
                                <span className="flex items-center justify-between gap-2 text-sm font-bold text-gray-900">
                                  <span>{template.name}</span>
                                  <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                                      isDraft
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-[#dfeae3] text-[#365f4f]"
                                    }`}
                                  >
                                    {isDraft
                                      ? "ฉบับร่าง"
                                      : `${template.capacity} ที่`}
                                  </span>
                                </span>
                                <span className="mt-1 block text-xs font-normal text-gray-500">
                                  {isDraft
                                    ? "ต้องเผยแพร่จากหน้าแอดมินก่อนเลือกใช้"
                                    : template.description ||
                                      `ผังลากวาง ${template.floorCount} ชั้น`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {createForm.layoutTemplateId === "custom" ? (
                        <>
                          <div className="text-sm font-semibold text-gray-700 md:col-span-2">
                            จำนวนชั้น
                            <FloorCountRadioGroup
                              name="create-floor-count"
                              value={createForm.floorCount}
                              onChange={(value) => {
                                const floorCount = Number(value);

                                setCreateForm((form) => ({
                                  ...form,
                                  floorCount: value,
                                  rowCounts:
                                    floorCount === 2
                                      ? [
                                          form.rowCounts[0] || 10,
                                          form.rowCounts[1] || 10,
                                        ]
                                      : [form.rowCounts[0] || 10],
                                }));
                              }}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4 md:col-span-2">
                            {createForm.rowCounts
                              .map((rowCount, index) => ({ rowCount, index }))
                              .reverse()
                              .map(({ rowCount, index }) => (
                                <label
                                  key={index}
                                  className="text-sm font-semibold text-gray-700"
                                >
                                  {rowCountLabel(
                                    index + 1,
                                    Number(createForm.floorCount),
                                  )}
                                  <input
                                    className={[
                                      "mt-1 w-full rounded-xl border px-3 py-2.5 font-normal outline-none focus:border-[#6b857a]",
                                      rowCount === ""
                                        ? "border-red-400 bg-red-50"
                                        : "border-gray-200",
                                    ].join(" ")}
                                    inputMode="numeric"
                                    max={50}
                                    min={1}
                                    type="number"
                                    value={rowCount}
                                    onChange={(event) => {
                                      const value = event.target.value;

                                      setCreateForm((form) => ({
                                        ...form,
                                        rowCounts: form.rowCounts.map(
                                          (currentValue, rowIndex) =>
                                            rowIndex === index
                                              ? value === ""
                                                ? ""
                                                : Math.max(1, Number(value))
                                              : currentValue,
                                        ),
                                      }));
                                    }}
                                  />
                                  {rowCount === "" && (
                                    <span className="mt-1 block text-xs font-normal text-red-600">
                                      กรุณากรอกจำนวนแถว
                                    </span>
                                  )}
                                  <span className="mt-1 block text-xs font-normal text-gray-400">
                                    4 ที่นั่งต่อแถว
                                  </span>
                                </label>
                              ))}
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border border-[#dce8e0] bg-[#f7faf8] px-4 py-3 text-xs leading-relaxed text-[#365f4f] md:col-span-2">
                          ระบบจะสร้างหมายเลขที่นั่ง 1–50 ตามผังจริงให้ทันที
                          พร้อมช่องว่างบริเวณบันได โซฟา โต๊ะกลาง และห้องน้ำ
                        </div>
                      )}
                      <div className="flex items-end justify-end gap-2 md:col-span-2">
                        {buses.length > 0 && (
                          <Button
                            variant="light"
                            onPress={() => setShowCreate(false)}
                          >
                            ยกเลิก
                          </Button>
                        )}
                        <Button
                          className="bg-[#6b857a] font-medium text-white"
                          isDisabled={savingAction !== null}
                          isLoading={savingAction === "create"}
                          onPress={handleCreate}
                        >
                          สร้างรถและผังตำแหน่ง
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedBus ? (
                <div className="space-y-4">
                  {/* Selected Bus Overview Card */}
                  <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 text-[#6b857a]">
                          <Bus className="shrink-0" size={22} />
                          <div className="min-w-0">
                            <h3 className="truncate font-bold text-gray-900 text-base">
                              {selectedBus.name}
                            </h3>
                            <p className="text-xs text-gray-500 truncate">
                              {gradeLabel(selectedBus.classroom.grade)} ห้อง{" "}
                              {selectedBus.classroom.roomName}
                            </p>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-600">
                          ครูประจำชั้น:{" "}
                          <span className="font-semibold text-gray-800">
                            {selectedBus.classroom.teacherName ||
                              "ไม่พบข้อมูลครู"}
                          </span>
                        </p>
                      </div>

                      {selectedBus.permissions.canConfigure && (
                        <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                          {transferTargetBuses.length > 0 && (
                            <Button
                              className="bg-amber-50 font-medium text-amber-800 hover:bg-amber-100"
                              isDisabled={
                                savingAction !== null ||
                                selectedBus.assignments.length === 0
                              }
                              size="sm"
                              startContent={<ArrowRightLeft size={15} />}
                              onPress={openTransferStudents}
                            >
                              ย้ายนักเรียน
                            </Button>
                          )}
                          <Button
                            className="bg-[#e2eee7] font-medium text-[#365f4f]"
                            isDisabled={savingAction !== null}
                            size="sm"
                            startContent={<Pencil size={15} />}
                            onPress={() => setShowEditBus(true)}
                          >
                            แก้ไขรถ
                          </Button>
                          <Button
                            className="bg-red-50 font-medium text-red-700 hover:bg-red-100"
                            isDisabled={savingAction !== null}
                            size="sm"
                            startContent={<Trash2 size={15} />}
                            onPress={() => setShowDeleteConfirm(true)}
                          >
                            ลบรถ
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-4">
                      <div className="min-w-0 rounded-xl bg-gray-50 p-3.5">
                        <p className="truncate text-xs text-gray-500">
                          อยู่บนรถตอนนี้
                        </p>
                        <p className="mt-1 truncate whitespace-nowrap text-lg font-bold text-[#6b857a] sm:text-2xl">
                          {selectedBus.checkedInCount}{" "}
                          <span className="text-sm font-normal text-gray-500">
                            / {assignedCount} คน
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-gray-400">
                          เช็คชื่อขึ้นรถแล้ว
                        </p>
                      </div>
                      <div className="min-w-0 rounded-xl bg-gray-50 p-3.5">
                        <p className="truncate text-xs text-gray-500">
                          สถานะรถ
                        </p>
                        <p
                          className={`mt-1 truncate whitespace-nowrap text-lg font-medium sm:text-2xl ${
                            selectedBus.status === "TRAVELING"
                              ? "text-blue-600"
                              : "text-green-600"
                          }`}
                        >
                          {selectedBus.status === "TRAVELING"
                            ? "กำลังเดินทาง"
                            : "จอด"}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-gray-400">
                          {selectedBus.status === "TRAVELING"
                            ? "อยู่ระหว่างเดินทาง"
                            : "พร้อมรับผู้โดยสาร"}
                        </p>
                      </div>
                    </div>
                    {selectedClassroom && (
                      <div className="mt-3 rounded-xl border border-[#dce8e0] bg-[#f7faf8] px-3.5 py-2.5 text-sm text-[#365f4f]">
                        จัดนักเรียนห้องนี้แล้ว{" "}
                        <span className="font-bold">
                          {classroomAssignedStudentCount}/
                          {selectedClassroom.studentCount} คน
                        </span>
                        {" · "}เหลือ{" "}
                        <span className="font-bold">
                          {classroomRemainingStudentCount} คน
                        </span>
                        {selectedClassroom.busCount > 1 && (
                          <span className="text-gray-500">
                            {" · "}กระจายในรถ {selectedClassroom.busCount} คัน
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {currentTeacherAssignment && (
                    <div className="rounded-2xl border border-[#cfe0d6] bg-[#eef6f1] p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#365f4f]">
                            สถานะขึ้นรถของฉัน
                          </p>
                          <p className="mt-1 text-xs text-gray-600">
                            ที่นั่ง{" "}
                            {currentTeacherAssignment.positionLabel ||
                              "ยังไม่ระบุ"}
                            {floorSuffix(
                              currentTeacherAssignment.floorNumber,
                              selectedBus.floorCount,
                            )}
                            {" · "}
                            {currentTeacherAssignment.status === "ON_BUS"
                              ? "อยู่บนรถ"
                              : "ยังไม่อยู่บนรถ"}
                          </p>
                        </div>
                        <Button
                          className={
                            currentTeacherAssignment.status === "ON_BUS"
                              ? "bg-white font-semibold text-[#365f4f]"
                              : "bg-[#365f4f] font-semibold text-white"
                          }
                          isDisabled={
                            selectedBus.status === "TRAVELING" ||
                            changingTeacherSelfStatus
                          }
                          isLoading={changingTeacherSelfStatus}
                          startContent={
                            currentTeacherAssignment.status === "ON_BUS" ? (
                              <LogOut size={16} />
                            ) : (
                              <LogIn size={16} />
                            )
                          }
                          onPress={() => void changeOwnTeacherBusStatus()}
                        >
                          {selectedBus.status === "TRAVELING"
                            ? "เปลี่ยนได้เมื่อรถจอด"
                            : currentTeacherAssignment.status === "ON_BUS"
                              ? "ยืนยันว่าลงรถ"
                              : "ยืนยันว่าขึ้นรถ"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedBus.permissions.canOperate && (
                    <div className="rounded-2xl border border-[#cfe0d6] bg-white p-4 shadow-sm">
                      <Button
                        aria-expanded={showReminderOptions}
                        className="min-h-11 w-full justify-between bg-[#f1f7f4] px-4 font-semibold text-[#365f4f]"
                        endContent={
                          <ChevronDown
                            className={`transition-transform ${showReminderOptions ? "rotate-180" : ""}`}
                            size={17}
                          />
                        }
                        isDisabled={
                          selectedBus.status === "TRAVELING" ||
                          busStudentCounts.on + busStudentCounts.off === 0
                        }
                        startContent={<BellRing size={17} />}
                        onPress={() =>
                          setShowReminderOptions((current) => !current)
                        }
                      >
                        {selectedBus.status === "TRAVELING"
                          ? "ส่งเตือนได้เมื่อรถจอด"
                          : "เตือนนักเรียนให้กดขึ้น–ลงรถ"}
                      </Button>

                      {showReminderOptions &&
                        selectedBus.status === "PARKED" && (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <button
                              className="rounded-xl border border-[#cfe0d6] bg-[#f7faf8] p-3 text-left transition hover:border-[#6b857a] disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={
                                busStudentCounts.off === 0 ||
                                sendingReminderAction !== null ||
                                recentlySentReminderActions.includes("board")
                              }
                              type="button"
                              onClick={() => requestStudentBusReminder("board")}
                            >
                              <span className="block text-sm font-bold text-gray-900">
                                เตือนให้กดขึ้นรถ
                              </span>
                              <span className="mt-1 block text-xs text-gray-500">
                                {busStudentCounts.off === 0
                                  ? "นักเรียนขึ้นรถครบแล้ว"
                                  : `ยังไม่ยืนยัน ${busStudentCounts.off} คน`}
                              </span>
                            </button>
                            <button
                              className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-left transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={
                                busStudentCounts.on === 0 ||
                                sendingReminderAction !== null ||
                                recentlySentReminderActions.includes("alight")
                              }
                              type="button"
                              onClick={() =>
                                requestStudentBusReminder("alight")
                              }
                            >
                              <span className="block text-sm font-bold text-gray-900">
                                เตือนให้กดลงรถ
                              </span>
                              <span className="mt-1 block text-xs text-gray-500">
                                {busStudentCounts.on === 0
                                  ? "ไม่มีนักเรียนอยู่บนรถ"
                                  : `ยังอยู่บนรถ ${busStudentCounts.on} คน`}
                              </span>
                            </button>
                            <p className="text-[11px] leading-relaxed text-gray-500 sm:col-span-2">
                              แจ้งเฉพาะนักเรียนที่ยังต้องกด และส่งซ้ำได้ทุก 1 นาที
                            </p>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Operation Bar */}
                  <div className="sticky top-0 z-10 -mx-1 rounded-2xl border border-[#d8e5de] bg-[#f7faf8]/95 p-3 shadow-sm backdrop-blur sm:static sm:mx-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            selectedBus.status === "TRAVELING"
                              ? "bg-blue-100 text-blue-600"
                              : "bg-green-100 text-green-600"
                          }`}
                        >
                          <Bus size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-gray-900">
                            การดำเนินการรถ (
                            {selectedBus.status === "TRAVELING"
                              ? "กำลังเดินทาง"
                              : "รถจอดอยู่"}{" "}
                            · อยู่บนรถ {selectedBus.checkedInCount}/
                            {assignedCount} คน)
                          </p>
                          <p className="truncate text-[11px] text-gray-500">
                            {selectedBus.name} ·{" "}
                            {gradeLabel(selectedBus.classroom.grade)} ห้อง{" "}
                            {selectedBus.classroom.roomName}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {selectedBus.lastDepartedAt !== null && (
                          <Button
                            isIconOnly
                            aria-label="ดูประวัติการเดินทาง"
                            className="min-h-11 min-w-11 bg-gray-100 px-3 text-xs font-medium text-gray-600"
                            size="sm"
                            title="ประวัติการเดินทาง"
                            onPress={() =>
                              void fetchTripHistory(selectedBus.busId)
                            }
                          >
                            <History size={17} />
                          </Button>
                        )}
                        <Button
                          className={
                            selectedBus.status === "TRAVELING"
                              ? "min-h-11 min-w-[118px] shrink-0 bg-amber-100 px-3 text-xs font-medium text-amber-800"
                              : "min-h-11 min-w-[118px] shrink-0 bg-[#365f4f] px-3 text-xs font-medium text-white"
                          }
                          isDisabled={
                            savingAction !== null ||
                            !hasAssignedSeat ||
                            !selectedBus.permissions.canOperate
                          }
                          isLoading={savingAction === "status"}
                          size="sm"
                          onPress={requestBusStatusChange}
                        >
                          {selectedBus.status === "TRAVELING"
                            ? "รถถึงจุดแวะ"
                            : "เริ่มเดินทาง"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="flex items-center gap-2 font-bold text-gray-900">
                          <MapPin className="text-[#6b857a]" size={18} />
                          ผังตำแหน่งบนรถ
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          {selectedBus.permissions.canConfigure
                            ? "คลิกตำแหน่ง แล้วเลือกนักเรียนหรือครูที่นั่งตรงนั้น"
                            : "ดูตำแหน่งและสถานะผู้โดยสารของรถคันนี้"}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-400">
                          {selectedLayoutTemplate ||
                          selectedBus.layoutTemplateName
                            ? `ใช้เทมเพลต ${selectedLayoutTemplate?.name || selectedBus.layoutTemplateName} · หมายเลขที่นั่งตามผังจริง`
                            : "บันทึกผังครั้งแรก = อยู่บนรถแล้ว · A/D ติดหน้าต่าง · B/C ติดทางเดิน"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded-full bg-[#e8f2ed] px-2.5 py-1 font-semibold text-[#365f4f]">
                            จัดที่นั่งแล้ว {assignedCount} คน
                          </span>
                          {unassignedStudents?.length ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                              ยังไม่ได้จัด {unassignedStudents.length} คน
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-500">
                              จัดที่นั่งครบแล้ว
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedBus.floorCount > 1 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedBus.floors
                            .slice()
                            .sort((a, b) => b.floorNumber - a.floorNumber)
                            .map((floor) => (
                              <button
                                key={floor.floorId}
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${selectedFloor === floor.floorNumber ? "bg-[#6b857a] text-white" : "bg-gray-100 text-gray-600"}`}
                                onClick={() =>
                                  setSelectedFloor(floor.floorNumber)
                                }
                              >
                                {floorLabel(
                                  floor.floorNumber,
                                  selectedBus.floorCount,
                                )}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    {currentFloor && (
                      <div className="mt-5 overflow-x-auto">
                        <div
                          className={`mx-auto min-w-[330px] max-w-xl ${
                            isFreeformBusLayout
                              ? ""
                              : "rounded-[2.5rem] border-4 border-[#5f806f] bg-[#fbfcfb] p-4 sm:p-6"
                          }`}
                        >
                          {!isFreeformBusLayout && (
                            <div className="mb-5 rounded-2xl bg-[#deebe4] px-3 py-2 text-center text-xs font-bold text-[#365f4f] sm:text-sm">
                              ด้านหน้ารถ / คนขับ
                            </div>
                          )}
                          <div
                            className={
                              isFreeformBusLayout
                                ? ""
                                : "space-y-2 sm:space-y-3"
                            }
                          >
                            {isFreeformBusLayout &&
                            currentFloor.canvasColumns &&
                            currentFloor.canvasRows ? (
                              <FreeformFloorCanvas
                                floor={currentFloor}
                                renderPosition={(position) => {
                                  const assignmentId = Object.entries(
                                    draftAssignments,
                                  ).find(
                                    ([, positionId]) =>
                                      positionId === position.positionId,
                                  )?.[0];
                                  const assignment = assignmentId
                                    ? assignmentById.get(Number(assignmentId))
                                    : null;
                                  const teacherId = Object.entries(
                                    draftTeacherAssignments,
                                  ).find(
                                    ([, positionId]) =>
                                      positionId === position.positionId,
                                  )?.[0];
                                  const teacherAssignment = teacherId
                                    ? selectedBus.teacherAssignments.find(
                                        (item) =>
                                          item.teacherId === Number(teacherId),
                                      ) || null
                                    : null;
                                  const teacherPassenger = teacherId
                                    ? eligibleTeachers.find(
                                        (item) =>
                                          item.teacherId === Number(teacherId),
                                      ) || teacherAssignment
                                    : null;
                                  const isOnBus = assignment
                                    ? assignment.status === "ON_BUS"
                                    : teacherAssignment?.status === "ON_BUS";

                                  return (
                                    <BusSeatCard
                                      fillContainer
                                      disabled={
                                        savingAction !== null ||
                                        !selectedBus.permissions.canConfigure
                                      }
                                      isOnBus={Boolean(isOnBus)}
                                      label={position.label}
                                      occupant={seatOccupant(
                                        assignment,
                                        teacherPassenger,
                                      )}
                                      selected={
                                        selectedPositionId ===
                                        position.positionId
                                      }
                                      onSelect={() =>
                                        setSelectedPositionId(
                                          position.positionId,
                                        )
                                      }
                                    />
                                  );
                                }}
                              />
                            ) : (
                              Array.from(
                                { length: currentFloor.rowCount },
                                (_, rowIndex) => {
                                  const rowPositions =
                                    currentFloor.positions.filter(
                                      (position) =>
                                        position.rowNumber === rowIndex + 1,
                                    );

                                  return (
                                    <div
                                      key={rowIndex}
                                      className="grid grid-cols-[1fr_1fr_0.35fr_1fr_1fr] gap-2 sm:gap-3"
                                    >
                                      {rowPositions.map((position) => {
                                        const assignmentId = Object.entries(
                                          draftAssignments,
                                        ).find(
                                          ([, positionId]) =>
                                            positionId === position.positionId,
                                        )?.[0];
                                        const assignment = assignmentId
                                          ? assignmentById.get(
                                              Number(assignmentId),
                                            )
                                          : null;
                                        const teacherId = Object.entries(
                                          draftTeacherAssignments,
                                        ).find(
                                          ([, positionId]) =>
                                            positionId === position.positionId,
                                        )?.[0];
                                        const teacherAssignment = teacherId
                                          ? selectedBus.teacherAssignments.find(
                                              (item) =>
                                                item.teacherId ===
                                                Number(teacherId),
                                            ) || null
                                          : null;
                                        const teacherPassenger = teacherId
                                          ? eligibleTeachers.find(
                                              (item) =>
                                                item.teacherId ===
                                                Number(teacherId),
                                            ) || teacherAssignment
                                          : null;
                                        const isOnBus = assignment
                                          ? assignment.status === "ON_BUS"
                                          : teacherAssignment?.status ===
                                            "ON_BUS";

                                        return (
                                          <BusSeatCard
                                            key={position.positionId}
                                            className={seatGridColumnClass(
                                              position.seatIndex,
                                            )}
                                            disabled={
                                              savingAction !== null ||
                                              !selectedBus.permissions
                                                .canConfigure
                                            }
                                            isOnBus={Boolean(isOnBus)}
                                            label={position.label}
                                            occupant={seatOccupant(
                                              assignment,
                                              teacherPassenger,
                                            )}
                                            selected={
                                              selectedPositionId ===
                                              position.positionId
                                            }
                                            onSelect={() =>
                                              setSelectedPositionId(
                                                position.positionId,
                                              )
                                            }
                                          />
                                        );
                                      })}
                                    </div>
                                  );
                                },
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedBus.permissions.canConfigure && (
                      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Save size={15} />
                          แก้ไขผังได้ตลอดเวลา
                          {!hasAssignedSeat
                            ? " · ต้องจัดที่นั่งอย่างน้อย 1 คนก่อนบันทึก"
                            : unassignedStudents?.length
                              ? ` · เหลือ ${unassignedStudents.length} คน รอยืนยันว่าไม่ร่วมเดินทาง`
                              : " · จัดที่นั่งครบแล้ว"}
                        </div>
                        <div className="flex justify-end gap-2 sm:ml-auto">
                          <Button
                            className="bg-[#365f4f] font-medium text-white"
                            isDisabled={
                              savingAction !== null || !hasAssignedSeat
                            }
                            isLoading={savingAction === "save"}
                            size="sm"
                            startContent={<Save size={15} />}
                            onPress={requestSaveLayout}
                          >
                            บันทึกผัง
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900">
                          รายชื่อนักเรียนบนรถ
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          อยู่บนรถ {busStudentCounts.on} · ไม่อยู่บนรถ{" "}
                          {busStudentCounts.off}
                          {busStudentCounts.notTraveling > 0
                            ? ` · ไม่ร่วมเดินทางต่อ ${busStudentCounts.notTraveling}`
                            : ""}
                          <span className="block">
                            กดปุ่มสถานะเพื่อยืนยันขึ้นหรือลงรถแทนนักเรียน
                          </span>
                        </p>
                      </div>
                      <div className="relative sm:w-64">
                        <Search
                          aria-hidden="true"
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                          size={16}
                        />
                        <input
                          aria-label="ค้นหารายชื่อนักเรียนบนรถ"
                          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#6b857a] focus:ring-2 focus:ring-[#6b857a]/15"
                          placeholder="ค้นหาชื่อ ชื่อเล่น หรือรหัส"
                          value={busStudentSearch}
                          onChange={(event) =>
                            setBusStudentSearch(event.target.value)
                          }
                        />
                      </div>
                    </div>
                    <div
                      aria-label="กรองสถานะนักเรียนบนรถ"
                      className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-[#f4f7f5] p-1"
                      role="tablist"
                    >
                      {(
                        [
                          ["all", "ทั้งหมด", busStudentCounts.all],
                          ["on", "อยู่บนรถ", busStudentCounts.on],
                          ["off", "ไม่อยู่บนรถ", busStudentCounts.off],
                        ] as const
                      ).map(([value, label, count]) => (
                        <button
                          key={value}
                          aria-selected={busStudentStatusFilter === value}
                          className={
                            busStudentStatusFilter === value
                              ? "rounded-lg bg-white px-2 py-2 text-[11px] font-semibold text-[#365f4f] shadow-sm"
                              : "rounded-lg px-2 py-2 text-[11px] font-semibold text-gray-500"
                          }
                          role="tab"
                          type="button"
                          onClick={() => setBusStudentStatusFilter(value)}
                        >
                          {label} ({count})
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-1.5">
                      {filteredBusAssignments.map((assignment) => (
                        <div
                          key={assignment.assignmentId}
                          className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar
                              className="h-9 w-9 shrink-0 border border-[#cbd9d3] bg-[#e8f0ee] text-sm font-medium text-[#3d6357]"
                              name={assignment.firstName.charAt(0) || "?"}
                              src={assignment.profileImageUrl || undefined}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-800">
                                {assignment.studentName}
                              </p>
                              {assignment.nickname && (
                                <p className="truncate text-[11px] text-gray-500">
                                  ชื่อเล่น: {assignment.nickname}
                                </p>
                              )}
                              <p className="truncate text-[10px] text-gray-400">
                                รหัส {assignment.studentId} ·{" "}
                                {assignment.positionLabel || "ยังไม่จัดที่นั่ง"}
                              </p>
                            </div>
                          </div>
                          <div className="flex min-w-0 flex-col items-end gap-1 text-right">
                            <Button
                              aria-label={
                                assignment.participationStatus ===
                                "NOT_TRAVELING"
                                  ? `${assignment.studentName}: ไม่ร่วมเดินทางต่อในค่ายนี้`
                                  : `${assignment.studentName}: กดเปลี่ยนเป็น${assignment.status === "ON_BUS" ? "ไม่อยู่บนรถ" : "อยู่บนรถ"}`
                              }
                              className={
                                assignment.participationStatus ===
                                "NOT_TRAVELING"
                                  ? "h-8 min-w-24 bg-slate-100 px-3 text-[11px] font-semibold text-slate-600"
                                  : assignment.status === "ON_BUS"
                                    ? "h-8 min-w-24 bg-green-100 px-3 text-[11px] font-semibold text-green-700"
                                    : "h-8 min-w-24 bg-yellow-100 px-3 text-[11px] font-semibold text-yellow-700"
                              }
                              isDisabled={
                                selectedBus.status === "TRAVELING" ||
                                changingAssignmentAction !== null ||
                                assignment.participationStatus ===
                                  "NOT_TRAVELING" ||
                                (assignment.status === "OFF_BUS" &&
                                  assignment.positionId === null)
                              }
                              isLoading={
                                changingAssignmentAction?.assignmentId ===
                                  assignment.assignmentId &&
                                changingAssignmentAction.action === "status"
                              }
                              size="sm"
                              variant="flat"
                              onPress={() =>
                                void changeStudentBusStatus(assignment)
                              }
                            >
                              {assignment.participationStatus ===
                              "NOT_TRAVELING"
                                ? "ไม่ร่วมเดินทางต่อ"
                                : assignment.status === "ON_BUS"
                                  ? "อยู่บนรถ"
                                  : "ไม่อยู่บนรถ"}
                            </Button>
                            <p className="max-w-56 text-[9px] leading-snug text-gray-400">
                              {statusEventLabel(assignment.lastStatusEvent)}
                            </p>
                          </div>
                        </div>
                      ))}
                      {filteredBusAssignments.length === 0 && (
                        <p className="px-3 py-5 text-center text-xs text-gray-500">
                          ไม่พบรายชื่อนักเรียนตามเงื่อนไข
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedBus.teacherAssignments.length > 0 && (
                    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-gray-900">
                            รายชื่อครูบนรถ
                          </h3>
                          <p className="mt-1 text-xs text-gray-500">
                            อยู่บนรถ {selectedBus.teacherCheckedInCount} ·
                            ไม่อยู่บนรถ{" "}
                            {selectedBus.assignedTeacherCount -
                              selectedBus.teacherCheckedInCount}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#e8f2ed] px-2.5 py-1 text-xs font-semibold text-[#365f4f]">
                          {selectedBus.assignedTeacherCount} คน
                        </span>
                      </div>
                      <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-1.5">
                        {selectedBus.teacherAssignments.map((assignment) => (
                          <div
                            key={assignment.assignmentId}
                            className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Avatar
                                className="h-9 w-9 shrink-0 border border-[#cbd9d3] bg-[#e8f0ee] text-sm font-medium text-[#3d6357]"
                                name={assignment.firstName.charAt(0) || "?"}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-800">
                                  {assignment.teacherName}
                                  {assignment.isCurrentTeacher ? " (คุณ)" : ""}
                                </p>
                                <p className="truncate text-[10px] text-gray-400">
                                  ที่นั่ง{" "}
                                  {assignment.positionLabel ||
                                    "ยังไม่จัดที่นั่ง"}
                                  {floorSuffix(
                                    assignment.floorNumber,
                                    selectedBus.floorCount,
                                  )}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${assignment.status === "ON_BUS" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                            >
                              {assignment.status === "ON_BUS"
                                ? "อยู่บนรถ"
                                : "ไม่อยู่บนรถ"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">
                    <div className="flex items-start gap-2">
                      <Users className="mt-0.5 shrink-0" size={16} />
                      <span>
                        การบันทึกผังครั้งแรกจะถือว่านักเรียนที่มีที่นั่งอยู่บนรถแล้ว
                        ในแต่ละรอบ ครูหรือนักเรียนกดยืนยันขึ้น–ลงรถได้
                        ระบบจะแสดงผู้กดและเวลาล่าสุดให้ตรวจสอบ
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
                  <Bus className="mx-auto mb-3 text-gray-300" size={42} />
                  <p className="font-bold text-gray-700">
                    เลือกหรือสร้างรถเพื่อเริ่มจัดผัง
                  </p>
                </div>
              )}
            </div>
          )}
        </Body>

        <Modal
          classNames={{
            wrapper: "z-[1200]",
            base: "z-[1200] rounded-3xl",
            backdrop: "z-[1190]",
            header: "border-b border-gray-100 px-5 py-4",
            body: "p-5",
            footer: "border-t border-gray-100 px-5 py-4",
          }}
          isOpen={showUnassignedConfirm}
          placement="center"
          size="sm"
          onOpenChange={setShowUnassignedConfirm}
        >
          <ModalContent>
            <ModalHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <AlertTriangle size={20} />
                </div>
                <p className="text-lg font-bold text-gray-900">
                  ยืนยันรายชื่อที่ไม่ร่วมเดินทาง
                </p>
              </div>
            </ModalHeader>
            <ModalBody>
              <p className="text-sm leading-relaxed text-gray-700">
                นักเรียนต่อไปนี้ยังไม่ได้จัดที่นั่ง
                ระบบจะถือว่าไม่ร่วมเดินทางในเที่ยวนี้
              </p>
              <div className="mt-3 max-h-56 overflow-y-auto rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                {unassignedStudents?.map((assignment) => (
                  <p key={assignment.assignmentId}>{assignment.studentName}</p>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-gray-500">
                {selectedBus?.lastDepartedAt === null
                  ? "ผู้ที่จัดที่นั่งแล้วจะถูกเช็คชื่อว่าอยู่บนรถ ส่วนรายชื่อข้างต้นจะไม่ถูกนับรวมในเที่ยวนี้"
                  : "รายชื่อข้างต้นจะไม่ถูกนับรวมในเที่ยวนี้ ครูหรือนักเรียนสามารถกดยืนยันขึ้นรถในรอบนี้ได้"}
              </p>
            </ModalBody>
            <ModalFooter className="flex justify-end gap-2">
              <Button
                className="font-medium text-gray-600"
                isDisabled={savingAction !== null}
                variant="light"
                onPress={() => setShowUnassignedConfirm(false)}
              >
                กลับไปจัดที่นั่ง
              </Button>
              <Button
                className="bg-[#365f4f] font-medium text-white"
                isLoading={savingAction === "save"}
                onPress={() => void saveLayout()}
              >
                ยืนยันและบันทึกผัง
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal
          classNames={{
            base: "rounded-3xl",
            header: "border-b border-gray-100 px-5 py-4",
            body: "bg-[#f7faf8] p-5",
            footer: "border-t border-gray-100 px-5 py-4",
          }}
          isOpen={showTransfer}
          placement="center"
          scrollBehavior="inside"
          size="lg"
          onOpenChange={setShowTransfer}
        >
          <ModalContent>
            <ModalHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">
                    ย้ายนักเรียนไปยังรถคันอื่น
                  </p>
                  <p className="mt-1 text-xs font-normal text-gray-500">
                    ใช้แบ่งนักเรียนระหว่างรถ หรือย้ายออกจากรถที่เสียกลางทาง
                  </p>
                </div>
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <Select
                  aria-label="รถปลายทาง"
                  classNames={{
                    trigger:
                      "min-h-16 border-2 border-amber-300 bg-amber-50 px-4 shadow-sm data-[hover=true]:border-amber-400 data-[open=true]:border-amber-500",
                    label: "font-semibold text-amber-800",
                    value: "font-bold text-gray-900",
                  }}
                  label="รถปลายทาง"
                  placeholder="เลือกรถปลายทาง"
                  selectedKeys={
                    transferTargetBusId
                      ? new Set([transferTargetBusId])
                      : new Set()
                  }
                  onSelectionChange={(keys) => {
                    const value = String(Array.from(keys)[0] || "");
                    const target = transferTargetBuses.find(
                      (bus) => bus.busId === Number(value),
                    );
                    const available = target?.availableCapacity || 0;

                    setTransferTargetBusId(value);
                    setTransferStudentEnrollmentIds((current) =>
                      current.slice(0, available),
                    );
                  }}
                >
                  {transferTargetBuses.map((bus) => {
                    const available = bus.availableCapacity;

                    return (
                      <SelectItem
                        key={bus.busId}
                        textValue={`${bus.name} เหลือ ${available} ที่`}
                      >
                        {bus.name} · เหลือ {available} ที่
                      </SelectItem>
                    );
                  })}
                </Select>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                  <span>
                    เลือกแล้ว {transferStudentEnrollmentIds.length} คน ·
                    รถปลายทางรับได้อีก {transferTargetAvailableCapacity} คน
                  </span>
                  <Button
                    className="shrink-0 bg-white font-semibold text-amber-800"
                    isDisabled={transferTargetAvailableCapacity === 0}
                    size="sm"
                    onPress={() =>
                      setTransferStudentEnrollmentIds(
                        areAllTransferStudentsSelected
                          ? []
                          : (selectedBus?.assignments || [])
                              .slice(0, transferTargetAvailableCapacity)
                              .map(
                                (assignment) => assignment.studentEnrollmentId,
                              ),
                      )
                    }
                  >
                    {areAllTransferStudentsSelected
                      ? "ยกเลิกทั้งหมด"
                      : "เลือกทั้งหมด"}
                  </Button>
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3">
                  {(selectedBus?.assignments || []).map((assignment) => {
                    const isSelected = transferStudentEnrollmentIds.includes(
                      assignment.studentEnrollmentId,
                    );
                    const selectionFull =
                      !isSelected &&
                      transferStudentEnrollmentIds.length >=
                        transferTargetAvailableCapacity;

                    return (
                      <label
                        key={assignment.assignmentId}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                          isSelected
                            ? "border-amber-300 bg-amber-50"
                            : "border-gray-100 bg-gray-50"
                        } ${selectionFull ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                      >
                        <input
                          checked={isSelected}
                          className="h-4 w-4 accent-amber-700"
                          disabled={selectionFull}
                          type="checkbox"
                          onChange={(event) =>
                            setTransferStudentEnrollmentIds((current) =>
                              event.target.checked
                                ? [...current, assignment.studentEnrollmentId]
                                : current.filter(
                                    (id) =>
                                      id !== assignment.studentEnrollmentId,
                                  ),
                            )
                          }
                        />
                        <Avatar
                          className="h-8 w-8 shrink-0 bg-[#e2eee7] text-[#365f4f]"
                          fallback={
                            <StudentAvatarFallback
                              prefixName={assignment.prefixName}
                              size="sm"
                            />
                          }
                          src={assignment.profileImageUrl || undefined}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-gray-800">
                            {assignment.studentName}
                          </span>
                          <span className="block text-[11px] text-gray-500">
                            {assignment.positionLabel
                              ? `ที่นั่ง ${assignment.positionLabel}`
                              : "ยังไม่ได้จัดที่นั่ง"}
                            {assignment.status === "ON_BUS"
                              ? " · อยู่บนรถตอนนี้"
                              : ""}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="flex justify-end gap-2">
              <Button
                isDisabled={savingAction !== null}
                variant="light"
                onPress={() => setShowTransfer(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="bg-amber-700 font-semibold text-white"
                isDisabled={
                  !transferTargetBusId ||
                  transferStudentEnrollmentIds.length === 0 ||
                  transferStudentEnrollmentIds.length >
                    transferTargetAvailableCapacity
                }
                isLoading={savingAction === "transfer"}
                onPress={() => void handleTransferStudents()}
              >
                ย้ายนักเรียน {transferStudentEnrollmentIds.length} คน
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal
          classNames={{
            wrapper: "z-[1100]",
            base: "z-[1100] max-h-[88vh] overflow-hidden rounded-3xl",
            backdrop: "z-[1090]",
            header: "border-b border-gray-100 bg-white px-5 py-4",
            body: "gap-4 bg-[#f7faf8] p-4",
            footer: "border-t border-gray-100 bg-white px-5 py-4",
          }}
          isOpen={selectedPositionId !== null && !showUnassignedConfirm}
          placement="center"
          scrollBehavior="inside"
          size="md"
          onOpenChange={(open) => {
            if (!open && !showUnassignedConfirm) {
              setDraftAssignments(
                Object.fromEntries(
                  (selectedBus?.assignments || []).map((assignment) => [
                    assignment.assignmentId,
                    assignment.positionId,
                  ]),
                ),
              );
              setDraftTeacherAssignments(
                Object.fromEntries(
                  (selectedBus?.teacherAssignments || []).map((assignment) => [
                    assignment.teacherId,
                    assignment.positionId,
                  ]),
                ),
              );
              setSelectedPositionId(null);
            }
          }}
        >
          <ModalContent>
            <ModalHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#e2eee7] text-[#365f4f]">
                  <MapPin size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900">
                    จัดที่นั่งผู้โดยสาร
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#365f4f]">
                    {selectedPosition?.label || "ที่เลือก"}
                    {hasMultipleFloors
                      ? " · " +
                        floorLabel(selectedFloor, selectedBus?.floorCount || 1)
                      : ""}
                  </p>
                </div>
              </div>
            </ModalHeader>
            <ModalBody>
              {activeAssignment && (
                <div className="rounded-xl border border-[#dce8e0] bg-white px-3 py-2.5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar
                        className="h-9 w-9 shrink-0 border border-[#cbd9d3] bg-[#e8f0ee] text-sm font-medium text-[#3d6357]"
                        name={activeAssignment.firstName.charAt(0) || "?"}
                        src={activeAssignment.profileImageUrl || undefined}
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-500">
                          นักเรียนประจำที่นั่งนี้
                        </p>
                        <p className="mt-0.5 break-words text-xs font-semibold text-gray-900">
                          {activeAssignment.studentId} ·{" "}
                          {activeAssignment.studentName}
                        </p>
                        {activeAssignment.nickname && (
                          <p className="mt-0.5 truncate text-[10px] text-gray-500">
                            ชื่อเล่น: {activeAssignment.nickname}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${activeAssignment.status === "ON_BUS" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                    >
                      {activeAssignment.status === "ON_BUS"
                        ? "อยู่บนรถ"
                        : "ไม่อยู่บนรถ"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
                    {statusEventLabel(activeAssignment.lastStatusEvent)}
                  </p>
                  <Button
                    aria-label={`${activeAssignment.studentName}: กดเปลี่ยนเป็น${activeAssignment.status === "ON_BUS" ? "ไม่อยู่บนรถ" : "อยู่บนรถ"}`}
                    className={
                      activeAssignment.status === "ON_BUS"
                        ? "mt-3 w-full bg-gray-100 font-semibold text-gray-700"
                        : "mt-3 w-full bg-[#365f4f] font-semibold text-white"
                    }
                    isDisabled={
                      selectedBus?.status === "TRAVELING" ||
                      changingAssignmentAction !== null
                    }
                    isLoading={
                      changingAssignmentAction?.assignmentId ===
                        activeAssignment.assignmentId &&
                      changingAssignmentAction.action === "status"
                    }
                    size="sm"
                    onPress={() =>
                      void changeStudentBusStatus(activeAssignment)
                    }
                  >
                    {selectedBus?.status === "TRAVELING"
                      ? "เปลี่ยนสถานะได้เมื่อรถจอด"
                      : activeAssignment.status === "ON_BUS"
                        ? "กดยืนยันว่าลงจากรถ"
                        : "กดยืนยันว่าขึ้นรถ"}
                  </Button>
                </div>
              )}

              {activeTeacher && (
                <div className="rounded-xl border border-[#dce8e0] bg-white px-3 py-2.5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar
                        className="h-9 w-9 shrink-0 border border-[#cbd9d3] bg-[#e8f0ee] text-sm font-medium text-[#3d6357]"
                        name={activeTeacher.firstName.charAt(0) || "?"}
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-500">
                          ครูประจำที่นั่งนี้
                        </p>
                        <p className="mt-0.5 break-words text-xs font-semibold text-gray-900">
                          {activeTeacher.teacherName}
                        </p>
                        {activeTeacher.email && (
                          <p className="mt-0.5 truncate text-[10px] text-gray-500">
                            {activeTeacher.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${activeTeacherAssignment?.status === "ON_BUS" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                    >
                      {activeTeacherAssignment
                        ? activeTeacherAssignment.status === "ON_BUS"
                          ? "อยู่บนรถ"
                          : "ไม่อยู่บนรถ"
                        : "รอบันทึก"}
                    </span>
                  </div>
                  {activeTeacherAssignment && (
                    <>
                      <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
                        {statusEventLabel(
                          activeTeacherAssignment.lastStatusEvent,
                        )}
                      </p>
                      <Button
                        aria-label={`${activeTeacherAssignment.teacherName}: กดเปลี่ยนเป็น${activeTeacherAssignment.status === "ON_BUS" ? "ไม่อยู่บนรถ" : "อยู่บนรถ"}`}
                        className={
                          activeTeacherAssignment.status === "ON_BUS"
                            ? "mt-3 w-full bg-gray-100 font-semibold text-gray-700"
                            : "mt-3 w-full bg-[#365f4f] font-semibold text-white"
                        }
                        isDisabled={
                          selectedBus?.status === "TRAVELING" ||
                          !selectedBus?.permissions.canOperate ||
                          changingTeacherAssignmentId !== null ||
                          changingTeacherSelfStatus
                        }
                        isLoading={
                          changingTeacherAssignmentId ===
                          activeTeacherAssignment.assignmentId
                        }
                        size="sm"
                        onPress={() =>
                          void changeTeacherPassengerBusStatus(
                            activeTeacherAssignment,
                          )
                        }
                      >
                        {selectedBus?.status === "TRAVELING"
                          ? "เปลี่ยนสถานะได้เมื่อรถจอด"
                          : activeTeacherAssignment.status === "ON_BUS"
                            ? "กดยืนยันว่าลงจากรถ"
                            : "กดยืนยันว่าขึ้นรถ"}
                      </Button>
                    </>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-[#dce8e0] bg-white p-3 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      พรีวิวผังที่นั่ง
                    </p>
                  </div>
                  {hasMultipleFloors && (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {selectedBus?.floors
                        .slice()
                        .sort((a, b) => b.floorNumber - a.floorNumber)
                        .map((floor) => (
                          <button
                            key={floor.floorId}
                            aria-pressed={selectedFloor === floor.floorNumber}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                              selectedFloor === floor.floorNumber
                                ? "bg-[#365f4f] text-white"
                                : "bg-[#e2eee7] text-[#365f4f] hover:bg-[#cfe0d6]"
                            }`}
                            type="button"
                            onClick={() => setSelectedFloor(floor.floorNumber)}
                          >
                            {floorLabel(
                              floor.floorNumber,
                              selectedBus?.floorCount || 1,
                            )}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto rounded-xl bg-[#f7faf8] p-2">
                  {currentFloor ? (
                    <div
                      className={`space-y-1.5 ${
                        isFreeformBusLayout
                          ? ""
                          : "rounded-2xl border-2 border-[#5f806f] bg-[#fbfcfb] p-2"
                      }`}
                    >
                      {!isFreeformBusLayout && (
                        <div className="rounded-xl bg-[#deebe4] px-2 py-1.5 text-center text-[9px] font-bold text-[#365f4f]">
                          ด้านหน้ารถ / คนขับ
                        </div>
                      )}
                      {isFreeformBusLayout &&
                      currentFloor.canvasColumns &&
                      currentFloor.canvasRows ? (
                        <FreeformFloorCanvas
                          compact
                          floor={currentFloor}
                          renderPosition={(position) => {
                            const assignmentId = Object.entries(
                              draftAssignments,
                            ).find(
                              ([, positionId]) =>
                                positionId === position.positionId,
                            )?.[0];
                            const assignment = assignmentId
                              ? assignmentById.get(Number(assignmentId))
                              : null;
                            const teacherId = Object.entries(
                              draftTeacherAssignments,
                            ).find(
                              ([, positionId]) =>
                                positionId === position.positionId,
                            )?.[0];
                            const teacherAssignment = teacherId
                              ? selectedBus?.teacherAssignments.find(
                                  (item) =>
                                    item.teacherId === Number(teacherId),
                                ) || null
                              : null;
                            const teacherPassenger = teacherId
                              ? eligibleTeachers.find(
                                  (item) =>
                                    item.teacherId === Number(teacherId),
                                ) || teacherAssignment
                              : null;
                            const isOnBus = assignment
                              ? assignment.status === "ON_BUS"
                              : teacherAssignment?.status === "ON_BUS";

                            return (
                              <BusSeatCard
                                compact
                                fillContainer
                                disabled={
                                  !selectedBus?.permissions.canConfigure
                                }
                                isOnBus={Boolean(isOnBus)}
                                label={position.label}
                                occupant={seatOccupant(
                                  assignment,
                                  teacherPassenger,
                                )}
                                selected={
                                  selectedPositionId === position.positionId
                                }
                                onSelect={() =>
                                  setSelectedPositionId(position.positionId)
                                }
                              />
                            );
                          }}
                        />
                      ) : (
                        Array.from(
                          { length: currentFloor.rowCount },
                          (_, rowIndex) => {
                            const rowPositions = currentFloor.positions.filter(
                              (position) => position.rowNumber === rowIndex + 1,
                            );

                            return (
                              <div
                                key={rowIndex}
                                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_0.35fr_minmax(0,1fr)_minmax(0,1fr)] gap-1"
                              >
                                {rowPositions.map((position) => {
                                  const assignmentId = Object.entries(
                                    draftAssignments,
                                  ).find(
                                    ([, positionId]) =>
                                      positionId === position.positionId,
                                  )?.[0];
                                  const assignment = assignmentId
                                    ? assignmentById.get(Number(assignmentId))
                                    : null;
                                  const teacherId = Object.entries(
                                    draftTeacherAssignments,
                                  ).find(
                                    ([, positionId]) =>
                                      positionId === position.positionId,
                                  )?.[0];
                                  const teacherAssignment = teacherId
                                    ? selectedBus?.teacherAssignments.find(
                                        (item) =>
                                          item.teacherId === Number(teacherId),
                                      ) || null
                                    : null;
                                  const teacherPassenger = teacherId
                                    ? eligibleTeachers.find(
                                        (item) =>
                                          item.teacherId === Number(teacherId),
                                      ) || teacherAssignment
                                    : null;
                                  const isOnBus = assignment
                                    ? assignment.status === "ON_BUS"
                                    : teacherAssignment?.status === "ON_BUS";

                                  return (
                                    <BusSeatCard
                                      key={position.positionId}
                                      compact
                                      className={seatGridColumnClass(
                                        position.seatIndex,
                                      )}
                                      disabled={
                                        !selectedBus?.permissions.canConfigure
                                      }
                                      isOnBus={Boolean(isOnBus)}
                                      label={position.label}
                                      occupant={seatOccupant(
                                        assignment,
                                        teacherPassenger,
                                      )}
                                      selected={
                                        selectedPositionId ===
                                        position.positionId
                                      }
                                      onSelect={() =>
                                        setSelectedPositionId(
                                          position.positionId,
                                        )
                                      }
                                    />
                                  );
                                })}
                              </div>
                            );
                          },
                        )
                      )}
                    </div>
                  ) : (
                    <p className="py-6 text-center text-xs text-gray-500">
                      ไม่พบผังที่นั่ง
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-4 text-[11px] text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                    อยู่บนรถ
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                    ไม่อยู่บนรถ
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded border-2 border-[#365f4f]" />
                    ที่นั่งที่เลือก
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                {selectedBus?.permissions.canManageTeachers && (
                  <div
                    aria-label="เลือกประเภทผู้โดยสาร"
                    className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-[#f1f5f2] p-1"
                    role="tablist"
                  >
                    {(
                      [
                        ["STUDENT", "นักเรียน", Users],
                        ["TEACHER", "ครู", GraduationCap],
                      ] as const
                    ).map(([value, label, Icon]) => (
                      <button
                        key={value}
                        aria-selected={seatSelectionTab === value}
                        className={
                          seatSelectionTab === value
                            ? "flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-[#365f4f] shadow-sm"
                            : "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-500 transition hover:text-gray-700"
                        }
                        role="tab"
                        type="button"
                        onClick={() => setSeatSelectionTab(value)}
                      >
                        <Icon size={15} />
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {seatSelectionTab === "STUDENT" ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          เลือกนักเรียนสำหรับที่นั่งนี้
                        </p>
                        <p className="mt-1 text-[11px] font-normal text-gray-500">
                          เลือกได้ทั้งนักเรียนบนรถคันนี้และผู้ที่ยังไม่มีรถ
                        </p>
                      </div>
                      {activeAssignment && (
                        <span className="shrink-0 rounded-full bg-[#e2eee7] px-2 py-1 text-[10px] font-semibold text-[#365f4f]">
                          เลือกอยู่
                        </span>
                      )}
                    </div>

                    <div className="relative mt-3">
                      <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={16}
                      />
                      <input
                        aria-label="ค้นหานักเรียน"
                        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm font-normal text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#6b857a] focus:ring-2 focus:ring-[#6b857a]/15"
                        placeholder="ค้นหาชื่อหรือรหัสนักเรียน"
                        value={studentSearch}
                        onChange={(event) =>
                          setStudentSearch(event.target.value)
                        }
                      />
                    </div>

                    {studentSearch.trim() ? (
                      <div className="mt-3 rounded-xl bg-[#e8f2ed] px-3 py-2 text-[11px] font-medium text-[#365f4f]">
                        กำลังค้นหาจากนักเรียนทั้งหมด ระบบจะข้ามตัวกรองสถานะ
                      </div>
                    ) : (
                      <div
                        aria-label="กรองสถานะการลงทะเบียน"
                        className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-[#f4f7f5] p-1"
                        role="tablist"
                      >
                        {(
                          [
                            [
                              "registered",
                              "ลงทะเบียนแล้ว",
                              studentCounts.registered,
                            ],
                            ["all", "ทั้งหมด", studentCounts.all],
                            [
                              "unregistered",
                              "ยังไม่ลงทะเบียน",
                              studentCounts.unregistered,
                            ],
                          ] as const
                        ).map(([value, label, count]) => (
                          <button
                            key={value}
                            aria-selected={studentStatusFilter === value}
                            className={
                              studentStatusFilter === value
                                ? "rounded-lg bg-white px-2 py-2 text-[11px] font-semibold text-[#365f4f] shadow-sm"
                                : "rounded-lg px-2 py-2 text-[11px] font-semibold text-gray-500 transition hover:text-gray-700"
                            }
                            role="tab"
                            type="button"
                            onClick={() => setStudentStatusFilter(value)}
                          >
                            {label} ({count})
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 h-56 space-y-1 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-1.5">
                      <button
                        className={
                          !activeAssignment && !activeTeacher
                            ? "flex h-10 min-h-10 w-full items-center justify-between rounded-lg bg-[#e2eee7] px-3 py-0 text-left text-xs font-semibold text-[#365f4f]"
                            : "flex h-10 min-h-10 w-full items-center justify-between rounded-lg px-3 py-0 text-left text-xs text-gray-600 transition hover:bg-white"
                        }
                        type="button"
                        onClick={() => {
                          if (selectedPositionId !== null)
                            setStudentAtPosition(selectedPositionId, null);
                        }}
                      >
                        <span>-- ว่าง --</span>
                        {!activeAssignment && !activeTeacher && <span>✓</span>}
                      </button>

                      {filteredAssignments.map((assignment) => {
                        const isAlreadySeated = seatedAssignmentIds.has(
                          assignment.assignmentId,
                        );
                        const isPendingCapacityFull =
                          Boolean(assignment.isPendingBusAssignment) &&
                          !isAlreadySeated &&
                          pendingBusAssignmentCount >=
                            selectedBusAvailableCapacity;

                        return (
                          <button
                            key={assignment.assignmentId}
                            className={
                              isAlreadySeated || isPendingCapacityFull
                                ? "flex min-h-12 w-full cursor-not-allowed items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-left text-gray-400"
                                : "flex min-h-12 w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-gray-700 transition hover:bg-white"
                            }
                            disabled={isAlreadySeated || isPendingCapacityFull}
                            type="button"
                            onClick={() => {
                              if (
                                selectedPositionId !== null &&
                                !isAlreadySeated &&
                                !isPendingCapacityFull
                              ) {
                                setStudentAtPosition(
                                  selectedPositionId,
                                  assignment.assignmentId,
                                );
                              }
                            }}
                          >
                            <Avatar
                              className="h-7 w-7 shrink-0 border border-[#cbd9d3] bg-[#e8f0ee] text-xs font-medium text-[#3d6357]"
                              name={assignment.firstName.charAt(0) || "?"}
                              src={assignment.profileImageUrl || undefined}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium">
                                {assignment.studentName}
                              </span>
                              <span className="block truncate text-[10px] text-gray-500">
                                รหัส {assignment.studentId}
                                {assignment.nickname
                                  ? ` · ชื่อเล่น: ${assignment.nickname}`
                                  : ""}
                                {assignment.isPendingBusAssignment &&
                                assignment.sourceClassroom
                                  ? ` · ${gradeLabel(assignment.sourceClassroom.grade)} ห้อง ${assignment.sourceClassroom.roomName} · ยังไม่มีรถ`
                                  : ""}
                              </span>
                            </span>
                            {isAlreadySeated && (
                              <span className="shrink-0 text-[10px] font-semibold text-gray-500">
                                มีที่นั่งแล้ว
                              </span>
                            )}
                            {isPendingCapacityFull && (
                              <span className="shrink-0 text-[10px] font-semibold text-gray-500">
                                รถเต็ม
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {filteredAssignments.length === 0 && (
                        <p className="px-3 py-5 text-center text-xs text-gray-500">
                          {!studentSearch.trim() && allStudentsHaveSeats
                            ? "นักเรียนทุกคนมีที่นั่งแล้ว"
                            : "ไม่พบรายชื่อนักเรียนตามเงื่อนไข"}
                        </p>
                      )}
                    </div>

                    <p className="mt-2 text-[11px] font-normal text-gray-500">
                      นักเรียนที่ยังไม่ลงทะเบียนจะถูกผูกที่นั่งไว้ก่อนเท่านั้น
                      เมื่อลงทะเบียนแล้วจะกดขึ้นรถได้ทันที
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          เลือกครูสำหรับที่นั่งนี้
                        </p>
                        <p className="mt-1 text-[11px] font-normal text-gray-500">
                          เลือกครูที่ยังใช้งานอยู่ได้ทุกคนในระบบ
                        </p>
                      </div>
                      {activeTeacher && (
                        <span className="shrink-0 rounded-full bg-[#e2eee7] px-2 py-1 text-[10px] font-semibold text-[#365f4f]">
                          เลือกอยู่
                        </span>
                      )}
                    </div>

                    <div className="relative mt-3">
                      <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={16}
                      />
                      <input
                        aria-label="ค้นหาครู"
                        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm font-normal text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#6b857a] focus:ring-2 focus:ring-[#6b857a]/15"
                        placeholder="ค้นหาชื่อ อีเมล หรือรหัสครู"
                        value={teacherSearch}
                        onChange={(event) =>
                          setTeacherSearch(event.target.value)
                        }
                      />
                    </div>

                    <div className="mt-3 h-56 space-y-1 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-1.5">
                      <button
                        className={
                          !activeAssignment && !activeTeacher
                            ? "flex h-10 min-h-10 w-full items-center justify-between rounded-lg bg-[#e2eee7] px-3 py-0 text-left text-xs font-semibold text-[#365f4f]"
                            : "flex h-10 min-h-10 w-full items-center justify-between rounded-lg px-3 py-0 text-left text-xs text-gray-600 transition hover:bg-white"
                        }
                        type="button"
                        onClick={() => {
                          if (selectedPositionId !== null)
                            setTeacherAtPosition(selectedPositionId, null);
                        }}
                      >
                        <span>-- ว่าง --</span>
                        {!activeAssignment && !activeTeacher && <span>✓</span>}
                      </button>

                      {filteredTeachers.map((teacher) => {
                        const isAlreadySeated = seatedTeacherIds.has(
                          teacher.teacherId,
                        );
                        const isOnAnotherBus = Boolean(
                          teacher.assignedBus &&
                            teacher.assignedBus.busId !== selectedBus?.busId,
                        );
                        const disabled = isAlreadySeated || isOnAnotherBus;

                        return (
                          <button
                            key={teacher.teacherId}
                            className={
                              disabled
                                ? "flex min-h-12 w-full cursor-not-allowed items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-left text-gray-400"
                                : "flex min-h-12 w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-gray-700 transition hover:bg-white"
                            }
                            disabled={disabled}
                            type="button"
                            onClick={() => {
                              if (selectedPositionId !== null && !disabled) {
                                setTeacherAtPosition(
                                  selectedPositionId,
                                  teacher.teacherId,
                                );
                              }
                            }}
                          >
                            <Avatar
                              className="h-7 w-7 shrink-0 border border-[#cbd9d3] bg-[#e8f0ee] text-xs font-medium text-[#3d6357]"
                              name={teacher.firstName.charAt(0) || "?"}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium">
                                {teacher.teacherName}
                              </span>
                              <span className="block truncate text-[10px] text-gray-500">
                                {teacher.email ||
                                  `รหัสครู ${teacher.teacherId}`}
                              </span>
                            </span>
                            {isAlreadySeated && (
                              <span className="shrink-0 text-[10px] font-semibold text-gray-500">
                                มีที่นั่งแล้ว
                              </span>
                            )}
                            {isOnAnotherBus && (
                              <span className="max-w-24 shrink-0 truncate text-[10px] font-semibold text-amber-700">
                                อยู่ {teacher.assignedBus?.busName}
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {filteredTeachers.length === 0 && (
                        <p className="px-3 py-5 text-center text-xs text-gray-500">
                          ไม่พบรายชื่อครูตามเงื่อนไข
                        </p>
                      )}
                    </div>

                    <p className="mt-2 text-[11px] font-normal text-gray-500">
                      เมื่อบันทึกแล้ว ครูจะกดขึ้น–ลงรถและควบคุมรถคันนี้ได้
                    </p>
                  </>
                )}
              </div>
            </ModalBody>
            <ModalFooter className="flex flex-col gap-2">
              <div className="flex w-full gap-2">
                <Button
                  className="flex-1 font-medium text-gray-700"
                  isDisabled={selectedPositionIndex <= 0}
                  startContent={<ChevronLeft size={16} />}
                  variant="flat"
                  onPress={() => moveToSeat(-1)}
                >
                  ที่นั่งก่อนหน้า
                </Button>
                <Button
                  className="flex-1 bg-[#e2eee7] font-medium text-[#365f4f]"
                  endContent={<ChevronRight size={16} />}
                  isDisabled={
                    selectedPositionIndex < 0 ||
                    selectedPositionIndex >= orderedPositions.length - 1
                  }
                  onPress={() => moveToSeat(1)}
                >
                  ที่นั่งถัดไป
                </Button>
              </div>
              <Button
                className="w-full bg-[#365f4f] font-semibold text-white"
                isDisabled={savingAction !== null || !hasAssignedSeat}
                isLoading={savingAction === "save"}
                startContent={<Save size={16} />}
                onPress={requestSaveLayout}
              >
                บันทึกผัง
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal
          classNames={{
            base: "rounded-3xl",
            header: "border-b border-gray-100 px-5 py-4",
            body: "p-5",
            footer: "border-t border-gray-100 px-5 py-4",
          }}
          isOpen={pendingBusStatus !== null}
          placement="center"
          size="sm"
          onOpenChange={(open) => {
            if (!open && savingAction !== "status") {
              setPendingBusStatus(null);
              setParkClearPassengers(null);
            }
          }}
        >
          <ModalContent>
            <ModalHeader>
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                    pendingBusStatus === "TRAVELING"
                      ? "bg-[#e2eee7] text-[#365f4f]"
                      : "bg-[#e8f2ed] text-[#3d6357]"
                  }`}
                >
                  {pendingBusStatus === "TRAVELING" ? (
                    <Bus size={20} />
                  ) : (
                    <MapPin size={20} />
                  )}
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {pendingBusStatus === "TRAVELING"
                    ? "ยืนยันเริ่มเดินทาง"
                    : "รถถึงจุดแวะแล้ว"}
                </p>
              </div>
            </ModalHeader>
            <ModalBody>
              {pendingBusStatus === "TRAVELING" ? (
                <div className="space-y-3 text-sm leading-relaxed text-gray-700">
                  <div>
                    <p className="font-semibold text-gray-900">
                      ตรวจสอบรายชื่อก่อนออกรถ
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      แก้สถานะนักเรียนที่ไม่ได้ขึ้นรถได้จากหน้าต่างนี้เลย
                    </p>
                  </div>

                  {seatedNotBoardedAssignments.length > 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">
                          ต้องตรวจสอบก่อนออกรถ · มีที่นั่งแต่ยังไม่เช็คชื่อ
                        </p>
                        <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 font-bold text-amber-900">
                          {seatedNotBoardedAssignments.length} คน
                        </span>
                      </div>
                      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto border-t border-amber-200/70 pt-2">
                        {seatedNotBoardedAssignments.map((assignment) => (
                          <div
                            key={assignment.assignmentId}
                            className="rounded-xl border border-amber-200 bg-white/80 p-2.5"
                          >
                            <p>
                              <span className="font-semibold">
                                ที่นั่ง {assignment.positionLabel || "ไม่ทราบ"}
                                {floorSuffix(
                                  assignment.floorNumber,
                                  selectedBus?.floorCount || 1,
                                )}
                              </span>{" "}
                              — {assignment.studentId} ·{" "}
                              {assignment.studentName}
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <Button
                                className="h-8 bg-[#e2eee7] px-2 text-[10px] font-semibold text-[#365f4f]"
                                isDisabled={changingAssignmentAction !== null}
                                isLoading={
                                  changingAssignmentAction?.assignmentId ===
                                    assignment.assignmentId &&
                                  changingAssignmentAction.action === "status"
                                }
                                size="sm"
                                startContent={<Bus size={13} />}
                                onPress={() =>
                                  void changeStudentBusStatus(assignment)
                                }
                              >
                                ยังอยู่บนรถ
                              </Button>
                              <Button
                                className="h-8 bg-gray-100 px-2 text-[10px] font-semibold text-gray-700"
                                isDisabled={changingAssignmentAction !== null}
                                isLoading={
                                  changingAssignmentAction?.assignmentId ===
                                    assignment.assignmentId &&
                                  changingAssignmentAction.action ===
                                    "not_traveling"
                                }
                                size="sm"
                                startContent={<UserCheck size={13} />}
                                onPress={() =>
                                  void changeStudentParticipation(
                                    assignment,
                                    "NOT_TRAVELING",
                                  )
                                }
                              >
                                ไม่ร่วมเดินทางต่อ
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 leading-relaxed text-amber-800">
                        “ยังอยู่บนรถ”
                        ใช้กรณีกดลงรถทุกคนแล้วมีนักเรียนไม่ได้ลงจริง ส่วน
                        “ไม่ร่วมเดินทางต่อ” ระบบจะจำไว้ตลอดค่ายนี้
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-800">
                      ไม่พบผู้ที่มีที่นั่งแล้วแต่ยังไม่เช็คชื่อขึ้นรถ
                    </div>
                  )}

                  {notTravelingAssignments.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-700">
                          ไม่ร่วมเดินทางต่อในค่ายนี้
                        </p>
                        <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 font-bold text-slate-700">
                          {notTravelingAssignments.length} คน
                        </span>
                      </div>
                      <p className="mt-1 leading-relaxed">
                        ระบบจำกลุ่มนี้ไว้และจะไม่เตือนซ้ำในเที่ยวถัดไป
                      </p>
                      <details className="mt-2">
                        <summary className="cursor-pointer font-semibold text-slate-700">
                          ดูรายชื่อ / นำกลับเข้าร่วม
                        </summary>
                        <div className="mt-2 max-h-36 space-y-2 overflow-y-auto border-t border-slate-200 pt-2">
                          {notTravelingAssignments.map((assignment) => (
                            <div
                              key={assignment.assignmentId}
                              className="flex items-center justify-between gap-2"
                            >
                              <p className="min-w-0 truncate">
                                {assignment.studentId} ·{" "}
                                {assignment.studentName}
                              </p>
                              <Button
                                className="h-7 shrink-0 bg-white px-2 text-[10px] font-semibold text-slate-700"
                                isDisabled={changingAssignmentAction !== null}
                                isLoading={
                                  changingAssignmentAction?.assignmentId ===
                                    assignment.assignmentId &&
                                  changingAssignmentAction.action === "active"
                                }
                                size="sm"
                                variant="flat"
                                onPress={() =>
                                  void changeStudentParticipation(
                                    assignment,
                                    "ACTIVE",
                                  )
                                }
                              >
                                นำกลับเข้าร่วม
                              </Button>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}

                  {unseatedAssignments.length > 0 && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-700">
                          ยังไม่มีที่นั่ง · อาจลา/ไม่ร่วมเดินทาง
                        </p>
                        <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 font-bold text-gray-600">
                          {unseatedAssignments.length} คน
                        </span>
                      </div>
                      <p className="mt-1 leading-relaxed">
                        กลุ่มนี้ยังไม่ถือว่าตกรถ
                        เพราะยังไม่ได้จัดให้ร่วมเดินทางในเที่ยวนี้
                      </p>
                      <details className="mt-2">
                        <summary className="cursor-pointer font-semibold text-gray-700">
                          ดูรายชื่อกลุ่มนี้
                        </summary>
                        <div className="mt-2 max-h-24 space-y-0.5 overflow-y-auto border-t border-gray-200 pt-2">
                          {unseatedAssignments.map((assignment) => (
                            <p key={assignment.assignmentId}>
                              {assignment.studentId} · {assignment.studentName}
                            </p>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    ปรับกลุ่มสีเหลืองให้ตรงกับสถานการณ์จริงแล้วจึงยืนยันเริ่มเดินทาง
                  </p>
                </div>
              ) : (
                <div className="space-y-4 text-sm leading-relaxed text-gray-700">
                  <div>
                    <p className="font-semibold text-gray-900">
                      ผู้โดยสารจะลงจากรถอย่างไร?
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      เลือก 1 วิธี แล้วกดยืนยันการจอดรถ
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <button
                      aria-pressed={parkClearPassengers === false}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#5d7c6f]/30 ${
                        parkClearPassengers === false
                          ? "border-[#5d7c6f] bg-[#f1f7f4] ring-2 ring-[#5d7c6f]/15"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                      type="button"
                      onClick={() => setParkClearPassengers(false)}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e8f2ed] text-[#3d6357]">
                        <UserCheck size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 font-semibold text-gray-900">
                          ให้นักเรียนและครูกดยืนยันลงรถเอง
                          {parkClearPassengers === false && (
                            <Check
                              className="shrink-0 text-[#3d6357]"
                              size={18}
                            />
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                          นักเรียนและครูแต่ละคนกด “ลงจากรถแล้ว” หลังรถจอด
                        </span>
                      </span>
                    </button>

                    <button
                      aria-pressed={parkClearPassengers === true}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-400/30 ${
                        parkClearPassengers === true
                          ? "border-amber-400 bg-amber-50 ring-2 ring-amber-200/60"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                      type="button"
                      onClick={() => setParkClearPassengers(true)}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <Users size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 font-semibold text-gray-900">
                          เคลียร์นักเรียนและครูทั้งหมด
                          {parkClearPassengers === true && (
                            <Check
                              className="shrink-0 text-amber-700"
                              size={18}
                            />
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                          เปลี่ยนนักเรียนและครูที่อยู่บนรถเป็น “ลงจากรถแล้ว”
                          ทันที
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter className="flex flex-row items-center justify-end gap-2">
              <Button
                className="min-w-0 flex-1 font-medium text-gray-600 sm:flex-none"
                isDisabled={savingAction !== null}
                variant="light"
                onPress={() => {
                  setPendingBusStatus(null);
                  setParkClearPassengers(null);
                }}
              >
                ยกเลิก
              </Button>
              {pendingBusStatus === "TRAVELING" ? (
                <Button
                  className="min-w-0 flex-1 bg-[#365f4f] font-medium text-white sm:flex-none"
                  isDisabled={
                    changingAssignmentAction !== null || savingAction !== null
                  }
                  isLoading={savingAction === "status"}
                  onPress={() => void changeBusStatus()}
                >
                  ยืนยันเริ่มเดินทาง
                </Button>
              ) : (
                <Button
                  className="min-w-0 flex-1 bg-[#365f4f] font-semibold text-white sm:flex-none"
                  isDisabled={
                    savingAction !== null || parkClearPassengers === null
                  }
                  isLoading={savingAction === "status"}
                  onPress={() =>
                    void changeBusStatus(parkClearPassengers ?? false)
                  }
                >
                  ยืนยันการจอดรถ
                </Button>
              )}
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal
          classNames={{
            base: "rounded-3xl",
            header: "border-b border-gray-100 px-5 py-4",
            body: "bg-[#f7faf8] p-5",
            footer: "border-t border-gray-100 px-5 py-4",
          }}
          isOpen={showEditBus}
          placement="center"
          size="md"
          onOpenChange={setShowEditBus}
        >
          <ModalContent>
            <ModalHeader>
              <div>
                <p className="text-lg font-bold text-gray-900">
                  แก้ไขข้อมูลรถและผัง
                </p>
                <p className="mt-1 text-xs font-normal text-gray-500">
                  {selectedLayoutTemplate
                    ? "แก้ไขชื่อรถได้ โดยระบบจะรักษาผังเทมเพลตเดิมไว้"
                    : "ปรับจำนวนชั้นและจำนวนแถว แล้วบันทึกได้ตลอดเวลา"}
                </p>
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700">
                  ชื่อรถ
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-normal outline-none transition focus:border-[#6b857a] focus:ring-2 focus:ring-[#6b857a]/15"
                    value={editBusForm.name}
                    onChange={(event) =>
                      setEditBusForm((form) => ({
                        ...form,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                {selectedLayoutTemplate ? (
                  <div className="rounded-2xl border border-[#cfe0d6] bg-[#edf5f0] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#365f4f]">
                          {selectedLayoutTemplate.name}
                        </p>
                        <p className="mt-1 text-xs text-[#587466]">
                          {selectedLayoutTemplate.description}
                        </p>
                      </div>
                      <Check className="shrink-0 text-[#6b857a]" size={20} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="block text-sm font-semibold text-gray-700">
                      จำนวนชั้น
                      <FloorCountRadioGroup
                        disabled={savingAction !== null}
                        name="edit-floor-count"
                        value={editBusForm.floorCount}
                        onChange={(value) => {
                          const floorCount = Number(value);

                          setEditBusForm((form) => ({
                            ...form,
                            floorCount: value,
                            rowCounts:
                              floorCount === 2
                                ? [
                                    form.rowCounts[0] || 10,
                                    form.rowCounts[1] || 10,
                                  ]
                                : [form.rowCounts[0] || 10],
                          }));
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {editBusForm.rowCounts
                        .map((rowCount, index) => ({ rowCount, index }))
                        .reverse()
                        .map(({ rowCount, index }) => (
                          <label
                            key={index}
                            className="block text-sm font-semibold text-gray-700"
                          >
                            {rowCountLabel(
                              index + 1,
                              Number(editBusForm.floorCount),
                            )}
                            <input
                              className={[
                                "mt-1 w-full rounded-xl border bg-white px-3 py-2.5 font-normal outline-none transition focus:border-[#6b857a] focus:ring-2 focus:ring-[#6b857a]/15 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400",
                                rowCount === ""
                                  ? "border-red-400 bg-red-50"
                                  : "border-gray-200",
                              ].join(" ")}
                              disabled={savingAction !== null}
                              max={50}
                              min={1}
                              type="number"
                              value={rowCount}
                              onChange={(event) => {
                                const value = event.target.value;

                                setEditBusForm((form) => ({
                                  ...form,
                                  rowCounts: form.rowCounts.map(
                                    (currentValue, rowIndex) =>
                                      rowIndex === index
                                        ? value === ""
                                          ? ""
                                          : Math.max(1, Number(value))
                                        : currentValue,
                                  ),
                                }));
                              }}
                            />
                            {rowCount === "" && (
                              <span className="mt-1 block text-xs font-normal text-red-600">
                                กรุณากรอกจำนวนแถว
                              </span>
                            )}
                          </label>
                        ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-800">
                  สามารถกลับมาแก้ไขผังและกดบันทึกได้ตลอดเวลา
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="flex justify-end gap-2">
              <Button
                className="font-medium text-gray-600"
                isDisabled={savingAction !== null}
                variant="light"
                onPress={() => setShowEditBus(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="bg-[#365f4f] font-medium text-white"
                isLoading={savingAction === "update"}
                onPress={() => void handleUpdateBus()}
              >
                บันทึกข้อมูลรถ
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal
          classNames={{
            base: "rounded-3xl",
            header: "border-b border-gray-100 px-5 py-4",
            body: "p-5",
            footer: "border-t border-gray-100 px-5 py-4",
          }}
          isOpen={showDeleteConfirm}
          placement="center"
          size="sm"
          onOpenChange={setShowDeleteConfirm}
        >
          <ModalContent>
            <ModalHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <AlertTriangle size={20} />
                </div>
                <p className="text-lg font-bold text-gray-900">ยืนยันการลบรถ</p>
              </div>
            </ModalHeader>
            <ModalBody>
              <p className="text-sm leading-relaxed text-gray-700">
                ต้องการลบรถ{" "}
                <span className="font-bold text-gray-900">
                  {selectedBus?.name || "-"}
                </span>{" "}
                ใช่หรือไม่?
              </p>
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-700">
                การลบจะนำผังที่นั่งและการจัดนักเรียนออกจากรถคันนี้
                และไม่สามารถย้อนกลับได้
              </p>
            </ModalBody>
            <ModalFooter className="flex justify-end gap-2">
              <Button
                className="font-medium text-gray-600"
                isDisabled={savingAction !== null}
                variant="light"
                onPress={() => setShowDeleteConfirm(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="bg-red-600 font-medium text-white"
                isLoading={savingAction === "delete"}
                onPress={() => void handleDeleteBus()}
              >
                ยืนยันลบรถ
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Trip History Modal */}
        <Modal
          classNames={{
            wrapper: "z-[1200]",
            base: "z-[1200] max-h-[88vh] overflow-hidden rounded-3xl",
            backdrop: "z-[1190]",
            header: "border-b border-gray-100 bg-white px-5 py-4",
            body: "p-4 bg-[#f7faf8]",
            footer: "border-t border-gray-100 bg-white px-5 py-4",
          }}
          isOpen={showTripHistory}
          placement="center"
          scrollBehavior="inside"
          size="sm"
          onOpenChange={(open) => {
            if (!open) {
              setShowTripHistory(false);
              setTripHistory(null);
            }
          }}
        >
          <ModalContent>
            <ModalHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#e2eee7] text-[#365f4f]">
                  <History size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900">
                    ประวัติการเดินทาง
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {selectedBus?.name}
                  </p>
                </div>
              </div>
            </ModalHeader>
            <ModalBody>
              {tripHistoryLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div
                      key={i}
                      className="animate-pulse rounded-2xl border border-gray-100 bg-white p-4"
                    >
                      <div className="mb-3 h-4 w-20 rounded bg-gray-200" />
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-gray-200" />
                          <div className="h-3 w-40 rounded bg-gray-100" />
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-gray-200" />
                          <div className="h-3 w-48 rounded bg-gray-100" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : tripHistory === null || tripHistory.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                    <History size={28} />
                  </div>
                  <p className="font-semibold text-gray-700">
                    ยังไม่มีประวัติการเดินทาง
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    กดปุ่ม “เริ่มเดินทาง” เพื่อเริ่มบันทึกรอบแรก
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tripHistory.map((trip) => (
                    <div
                      key={trip.tripNumber}
                      className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
                        <span className="text-xs font-bold text-[#365f4f]">
                          รอบที่ {trip.tripNumber}
                        </span>
                        {trip.parkedAt === null && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            กำลังเดินทาง
                          </span>
                        )}
                      </div>
                      <div className="divide-y divide-gray-50 px-4 py-1">
                        {/* Departed */}
                        <div className="flex items-start gap-3 py-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e2eee7] text-[#365f4f]">
                            <LogIn size={13} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800">
                              ออกรถ
                            </p>
                            <p className="mt-0.5 text-[11px] text-gray-500">
                              {new Date(trip.departedAt).toLocaleString(
                                "th-TH",
                                {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                  timeZone: "Asia/Bangkok",
                                },
                              )}
                            </p>
                            {trip.departedBy && (
                              <p className="mt-0.5 text-[10px] text-gray-400">
                                ครู {trip.departedBy}
                              </p>
                            )}
                            <BusEventLocationLink
                              location={trip.departedLocation}
                            />
                          </div>
                        </div>
                        {/* Parked */}
                        <div className="flex items-start gap-3 py-3">
                          <div
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                              trip.parkedAt
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            <LogOut size={13} />
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`text-xs font-semibold ${trip.parkedAt ? "text-gray-800" : "text-gray-400"}`}
                            >
                              ถึงจุดแวะ
                            </p>
                            {trip.parkedAt ? (
                              <>
                                <p className="mt-0.5 text-[11px] text-gray-500">
                                  {new Date(trip.parkedAt).toLocaleString(
                                    "th-TH",
                                    {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                      timeZone: "Asia/Bangkok",
                                    },
                                  )}
                                </p>
                                {trip.parkedBy && (
                                  <p className="mt-0.5 text-[10px] text-gray-400">
                                    ครู {trip.parkedBy}
                                  </p>
                                )}
                                <BusEventLocationLink
                                  location={trip.parkedLocation}
                                />
                              </>
                            ) : (
                              <p className="mt-0.5 text-[11px] text-gray-400">
                                ยังอยู่ระหว่างเดินทาง
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ModalBody>
            <ModalFooter className="flex justify-end">
              <Button
                className="font-medium text-gray-600"
                variant="light"
                onPress={() => {
                  setShowTripHistory(false);
                  setTripHistory(null);
                }}
              >
                ปิด
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    </BusManagementShell>
  );
}
