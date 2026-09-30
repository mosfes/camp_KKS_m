"use client";

import {
  Archive,
  Armchair,
  ArrowLeft,
  Copy,
  Layers3,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useStatusModal } from "@/components/StatusModalProvider";
import {
  BUS_LAYOUT_DISPLAY_VERTICAL_SCALE,
  BUS_LAYOUT_MIN_SEAT_SIZE,
  type BusLayoutElementType,
} from "@/lib/freeform-bus-layout";

type LayoutElement = {
  elementId: string;
  type: BusLayoutElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  label: string;
  isAssignable: boolean;
  zIndex: number;
  metadata?: Record<string, unknown> | null;
};

type LayoutFloor = {
  floorId?: number;
  floorNumber: number;
  floorName: string;
  canvasColumns: number;
  canvasRows: number;
  elements: LayoutElement[];
};

type LayoutTemplate = {
  templateId: number;
  name: string;
  description: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  capacity: number;
  floorCount: number;
  floors: LayoutFloor[];
};

type DragState = {
  elementIds: string[];
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  bounds: { x: number; y: number; width: number; height: number };
  elements: Array<
    Pick<LayoutElement, "elementId" | "x" | "y" | "width" | "height">
  >;
};

type MarqueeState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

const TOOLBOX: Array<{
  type: BusLayoutElementType;
  label: string;
  icon: typeof Armchair;
  width: number;
  height: number;
}> = [{ type: "SEAT", label: "ที่นั่ง", icon: Armchair, width: 2, height: 2 }];

const TYPE_LABELS: Record<BusLayoutElementType, string> = {
  SEAT: "ที่นั่ง",
  DRIVER: "คนขับ",
  DOOR: "ประตู",
  STAIRS: "บันได",
  TOILET: "ห้องน้ำ",
  TABLE: "โต๊ะ",
  EMPTY: "พื้นที่ว่าง",
  LABEL: "ข้อความ",
};

const STATUS_LABELS = {
  DRAFT: "ฉบับร่าง",
  PUBLISHED: "เผยแพร่แล้ว",
  ARCHIVED: "เก็บเข้าคลัง",
};

function cloneTemplate(template: LayoutTemplate): LayoutTemplate {
  return JSON.parse(JSON.stringify(template));
}

function normalizeTemplate(template: any): LayoutTemplate {
  return {
    ...template,
    floors: template.floors.map((floor: any) => {
      const seats = floor.elements.filter(
        (element: any) => element.type === "SEAT",
      );
      const minimumSeatY = seats.length
        ? Math.min(...seats.map((element: any) => element.y))
        : 0;
      const shiftUp = Math.max(0, minimumSeatY);

      return {
        ...floor,
        elements: seats.map((element: any) => ({
          ...element,
          elementId: String(element.elementId),
          y: element.y - shiftUp,
        })),
      };
    }),
  };
}

function elementColors(type: BusLayoutElementType, selected: boolean) {
  const base: Record<BusLayoutElementType, string> = {
    SEAT: "border-[#5f806f] bg-white text-slate-700",
    DRIVER: "border-sky-300 bg-sky-100 text-sky-800",
    DOOR: "border-amber-400 bg-amber-50 text-amber-800",
    STAIRS: "border-violet-300 bg-violet-100 text-violet-800",
    TOILET: "border-cyan-300 bg-cyan-100 text-cyan-800",
    TABLE: "border-orange-300 bg-orange-100 text-orange-800",
    EMPTY: "border-dashed border-gray-300 bg-white/60 text-gray-500",
    LABEL: "border-transparent bg-transparent text-gray-700",
  };

  return `${base[type]} ${selected ? "ring-2 ring-[#365f4f] ring-offset-1" : ""}`;
}

function elementIcon(type: BusLayoutElementType) {
  const Icon = TOOLBOX.find((tool) => tool.type === type)?.icon || Armchair;

  return <Icon aria-hidden className="h-4 w-4 shrink-0" />;
}

export default function BusLayoutManager({
  mode = "list",
  templateId,
}: {
  mode?: "list" | "editor";
  templateId?: number;
}) {
  const { showError, showSuccess } = useStatusModal();
  const router = useRouter();
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  const [draft, setDraft] = useState<LayoutTemplate | null>(null);
  const [selectedFloorNumber, setSelectedFloorNumber] = useState(1);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    floorCount: 1,
  });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [undoStack, setUndoStack] = useState<LayoutTemplate[]>([]);
  const [redoStack, setRedoStack] = useState<LayoutTemplate[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const actionInFlightRef = useRef(false);

  const beginAsyncAction = () => {
    if (actionInFlightRef.current) return false;

    actionInFlightRef.current = true;
    setSaving(true);
    return true;
  };

  const finishAsyncAction = () => {
    actionInFlightRef.current = false;
    setSaving(false);
  };

  const fetchTemplates = useCallback(
    async (preferredId?: number) => {
      try {
        setLoading(true);
        const response = await fetch(
          "/api/bus-layout-templates?includeAll=true",
          {
            cache: "no-store",
          },
        );
        const data = await response.json();

        if (!response.ok)
          throw new Error(data.error || "โหลดคลังผังรถไม่สำเร็จ");

        const list = (data.templates || []).map(normalizeTemplate);
        setTemplates(list);
        setDraft((current) => {
          const targetId =
            preferredId || current?.templateId || list[0]?.templateId;
          const target = list.find(
            (item: LayoutTemplate) => item.templateId === targetId,
          );

          return target ? cloneTemplate(target) : null;
        });
      } catch (error) {
        showError(
          "โหลดข้อมูลไม่สำเร็จ",
          error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง",
        );
      } finally {
        setLoading(false);
      }
    },
    [showError],
  );

  useEffect(() => {
    fetchTemplates(templateId);
  }, [fetchTemplates, templateId]);

  useEffect(() => {
    setSelectedFloorNumber(draft?.floors[0]?.floorNumber || 1);
    setSelectedElementIds([]);
    setUndoStack([]);
    setRedoStack([]);
  }, [draft?.templateId]);

  const currentFloor = draft?.floors.find(
    (floor) => floor.floorNumber === selectedFloorNumber,
  );
  const savedTemplate = templates.find(
    (template) => template.templateId === draft?.templateId,
  );
  const hasUnsavedChanges = Boolean(
    draft &&
      savedTemplate &&
      JSON.stringify(draft) !== JSON.stringify(savedTemplate),
  );
  const selectedElements =
    currentFloor?.elements.filter((element) =>
      selectedElementIds.includes(element.elementId),
    ) || [];
  const selectedElement =
    selectedElements.length === 1 ? selectedElements[0] : undefined;
  const selectionBounds = useMemo(() => {
    if (selectedElements.length === 0) return null;
    const x = Math.min(...selectedElements.map((element) => element.x));
    const y = Math.min(...selectedElements.map((element) => element.y));
    const right = Math.max(
      ...selectedElements.map((element) => element.x + element.width),
    );
    const bottom = Math.max(
      ...selectedElements.map((element) => element.y + element.height),
    );

    return { x, y, width: right - x, height: bottom - y };
  }, [selectedElements]);

  const pushHistory = useCallback(() => {
    if (!draft) return;
    setUndoStack((stack) => [...stack.slice(-29), cloneTemplate(draft)]);
    setRedoStack([]);
  }, [draft]);

  const mutateDraft = useCallback(
    (mutator: (current: LayoutTemplate) => LayoutTemplate, record = true) => {
      if (record) pushHistory();
      setDraft((current) =>
        current ? mutator(cloneTemplate(current)) : current,
      );
    },
    [pushHistory],
  );

  const undo = () => {
    if (!draft || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((stack) => [...stack, cloneTemplate(draft)]);
    setUndoStack((stack) => stack.slice(0, -1));
    setDraft(cloneTemplate(previous));
  };

  const redo = () => {
    if (!draft || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((stack) => [...stack, cloneTemplate(draft)]);
    setRedoStack((stack) => stack.slice(0, -1));
    setDraft(cloneTemplate(next));
  };

  const createElement = (
    type: BusLayoutElementType,
    x?: number,
    y?: number,
  ) => {
    if (!currentFloor) return;
    const tool = TOOLBOX.find((item) => item.type === type)!;
    const seatCount = currentFloor.elements.filter(
      (element) => element.type === "SEAT",
    ).length;
    const defaultContentY = 0;
    const element: LayoutElement = {
      elementId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      x: Math.max(0, Math.min(x ?? 1, currentFloor.canvasColumns - tool.width)),
      y: Math.max(
        defaultContentY,
        Math.min(y ?? defaultContentY, currentFloor.canvasRows - tool.height),
      ),
      width: tool.width,
      height: tool.height,
      rotation: 0,
      label:
        type === "SEAT"
          ? `S${String(seatCount + 1).padStart(2, "0")}`
          : tool.label,
      isAssignable: type === "SEAT",
      zIndex: currentFloor.elements.length,
    };

    mutateDraft((next) => {
      next.floors
        .find((floor) => floor.floorNumber === selectedFloorNumber)!
        .elements.push(element);
      return next;
    });
    setSelectedElementIds([element.elementId]);
  };

  const beginDrag = (
    event: React.PointerEvent,
    element: LayoutElement,
    mode: "move" | "resize",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!currentFloor) return;
    pushHistory();
    event.currentTarget.setPointerCapture(event.pointerId);
    const elementIds = selectedElementIds.includes(element.elementId)
      ? selectedElementIds
      : [element.elementId];
    const elements = currentFloor.elements
      .filter((item) => elementIds.includes(item.elementId))
      .map((item) => ({
        elementId: item.elementId,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
      }));
    const x = Math.min(...elements.map((item) => item.x));
    const y = Math.min(...elements.map((item) => item.y));
    const right = Math.max(...elements.map((item) => item.x + item.width));
    const bottom = Math.max(...elements.map((item) => item.y + item.height));

    setSelectedElementIds(elementIds);
    setDrag({
      elementIds,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      bounds: { x, y, width: right - x, height: bottom - y },
      elements,
    });
  };

  const moveDrag = (event: React.PointerEvent) => {
    if (!currentFloor || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    if (marquee) {
      const currentX = Math.max(
        0,
        Math.min(
          currentFloor.canvasColumns,
          ((event.clientX - bounds.left) / bounds.width) *
            currentFloor.canvasColumns,
        ),
      );
      const currentY = Math.max(
        0,
        Math.min(
          currentFloor.canvasRows,
          ((event.clientY - bounds.top) / bounds.height) *
            currentFloor.canvasRows,
        ),
      );
      setMarquee((current) =>
        current ? { ...current, currentX, currentY } : current,
      );
      return;
    }
    if (!drag) return;
    const dx = Math.round(
      (event.clientX - drag.startClientX) /
        (bounds.width / currentFloor.canvasColumns),
    );
    const dy = Math.round(
      (event.clientY - drag.startClientY) /
        (bounds.height / currentFloor.canvasRows),
    );

    mutateDraft((next) => {
      const floor = next.floors.find(
        (item) => item.floorNumber === selectedFloorNumber,
      )!;
      if (drag.mode === "move") {
        const constrainedDx = Math.max(
          -drag.bounds.x,
          Math.min(dx, floor.canvasColumns - drag.bounds.x - drag.bounds.width),
        );
        const minimumY = 0;
        const constrainedDy = Math.max(
          minimumY - drag.bounds.y,
          Math.min(dy, floor.canvasRows - drag.bounds.y - drag.bounds.height),
        );

        drag.elements.forEach((source) => {
          const element = floor.elements.find(
            (item) => item.elementId === source.elementId,
          )!;
          element.x = source.x + constrainedDx;
          element.y = source.y + constrainedDy;
        });
      } else {
        const nextWidth = Math.max(
          BUS_LAYOUT_MIN_SEAT_SIZE,
          Math.min(drag.bounds.width + dx, floor.canvasColumns - drag.bounds.x),
        );
        const nextHeight = Math.max(
          BUS_LAYOUT_MIN_SEAT_SIZE,
          Math.min(drag.bounds.height + dy, floor.canvasRows - drag.bounds.y),
        );
        const scaleX = nextWidth / drag.bounds.width;
        const scaleY = nextHeight / drag.bounds.height;

        drag.elements.forEach((source) => {
          const element = floor.elements.find(
            (item) => item.elementId === source.elementId,
          )!;
          element.x = Math.round(
            drag.bounds.x + (source.x - drag.bounds.x) * scaleX,
          );
          element.y = Math.round(
            drag.bounds.y + (source.y - drag.bounds.y) * scaleY,
          );
          element.width = Math.max(
            BUS_LAYOUT_MIN_SEAT_SIZE,
            Math.round(source.width * scaleX),
          );
          element.height = Math.max(
            BUS_LAYOUT_MIN_SEAT_SIZE,
            Math.round(source.height * scaleY),
          );
        });
      }

      return next;
    }, false);
  };

  const beginMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      event.target !== event.currentTarget ||
      !currentFloor
    ) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const startX =
      ((event.clientX - bounds.left) / bounds.width) *
      currentFloor.canvasColumns;
    const startY =
      ((event.clientY - bounds.top) / bounds.height) * currentFloor.canvasRows;

    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedElementIds([]);
    setMarquee({ startX, startY, currentX: startX, currentY: startY });
  };

  const finishPointerInteraction = () => {
    if (marquee && currentFloor) {
      const left = Math.min(marquee.startX, marquee.currentX);
      const top = Math.min(marquee.startY, marquee.currentY);
      const right = Math.max(marquee.startX, marquee.currentX);
      const bottom = Math.max(marquee.startY, marquee.currentY);
      const selectedIds = currentFloor.elements
        .filter(
          (element) =>
            element.x < right &&
            element.x + element.width > left &&
            element.y < bottom &&
            element.y + element.height > top,
        )
        .map((element) => element.elementId);
      setSelectedElementIds(selectedIds);
    }
    setMarquee(null);
    setDrag(null);
  };

  const addFloor = () => {
    if (!draft || draft.floors.length >= 2) return;
    mutateDraft((next) => {
      next.floors.push({
        floorNumber: 2,
        floorName: "ชั้นบน",
        canvasColumns: 12,
        canvasRows: 24,
        elements: [],
      });
      next.floorCount = next.floors.length;
      return next;
    });
    setSelectedFloorNumber(2);
  };

  const removeFloor = () => {
    if (!draft || draft.floors.length <= 1) return;
    mutateDraft((next) => {
      next.floors = next.floors.filter(
        (floor) => floor.floorNumber !== selectedFloorNumber,
      );
      next.floors = next.floors.map((floor, index) => ({
        ...floor,
        floorNumber: index + 1,
      }));
      next.floorCount = next.floors.length;
      return next;
    });
    setSelectedFloorNumber(1);
  };

  const autoNumberSeats = () => {
    if (!currentFloor) return;
    mutateDraft((next) => {
      const floor = next.floors.find(
        (item) => item.floorNumber === selectedFloorNumber,
      )!;
      floor.elements
        .filter((element) => element.type === "SEAT")
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .forEach((element, index) => {
          const centerX = element.x + element.width / 2;
          const horizontalZone = Math.min(
            3,
            Math.floor((centerX / floor.canvasColumns) * 4),
          );
          const seatLetter = ["A", "B", "C", "D"][horizontalZone];

          element.label = `${seatLetter}${String(index + 1).padStart(2, "0")}`;
        });
      return next;
    });
  };

  const createTemplate = async () => {
    if (!createForm.name.trim()) {
      showError("ข้อมูลไม่ครบ", "กรุณาระบุชื่อผังรถ");
      return;
    }
    if (!beginAsyncAction()) return;

    try {
      const response = await fetch("/api/bus-layout-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description,
          status: "DRAFT",
          floors: Array.from(
            { length: createForm.floorCount },
            (_, floorIndex) => ({
              floorNumber: floorIndex + 1,
              floorName:
                createForm.floorCount === 1
                  ? "ชั้นเดียว"
                  : floorIndex === 0
                    ? "ชั้นล่าง"
                    : "ชั้นบน",
              canvasColumns: 12,
              canvasRows: 24,
              elements: [],
            }),
          ),
        }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "สร้างผังไม่สำเร็จ");
      setShowCreateDialog(false);
      setCreateForm({ name: "", description: "", floorCount: 1 });
      await fetchTemplates(data.templateId);
      showSuccess("สร้างผังแล้ว", "กดการ์ดผังรถเพื่อเข้าไปจัดเลย์เอาท์");
    } catch (error) {
      showError(
        "สร้างผังไม่สำเร็จ",
        error instanceof Error ? error.message : "กรุณาลองใหม่",
      );
    } finally {
      finishAsyncAction();
    }
  };

  const saveTemplate = async (status = draft?.status) => {
    if (!draft || !status) return;
    if (!beginAsyncAction()) return;

    try {
      const response = await fetch(
        `/api/bus-layout-templates/${draft.templateId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name,
            description: draft.description,
            status,
            floors: draft.floors,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "บันทึกผังไม่สำเร็จ");
      await fetchTemplates(draft.templateId);
      showSuccess(
        status === "PUBLISHED" ? "เผยแพร่ผังแล้ว" : "บันทึกแล้ว",
        status === "PUBLISHED"
          ? "หัวหน้าค่ายสามารถเลือกผังนี้ได้แล้ว"
          : "บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว",
      );
    } catch (error) {
      showError(
        "บันทึกผังไม่สำเร็จ",
        error instanceof Error ? error.message : "กรุณาลองใหม่",
      );
    } finally {
      finishAsyncAction();
    }
  };

  const duplicateTemplate = async () => {
    if (!draft) return;
    if (!beginAsyncAction()) return;

    try {
      const response = await fetch(
        `/api/bus-layout-templates/${draft.templateId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "duplicate" }),
        },
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "ทำสำเนาไม่สำเร็จ");
      router.push(`/admin_add_user/bus-layout/${data.templateId}`);
    } catch (error) {
      showError(
        "ทำสำเนาไม่สำเร็จ",
        error instanceof Error ? error.message : "กรุณาลองใหม่",
      );
    } finally {
      finishAsyncAction();
    }
  };

  const archiveTemplate = async () => {
    if (!draft) return;
    if (!beginAsyncAction()) return;

    try {
      const response = await fetch(
        `/api/bus-layout-templates/${draft.templateId}`,
        {
          method: "DELETE",
        },
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "เก็บเข้าคลังไม่สำเร็จ");
      showSuccess("เก็บเข้าคลังแล้ว", "ผังนี้จะไม่แสดงให้หัวหน้าค่ายเลือกใช้");
      router.push("/admin_add_user?tab=buslayout");
    } catch (error) {
      showError(
        "ทำรายการไม่สำเร็จ",
        error instanceof Error ? error.message : "กรุณาลองใหม่",
      );
    } finally {
      finishAsyncAction();
    }
  };

  const deleteSelected = () => {
    if (selectedElementIds.length === 0) return;
    mutateDraft((next) => {
      const floor = next.floors.find(
        (item) => item.floorNumber === selectedFloorNumber,
      )!;
      floor.elements = floor.elements.filter(
        (element) => !selectedElementIds.includes(element.elementId),
      );
      return next;
    });
    setSelectedElementIds([]);
  };

  const capacity = useMemo(
    () =>
      draft?.floors.reduce(
        (sum, floor) =>
          sum +
          floor.elements.filter(
            (element) => element.type === "SEAT" && element.isAssignable,
          ).length,
        0,
      ) || 0,
    [draft],
  );

  if (loading && templates.length === 0) {
    return <div className="h-80 animate-pulse rounded-3xl bg-white" />;
  }

  if (mode === "list") {
    return (
      <>
        <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">ผังรถทั้งหมด</h2>
              <p className="mt-1 text-sm text-gray-500">
                สร้างผังก่อน แล้วจึงเข้าไปจัดตำแหน่งที่นั่ง ประตู และห้องน้ำ
              </p>
            </div>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#5d7c6f] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#4b6b5e] disabled:opacity-50"
              disabled={saving}
              type="button"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-5 w-5" />
              สร้างผัง
            </button>
          </div>

          {templates.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => (
                <button
                  key={template.templateId}
                  className="group rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#7b9b8c] hover:shadow-md"
                  type="button"
                  onClick={() =>
                    router.push(
                      `/admin_add_user/bus-layout/${template.templateId}`,
                    )
                  }
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-base font-bold text-gray-900">
                        {template.name}
                      </span>
                      <span className="mt-1 block line-clamp-2 min-h-10 text-sm text-gray-500">
                        {template.description || "ยังไม่มีคำอธิบาย"}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        template.status === "PUBLISHED"
                          ? "bg-emerald-50 text-emerald-700"
                          : template.status === "ARCHIVED"
                            ? "bg-gray-100 text-gray-500"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {STATUS_LABELS[template.status]}
                    </span>
                  </span>

                  <span className="mt-5 grid grid-cols-2 gap-3">
                    <span className="rounded-2xl bg-[#f3f7f5] px-3 py-2.5">
                      <span className="block text-[10px] text-gray-500">
                        จำนวนชั้น
                      </span>
                      <span className="mt-0.5 block text-sm font-bold text-[#365f4f]">
                        {template.floorCount} ชั้น
                      </span>
                    </span>
                    <span className="rounded-2xl bg-[#f3f7f5] px-3 py-2.5">
                      <span className="block text-[10px] text-gray-500">
                        ความจุ
                      </span>
                      <span className="mt-0.5 block text-sm font-bold text-[#365f4f]">
                        {template.capacity} ที่นั่ง
                      </span>
                    </span>
                  </span>

                  <span className="mt-4 flex items-center justify-end gap-1 text-xs font-bold text-[#4b6b5e]">
                    จัดเลย์เอาท์
                    <span aria-hidden>→</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white px-6 text-center">
              <Layers3 className="h-12 w-12 text-gray-300" />
              <p className="mt-3 font-bold text-gray-700">ยังไม่มีผังรถ</p>
              <p className="mt-1 text-sm text-gray-500">
                กดสร้างผังเพื่อเริ่มกำหนดเลย์เอาท์รถ
              </p>
              <button
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#5d7c6f] px-4 py-2.5 text-sm font-bold text-white"
                disabled={saving}
                type="button"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-4 w-4" /> สร้างผังแรก
              </button>
            </div>
          )}
        </div>

        {showCreateDialog && (
          <div
            aria-labelledby="create-bus-layout-title"
            aria-modal="true"
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
            role="dialog"
          >
            <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
              <div>
                <h3
                  id="create-bus-layout-title"
                  className="text-xl font-bold text-gray-900"
                >
                  สร้างผังรถ
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  กรอกข้อมูลพื้นฐานก่อน แล้วค่อยเข้าไปจัดเลย์เอาท์จากหน้ารายการ
                </p>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block text-sm font-semibold text-gray-700">
                  ชื่อผังรถ
                  <input
                    className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-normal outline-none focus:border-[#5d7c6f]"
                    maxLength={120}
                    placeholder="เช่น รถทัวร์ 2 ชั้น 50 ที่นั่ง"
                    value={createForm.name}
                    onChange={(event) =>
                      setCreateForm((form) => ({
                        ...form,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="block text-sm font-semibold text-gray-700">
                  คำอธิบาย
                  <textarea
                    className="mt-1.5 min-h-20 w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 font-normal outline-none focus:border-[#5d7c6f]"
                    maxLength={500}
                    placeholder="รายละเอียดหรือรุ่นของรถ"
                    value={createForm.description}
                    onChange={(event) =>
                      setCreateForm((form) => ({
                        ...form,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>

                <fieldset>
                  <legend className="text-sm font-semibold text-gray-700">
                    จำนวนชั้น
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {[1, 2].map((floorCount) => (
                      <label
                        key={floorCount}
                        className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${
                          createForm.floorCount === floorCount
                            ? "border-[#5d7c6f] bg-[#edf5f0] text-[#365f4f]"
                            : "border-gray-200 text-gray-600 hover:border-[#9ab4a7]"
                        }`}
                      >
                        <input
                          checked={createForm.floorCount === floorCount}
                          className="sr-only"
                          name="bus-layout-floor-count"
                          type="radio"
                          onChange={() =>
                            setCreateForm((form) => ({
                              ...form,
                              floorCount,
                            }))
                          }
                        />
                        {floorCount === 1 ? "ชั้นเดียว" : "สองชั้น"}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600"
                  disabled={saving}
                  type="button"
                  onClick={() => setShowCreateDialog(false)}
                >
                  ยกเลิก
                </button>
                <button
                  className="rounded-xl bg-[#5d7c6f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  disabled={saving || !createForm.name.trim()}
                  type="button"
                  onClick={createTemplate}
                >
                  {saving ? "กำลังสร้าง..." : "สร้างผัง"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="grid min-h-[720px] gap-4 xl:grid-cols-[minmax(520px,1fr)_270px]">
      <section className="min-w-0 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <button
            className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            type="button"
            onClick={() => router.push("/admin_add_user?tab=buslayout")}
          >
            <ArrowLeft className="h-4 w-4" />
            กลับไปรายการผัง
          </button>
          {draft && (
            <span className="rounded-full bg-[#edf5f0] px-3 py-1 text-[11px] font-bold text-[#365f4f]">
              {STATUS_LABELS[draft.status]}
            </span>
          )}
        </div>
        {draft && currentFloor ? (
          <>
            <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <input
                  className="w-full truncate border-0 bg-transparent text-xl font-bold text-gray-900 outline-none"
                  maxLength={120}
                  value={draft.name}
                  onChange={(event) =>
                    mutateDraft((next) => ({
                      ...next,
                      name: event.target.value,
                    }))
                  }
                />
                <input
                  className="mt-1 w-full border-0 bg-transparent text-sm text-gray-500 outline-none"
                  maxLength={500}
                  placeholder="คำอธิบายผังรถ"
                  value={draft.description}
                  onChange={(event) =>
                    mutateDraft((next) => ({
                      ...next,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  aria-live="polite"
                  className={`mr-1 text-[10px] font-semibold ${
                    saving
                      ? "text-gray-500"
                      : hasUnsavedChanges
                        ? "text-amber-600"
                        : "text-emerald-700"
                  }`}
                >
                  {saving
                    ? "กำลังบันทึก..."
                    : hasUnsavedChanges
                      ? "● ยังไม่ได้บันทึก"
                      : "✓ บันทึกล่าสุดแล้ว"}
                </span>
                <button
                  className="rounded-lg border border-gray-200 p-2 text-gray-600 disabled:opacity-30"
                  disabled={!undoStack.length}
                  title="ย้อนกลับ"
                  type="button"
                  onClick={undo}
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  className="rounded-lg border border-gray-200 p-2 text-gray-600 disabled:opacity-30"
                  disabled={!redoStack.length}
                  title="ทำซ้ำ"
                  type="button"
                  onClick={redo}
                >
                  <Redo2 className="h-4 w-4" />
                </button>
                <button
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"
                  disabled={saving}
                  type="button"
                  onClick={() => saveTemplate(draft.status)}
                >
                  <Save className="h-4 w-4" /> บันทึก
                </button>
                {draft.status !== "PUBLISHED" && (
                  <button
                    className="rounded-xl bg-[#5d7c6f] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    disabled={saving}
                    type="button"
                    onClick={() => saveTemplate("PUBLISHED")}
                  >
                    เผยแพร่ให้หัวหน้าค่าย
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {draft.floors.map((floor) => (
                  <button
                    key={floor.floorNumber}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      floor.floorNumber === selectedFloorNumber
                        ? "bg-[#365f4f] text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                    type="button"
                    onClick={() => {
                      setSelectedFloorNumber(floor.floorNumber);
                      setSelectedElementIds([]);
                    }}
                  >
                    {floor.floorName || `ชั้น ${floor.floorNumber}`}
                  </button>
                ))}
                {draft.floors.length < 2 && (
                  <button
                    className="rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600"
                    type="button"
                    onClick={addFloor}
                  >
                    + เพิ่มชั้น
                  </button>
                )}
              </div>
              <div className="flex gap-2 text-xs text-gray-500">
                <span>ลากพื้นที่ว่างเพื่อเลือกหลายชิ้น</span>
                <span>·</span>
                <span>{capacity} ที่นั่ง</span>
                <span>·</span>
                <span>
                  กริด {currentFloor.canvasColumns} × {currentFloor.canvasRows}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)]">
              <div className="grid grid-cols-1 gap-2 self-start">
                {TOOLBOX.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    draggable
                    className={`flex min-h-20 cursor-grab flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-3 py-3 text-xs font-bold shadow-sm transition active:cursor-grabbing ${
                      type === "SEAT"
                        ? "border-[#6b8c7b] bg-white text-slate-700 hover:bg-[#f7faf8]"
                        : type === "DOOR"
                          ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                          : "border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                    }`}
                    type="button"
                    onClick={() => createElement(type)}
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "application/x-bus-layout-type",
                        type,
                      )
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {label}
                    {type === "SEAT" && (
                      <span className="text-[10px] font-medium text-gray-400">
                        ว่าง
                      </span>
                    )}
                  </button>
                ))}
                <button
                  className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600"
                  type="button"
                  onClick={autoNumberSeats}
                >
                  เรียงเลขที่นั่งใหม่
                </button>
              </div>

              <div className="overflow-auto rounded-2xl bg-[#eef3f0] p-3 sm:p-6">
                <div className="relative mx-auto min-w-[420px] max-w-[720px] overflow-hidden rounded-[3rem] border-[5px] border-[#5f806f] bg-[#fbfcfb] shadow-sm">
                  <div className="pointer-events-none mx-[5%] mt-[4%] flex min-h-8 items-center justify-center rounded-2xl bg-[#deebe4] px-4 py-1.5 text-[10px] font-bold text-[#365f4f] sm:min-h-10 sm:text-sm">
                    ด้านหน้ารถ / คนขับ
                  </div>
                  <div
                    ref={canvasRef}
                    className="relative mt-3.5 touch-none"
                    style={{
                      aspectRatio: `${currentFloor.canvasColumns} / ${
                        currentFloor.canvasRows *
                        BUS_LAYOUT_DISPLAY_VERTICAL_SCALE
                      }`,
                      backgroundImage:
                        "linear-gradient(to right, rgba(93,124,111,.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(93,124,111,.035) 1px, transparent 1px)",
                      backgroundSize: `${100 / currentFloor.canvasColumns}% ${100 / currentFloor.canvasRows}%`,
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const type = event.dataTransfer.getData(
                        "application/x-bus-layout-type",
                      ) as BusLayoutElementType;
                      const bounds =
                        event.currentTarget.getBoundingClientRect();
                      const x = Math.floor(
                        ((event.clientX - bounds.left) / bounds.width) *
                          currentFloor.canvasColumns,
                      );
                      const y = Math.floor(
                        ((event.clientY - bounds.top) / bounds.height) *
                          currentFloor.canvasRows,
                      );
                      if (TOOLBOX.some((tool) => tool.type === type)) {
                        createElement(type, x, y);
                      }
                    }}
                    onPointerCancel={finishPointerInteraction}
                    onPointerDown={beginMarquee}
                    onPointerMove={moveDrag}
                    onPointerUp={finishPointerInteraction}
                  >
                    {currentFloor.elements
                      .slice()
                      .sort((a, b) => a.zIndex - b.zIndex)
                      .map((element) => (
                        <div
                          key={element.elementId}
                          aria-label={`${TYPE_LABELS[element.type]} ${element.label}`}
                          className={`absolute flex select-none overflow-hidden rounded-xl border-2 p-1.5 text-[10px] font-bold shadow-sm ${
                            element.type === "SEAT"
                              ? "flex-col items-stretch justify-between text-left"
                              : "flex-col items-center justify-center gap-1 text-center"
                          } ${elementColors(
                            element.type,
                            selectedElementIds.includes(element.elementId),
                          )}`}
                          style={{
                            left: `${(element.x / currentFloor.canvasColumns) * 100}%`,
                            top: `${(element.y / currentFloor.canvasRows) * 100}%`,
                            width: `${(element.width / currentFloor.canvasColumns) * 100}%`,
                            height: `${(element.height / currentFloor.canvasRows) * 100}%`,
                            transform: `rotate(${element.rotation}deg)`,
                            zIndex: element.zIndex + 1,
                          }}
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedElementIds([element.elementId]);
                            }
                          }}
                          onPointerDown={(event) => {
                            if (
                              event.shiftKey ||
                              event.metaKey ||
                              event.ctrlKey
                            ) {
                              event.preventDefault();
                              event.stopPropagation();
                              setSelectedElementIds((current) =>
                                current.includes(element.elementId)
                                  ? current.filter(
                                      (elementId) =>
                                        elementId !== element.elementId,
                                    )
                                  : [...current, element.elementId],
                              );
                              return;
                            }
                            beginDrag(event, element, "move");
                          }}
                        >
                          {element.type === "SEAT" ? (
                            <>
                              <span className="block w-full truncate text-[9px] font-extrabold sm:text-[11px]">
                                {element.label || "ที่นั่ง"}
                              </span>
                              <span className="block w-full text-center text-[9px] font-semibold text-slate-500 sm:text-[11px]">
                                ว่าง
                              </span>
                              <span aria-hidden className="h-2" />
                            </>
                          ) : (
                            <>
                              {elementIcon(element.type)}
                              <span className="w-full truncate">
                                {element.label || TYPE_LABELS[element.type]}
                              </span>
                            </>
                          )}
                          {selectedElementIds.length === 1 &&
                            selectedElementIds[0] === element.elementId && (
                              <button
                                aria-label="ปรับขนาดองค์ประกอบ"
                                className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize rounded-tl bg-[#365f4f]"
                                type="button"
                                onPointerDown={(event) =>
                                  beginDrag(event, element, "resize")
                                }
                              />
                            )}
                        </div>
                      ))}
                    {marquee && (
                      <div
                        className="pointer-events-none absolute z-[80] border-2 border-dashed border-[#365f4f] bg-[#8db8a5]/20"
                        style={{
                          left: `${(Math.min(marquee.startX, marquee.currentX) / currentFloor.canvasColumns) * 100}%`,
                          top: `${(Math.min(marquee.startY, marquee.currentY) / currentFloor.canvasRows) * 100}%`,
                          width: `${(Math.abs(marquee.currentX - marquee.startX) / currentFloor.canvasColumns) * 100}%`,
                          height: `${(Math.abs(marquee.currentY - marquee.startY) / currentFloor.canvasRows) * 100}%`,
                        }}
                      />
                    )}
                    {selectedElements.length > 1 && selectionBounds && (
                      <div
                        className="pointer-events-none absolute z-[70] border-2 border-dashed border-[#365f4f]"
                        style={{
                          left: `${(selectionBounds.x / currentFloor.canvasColumns) * 100}%`,
                          top: `${(selectionBounds.y / currentFloor.canvasRows) * 100}%`,
                          width: `${(selectionBounds.width / currentFloor.canvasColumns) * 100}%`,
                          height: `${(selectionBounds.height / currentFloor.canvasRows) * 100}%`,
                        }}
                      >
                        <span className="absolute -top-6 left-0 rounded-md bg-[#365f4f] px-2 py-0.5 text-[10px] font-semibold text-white">
                          เลือก {selectedElements.length} ชิ้น
                        </span>
                        <button
                          aria-label="ปรับขนาดองค์ประกอบที่เลือกทั้งหมด"
                          className="pointer-events-auto absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-[#365f4f] shadow"
                          type="button"
                          onPointerDown={(event) =>
                            beginDrag(event, selectedElements[0], "resize")
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-[600px] flex-col items-center justify-center text-center">
            <Layers3 className="h-12 w-12 text-gray-300" />
            <p className="mt-3 font-semibold text-gray-700">ไม่พบผังรถนี้</p>
            <p className="mt-1 text-sm text-gray-500">
              ผังอาจถูกลบหรือรหัสไม่ถูกต้อง
            </p>
          </div>
        )}
      </section>

      <aside className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
        {draft && currentFloor ? (
          <>
            <h2 className="font-bold text-gray-900">คุณสมบัติ</h2>
            {selectedElement ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl bg-[#edf5f0] px-3 py-2 text-sm font-semibold text-[#365f4f]">
                  {TYPE_LABELS[selectedElement.type]}
                </div>
                <label className="block text-xs font-semibold text-gray-600">
                  ป้ายกำกับ
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#5d7c6f]"
                    maxLength={50}
                    value={selectedElement.label}
                    onChange={(event) =>
                      mutateDraft((next) => {
                        const element = next.floors
                          .find(
                            (floor) =>
                              floor.floorNumber === selectedFloorNumber,
                          )!
                          .elements.find(
                            (item) =>
                              item.elementId === selectedElement.elementId,
                          )!;
                        element.label = event.target.value;
                        return next;
                      })
                    }
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["x", "y", "width", "height"] as const).map((key) => (
                    <label
                      key={key}
                      className="text-xs font-semibold text-gray-600"
                    >
                      {key === "x"
                        ? "ตำแหน่ง X"
                        : key === "y"
                          ? "ตำแหน่ง Y"
                          : key === "width"
                            ? "ความกว้าง"
                            : "ความสูง"}
                      <input
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none"
                        min={
                          key === "x" || key === "y"
                            ? 0
                            : BUS_LAYOUT_MIN_SEAT_SIZE
                        }
                        type="number"
                        value={selectedElement[key]}
                        onChange={(event) =>
                          mutateDraft((next) => {
                            const floor = next.floors.find(
                              (item) =>
                                item.floorNumber === selectedFloorNumber,
                            )!;
                            const element = floor.elements.find(
                              (item) =>
                                item.elementId === selectedElement.elementId,
                            )!;
                            const value = Math.max(
                              key === "x" || key === "y"
                                ? 0
                                : BUS_LAYOUT_MIN_SEAT_SIZE,
                              Number(event.target.value) || 0,
                            );
                            element[key] = value;
                            return next;
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <label className="block text-xs font-semibold text-gray-600">
                  การหมุน
                  <select
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none"
                    value={selectedElement.rotation}
                    onChange={(event) =>
                      mutateDraft((next) => {
                        const element = next.floors
                          .find(
                            (floor) =>
                              floor.floorNumber === selectedFloorNumber,
                          )!
                          .elements.find(
                            (item) =>
                              item.elementId === selectedElement.elementId,
                          )!;
                        element.rotation = Number(event.target.value) as
                          | 0
                          | 90
                          | 180
                          | 270;
                        return next;
                      })
                    }
                  >
                    {[0, 90, 180, 270].map((rotation) => (
                      <option key={rotation} value={rotation}>
                        {rotation}°
                      </option>
                    ))}
                  </select>
                </label>
                {selectedElement.type === "SEAT" && (
                  <label className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700">
                    จัดผู้โดยสารได้
                    <input
                      checked={selectedElement.isAssignable}
                      type="checkbox"
                      onChange={(event) =>
                        mutateDraft((next) => {
                          const element = next.floors
                            .find(
                              (floor) =>
                                floor.floorNumber === selectedFloorNumber,
                            )!
                            .elements.find(
                              (item) =>
                                item.elementId === selectedElement.elementId,
                            )!;
                          element.isAssignable = event.target.checked;
                          return next;
                        })
                      }
                    />
                  </label>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="flex items-center justify-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"
                    type="button"
                    onClick={() =>
                      mutateDraft((next) => {
                        const floor = next.floors.find(
                          (item) => item.floorNumber === selectedFloorNumber,
                        )!;
                        const source = floor.elements.find(
                          (item) =>
                            item.elementId === selectedElement.elementId,
                        )!;
                        const copy = {
                          ...source,
                          elementId: `new-${Date.now()}`,
                          x: Math.min(
                            source.x + 1,
                            floor.canvasColumns - source.width,
                          ),
                          y: Math.min(
                            source.y + 1,
                            floor.canvasRows - source.height,
                          ),
                        };
                        floor.elements.push(copy);
                        setSelectedElementIds([copy.elementId]);
                        return next;
                      })
                    }
                  >
                    <Copy className="h-4 w-4" /> ทำสำเนา
                  </button>
                  <button
                    className="flex items-center justify-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                    type="button"
                    onClick={deleteSelected}
                  >
                    <Trash2 className="h-4 w-4" /> ลบ
                  </button>
                </div>
              </div>
            ) : selectedElements.length > 1 && selectionBounds ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl bg-[#edf5f0] px-3 py-3 text-sm font-semibold text-[#365f4f]">
                  เลือกแล้ว {selectedElements.length} ชิ้น
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                  <div className="rounded-xl border border-gray-200 px-3 py-2">
                    ความกว้าง
                    <strong className="mt-1 block text-sm text-gray-900">
                      {selectionBounds.width} ช่อง
                    </strong>
                  </div>
                  <div className="rounded-xl border border-gray-200 px-3 py-2">
                    ความสูง
                    <strong className="mt-1 block text-sm text-gray-900">
                      {selectionBounds.height} ช่อง
                    </strong>
                  </div>
                </div>
                <p className="text-xs leading-5 text-gray-500">
                  ลากชิ้นที่เลือกเพื่อย้ายทั้งกลุ่ม
                  หรือลากจุดมุมขวาล่างของกรอบเพื่อย่อ–ขยายพร้อมกัน
                </p>
                <button
                  className="flex w-full items-center justify-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                  type="button"
                  onClick={deleteSelected}
                >
                  <Trash2 className="h-4 w-4" /> ลบที่เลือกทั้งหมด
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                เลือกองค์ประกอบบนผังเพื่อแก้ไข
              </div>
            )}

            <div className="mt-6 border-t border-gray-100 pt-5">
              <h3 className="text-sm font-bold text-gray-800">
                ตั้งค่าพื้นที่
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-gray-600">
                  คอลัมน์
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    max={30}
                    min={4}
                    type="number"
                    value={currentFloor.canvasColumns}
                    onChange={(event) =>
                      mutateDraft((next) => {
                        next.floors.find(
                          (floor) => floor.floorNumber === selectedFloorNumber,
                        )!.canvasColumns = Number(event.target.value);
                        return next;
                      })
                    }
                  />
                </label>
                <label className="text-xs font-semibold text-gray-600">
                  แถว
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    max={80}
                    min={4}
                    type="number"
                    value={currentFloor.canvasRows}
                    onChange={(event) =>
                      mutateDraft((next) => {
                        next.floors.find(
                          (floor) => floor.floorNumber === selectedFloorNumber,
                        )!.canvasRows = Number(event.target.value);
                        return next;
                      })
                    }
                  />
                </label>
              </div>
              {draft.floors.length > 1 && (
                <button
                  className="mt-3 w-full rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
                  type="button"
                  onClick={removeFloor}
                >
                  ลบชั้นนี้
                </button>
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 border-t border-gray-100 pt-5">
              <button
                className="flex items-center justify-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"
                disabled={saving}
                type="button"
                onClick={duplicateTemplate}
              >
                <Copy className="h-4 w-4" /> ทำสำเนาผัง
              </button>
              <button
                className="flex items-center justify-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"
                disabled={saving || draft.status === "ARCHIVED"}
                type="button"
                onClick={archiveTemplate}
              >
                <Archive className="h-4 w-4" /> เก็บเข้าคลัง
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">ยังไม่ได้เลือกผัง</p>
        )}
      </aside>
    </div>
  );
}
