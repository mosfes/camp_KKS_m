import { z } from "zod";

export const BUS_LAYOUT_ELEMENT_TYPES = [
  "SEAT",
  "DRIVER",
  "DOOR",
  "STAIRS",
  "TOILET",
  "TABLE",
  "EMPTY",
  "LABEL",
] as const;

export type BusLayoutElementType = (typeof BUS_LAYOUT_ELEMENT_TYPES)[number];

export const BUS_LAYOUT_DISPLAY_VERTICAL_SCALE = 2 / 3;
export const BUS_LAYOUT_MIN_SEAT_SIZE = 2;

export const busLayoutElementSchema = z.object({
  elementId: z.union([z.number().int().positive(), z.string()]).optional(),
  type: z.literal("SEAT"),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(BUS_LAYOUT_MIN_SEAT_SIZE).max(12),
  height: z.number().int().min(BUS_LAYOUT_MIN_SEAT_SIZE).max(12),
  rotation: z.union([
    z.literal(0),
    z.literal(90),
    z.literal(180),
    z.literal(270),
  ]),
  label: z.string().trim().max(50).default(""),
  isAssignable: z.boolean().default(false),
  zIndex: z.number().int().min(0).max(1000).default(0),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const busLayoutFloorSchema = z
  .object({
    floorId: z.number().int().positive().optional(),
    floorNumber: z.number().int().min(1).max(2),
    floorName: z.string().trim().max(80).default(""),
    canvasColumns: z.number().int().min(4).max(30),
    canvasRows: z.number().int().min(4).max(80),
    elements: z.array(busLayoutElementSchema).max(500),
  })
  .superRefine((floor, ctx) => {
    const labels = new Set<string>();

    floor.elements.forEach((element, index) => {
      if (
        element.x + element.width > floor.canvasColumns ||
        element.y + element.height > floor.canvasRows
      ) {
        ctx.addIssue({
          code: "custom",
          message: `องค์ประกอบ ${element.label || index + 1} อยู่นอกพื้นที่ผัง`,
          path: ["elements", index],
        });
      }

      if (element.type === "SEAT") {
        if (!element.label) {
          ctx.addIssue({
            code: "custom",
            message: "ที่นั่งทุกตำแหน่งต้องมีรหัส",
            path: ["elements", index, "label"],
          });
        }

        if (element.label.length > 20) {
          ctx.addIssue({
            code: "custom",
            message: "รหัสที่นั่งต้องไม่เกิน 20 ตัวอักษร",
            path: ["elements", index, "label"],
          });
        }

        const normalizedLabel = element.label.toLocaleLowerCase();

        if (labels.has(normalizedLabel)) {
          ctx.addIssue({
            code: "custom",
            message: `รหัสที่นั่ง ${element.label} ซ้ำกัน`,
            path: ["elements", index, "label"],
          });
        }

        labels.add(normalizedLabel);
      }
    });

    const seats = floor.elements.filter((element) => element.type === "SEAT");

    seats.forEach((seat, index) => {
      const overlaps = seats
        .slice(index + 1)
        .some(
          (other) =>
            seat.x < other.x + other.width &&
            seat.x + seat.width > other.x &&
            seat.y < other.y + other.height &&
            seat.y + seat.height > other.y,
        );

      if (overlaps) {
        ctx.addIssue({
          code: "custom",
          message: `ที่นั่ง ${seat.label} ซ้อนกับที่นั่งอื่น`,
          path: ["elements"],
        });
      }
    });
  });

export const busLayoutTemplateSchema = z
  .object({
    name: z.string().trim().min(1, "กรุณาระบุชื่อผัง").max(120),
    description: z.string().trim().max(500).default(""),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
    floors: z.array(busLayoutFloorSchema).min(1).max(2),
  })
  .superRefine((template, ctx) => {
    const numbers = template.floors.map((floor) => floor.floorNumber);

    if (new Set(numbers).size !== numbers.length) {
      ctx.addIssue({
        code: "custom",
        message: "หมายเลขชั้นห้ามซ้ำกัน",
        path: ["floors"],
      });
    }

    if (
      template.status === "PUBLISHED" &&
      !template.floors.some((floor) =>
        floor.elements.some(
          (element) => element.type === "SEAT" && element.isAssignable,
        ),
      )
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "ต้องมีที่นั่งที่สามารถจัดผู้โดยสารได้อย่างน้อย 1 ที่ก่อนเผยแพร่",
        path: ["floors"],
      });
    }
  });

export type BusLayoutTemplateInput = z.infer<typeof busLayoutTemplateSchema>;

export function legacyPositionX(seatIndex: number) {
  return [0, 1, 3, 4][seatIndex] ?? seatIndex;
}

export function formatBusLayoutTemplate(template: any) {
  const floors = (template.floors || []).map((floor: any) => ({
    floorId: floor.floor_id,
    floorNumber: floor.floor_number,
    floorName: floor.floor_name || "",
    canvasColumns: floor.canvas_columns,
    canvasRows: floor.canvas_rows,
    elements: (floor.elements || [])
      .filter((element: any) => element.type === "SEAT")
      .map((element: any) => ({
        elementId: element.element_id,
        type: element.type,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation,
        label: element.label,
        isAssignable: element.is_assignable,
        zIndex: element.z_index,
        metadata: element.metadata,
      })),
  }));
  const capacity = floors.reduce(
    (total: number, floor: any) =>
      total +
      floor.elements.filter(
        (element: any) => element.type === "SEAT" && element.isAssignable,
      ).length,
    0,
  );

  return {
    templateId: template.template_id,
    name: template.name,
    description: template.description,
    status: template.status,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
    floorCount: floors.length,
    capacity,
    floors,
  };
}
