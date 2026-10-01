export const BUS_REMINDER_TTL_MS = 30 * 60 * 1000;
export const BUS_REMINDER_COOLDOWN_MS = 60 * 1000;

export type BusReminderAction = "board" | "alight";

export interface BusReminderEvent {
  event_type: string;
  created_at: Date | string;
}

export interface ActiveBusReminder {
  action: BusReminderAction;
  sentAt: string;
  message: string;
}

export interface BusReminderContent {
  action: BusReminderAction;
  title: string;
  message: string;
}

export function getBusReminderContent(
  eventType: string,
): BusReminderContent | null {
  if (eventType === "REMIND_BOARD") {
    return {
      action: "board",
      title: "ถึงเวลาขึ้นรถ",
      message: "ครูประจำรถกำลังเช็กจำนวนคน กรุณากดยืนยันขึ้นรถ",
    };
  }

  if (eventType === "REMIND_ALIGHT") {
    return {
      action: "alight",
      title: "ถึงเวลาลงรถ",
      message: "ครูประจำรถแจ้งว่ารถจอดแล้ว กรุณากดลงจากรถ",
    };
  }

  return null;
}

export function getActiveBusReminder(
  events: BusReminderEvent[] | undefined,
  isOnBus: boolean,
  now = new Date(),
): ActiveBusReminder | null {
  const expectedType = isOnBus ? "REMIND_ALIGHT" : "REMIND_BOARD";
  const event = events?.[0];

  if (!event || event.event_type !== expectedType) return null;

  const createdAt = new Date(event.created_at);

  if (
    Number.isNaN(createdAt.getTime()) ||
    now.getTime() - createdAt.getTime() > BUS_REMINDER_TTL_MS
  ) {
    return null;
  }

  const content = getBusReminderContent(event.event_type);

  if (!content) return null;

  return {
    action: content.action,
    sentAt: createdAt.toISOString(),
    message: content.message,
  };
}
