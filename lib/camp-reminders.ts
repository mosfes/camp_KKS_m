import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";
import {
  getBangkokDateAsUtcMidnight,
  getBangkokDateKey,
} from "@/lib/bangkok-date";
import {
  ResendApiError,
  sendResendBatch,
  validateResendConfig,
  type ResendMessage,
} from "@/lib/resend";
import { createCampReminderEmail } from "@/lib/camp-reminder-email";
import {
  addDateKeyDays,
  dueReminderTypes,
  JOIN_DAYS_BEFORE,
  JOIN_REMINDER_TYPE,
  STARTING_DAYS_BEFORE,
  STARTING_REMINDER_TYPE,
  TOMORROW_DAYS_BEFORE,
  TOMORROW_REMINDER_TYPE,
  type ReminderType,
} from "@/lib/camp-reminder-policy";

const DEFAULT_DAILY_LIMIT = 90;
const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 100;
const STALE_SENDING_MINUTES = 2;
const STALE_RUN_LOCK_MINUTES = 2;
const JOB_TIME_BUDGET_MS = 50_000;

class DailyQuotaUnavailableError extends Error {
  constructor() {
    super("Daily Resend quota is exhausted or the Cron lock was lost");
    this.name = "DailyQuotaUnavailableError";
  }
}

function isReminderType(value: string): value is ReminderType {
  return (
    value === JOIN_REMINDER_TYPE ||
    value === STARTING_REMINDER_TYPE ||
    value === TOMORROW_REMINDER_TYPE
  );
}

type Recipient = {
  key: string;
  email: string;
  name: string;
};

function addDays(dateKey: string, days: number): string {
  return addDateKeyDays(dateKey, days);
}

function dateRange(dateFromKey: string, dateToKey: string) {
  const from = getBangkokDateAsUtcMidnight(dateFromKey);
  const to = getBangkokDateAsUtcMidnight(addDays(dateToKey, 1));

  return { from, to };
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function dailyLimit(): number {
  // Resend Free currently allows 100 messages/day. Keep a small safety margin
  // for other transactional messages sent from the same account.
  return Math.min(
    100,
    positiveIntegerEnv("RESEND_DAILY_SEND_LIMIT", DEFAULT_DAILY_LIMIT),
  );
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const email = value.trim().toLowerCase();

  if (
    !email ||
    email.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null;
  }

  return email;
}

function addRecipient(
  recipients: Map<string, Recipient>,
  key: string,
  emailValue: unknown,
  nameValue: unknown,
) {
  const email = normalizeEmail(emailValue);

  if (!email || recipients.has(key)) return;

  const name = typeof nameValue === "string" ? nameValue.trim() : "";

  recipients.set(key, {
    key,
    email,
    name: name.slice(0, 255) || email,
  });
}

function teacherName(teacher: {
  prefix_name?: string | null;
  firstname: string;
  lastname: string;
}) {
  return `${teacher.prefix_name ?? ""}${teacher.firstname} ${teacher.lastname}`.trim();
}

function studentName(student: {
  prefix_name?: string | null;
  firstname: string;
  lastname: string;
}) {
  return `${student.prefix_name ?? ""}${student.firstname} ${student.lastname}`.trim();
}

async function loadCampRecipients(campId: number, reminderType: ReminderType) {
  const camp = await prisma.camp.findFirst({
    where: { camp_id: campId, deletedAt: null },
    select: {
      camp_id: true,
      name: true,
      location: true,
      start_date: true,
      created_by: {
        select: {
          teachers_id: true,
          prefix_name: true,
          firstname: true,
          lastname: true,
          email: true,
          deletedAt: true,
        },
      },
      teacher_enrollment: {
        where: { teacher: { deletedAt: null } },
        select: {
          teacher: {
            select: {
              teachers_id: true,
              prefix_name: true,
              firstname: true,
              lastname: true,
              email: true,
              deletedAt: true,
            },
          },
        },
      },
      camp_bus_teacher: {
        where: {
          removed_at: null,
          teacher: { deletedAt: null },
        },
        select: {
          teacher: {
            select: {
              teachers_id: true,
              prefix_name: true,
              firstname: true,
              lastname: true,
              email: true,
              deletedAt: true,
            },
          },
        },
      },
      camp_classroom: {
        where: { classroom: { deletedAt: null } },
        select: {
          classroom: {
            select: {
              classroom_students: {
                where: { student: { deletedAt: null } },
                select: {
                  student_students_id: true,
                  student: {
                    select: {
                      prefix_name: true,
                      firstname: true,
                      lastname: true,
                      email: true,
                      student_enrollment: {
                        where: { camp_camp_id: campId },
                        select: { enrolled_at: true },
                      },
                    },
                  },
                },
              },
              teacher: {
                select: {
                  teachers_id: true,
                  prefix_name: true,
                  firstname: true,
                  lastname: true,
                  email: true,
                  deletedAt: true,
                },
              },
              classroom_teacher: {
                where: { teacher: { deletedAt: null } },
                select: {
                  teacher: {
                    select: {
                      teachers_id: true,
                      prefix_name: true,
                      firstname: true,
                      lastname: true,
                      email: true,
                      deletedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!camp) return null;

  const recipients = new Map<string, Recipient>();

  for (const campClassroom of camp.camp_classroom) {
    for (const classroomStudent of campClassroom.classroom.classroom_students) {
      const isEnrolled = classroomStudent.student.student_enrollment.some(
        (enrollment) => enrollment.enrolled_at != null,
      );

      if (
        (reminderType === JOIN_REMINDER_TYPE && isEnrolled) ||
        (reminderType !== JOIN_REMINDER_TYPE && !isEnrolled)
      ) {
        continue;
      }

      addRecipient(
        recipients,
        `student:${classroomStudent.student_students_id}`,
        classroomStudent.student.email,
        studentName(classroomStudent.student),
      );
    }
  }

  const addTeacher = (teacher: typeof camp.created_by | null | undefined) => {
    if (!teacher || teacher.deletedAt) return;
    addRecipient(
      recipients,
      `teacher:${teacher.teachers_id}`,
      teacher.email,
      teacherName(teacher),
    );
  };

  // Include all staff sources used by the current camp UI. The creator and
  // primary homeroom teachers are not always present in teacher_enrollment.
  if (reminderType !== JOIN_REMINDER_TYPE) {
    addTeacher(camp.created_by);
    for (const enrollment of camp.teacher_enrollment)
      addTeacher(enrollment.teacher);
    for (const assignment of camp.camp_bus_teacher)
      addTeacher(assignment.teacher);
    for (const campClassroom of camp.camp_classroom) {
      addTeacher(campClassroom.classroom.teacher);
      for (const assignment of campClassroom.classroom.classroom_teacher) {
        addTeacher(assignment.teacher);
      }
    }
  }

  return { camp, recipients: Array.from(recipients.values()) };
}

async function ensureReminderRows(
  camp: NonNullable<Awaited<ReturnType<typeof loadCampRecipients>>>["camp"],
  recipients: Recipient[],
  reminderType: ReminderType,
) {
  const campStartDateKey = getBangkokDateKey(camp.start_date);

  // If the camp date or roster changed after rows were queued, retire stale
  // work before creating the current set. This prevents an old date or a
  // withdrawn participant from receiving a later reminder.
  await prisma.camp_email_reminder.updateMany({
    where: {
      camp_camp_id: camp.camp_id,
      reminder_type: reminderType,
      camp_start_date_key: { not: campStartDateKey },
      status: { in: ["PENDING", "FAILED"] },
    },
    data: {
      status: "SKIPPED",
      last_error: "Camp date changed",
      claimed_at: null,
    },
  });

  const recipientKeys = recipients.map((recipient) => recipient.key);

  await prisma.camp_email_reminder.updateMany({
    where: {
      camp_camp_id: camp.camp_id,
      reminder_type: reminderType,
      camp_start_date_key: campStartDateKey,
      status: { in: ["PENDING", "FAILED"] },
      ...(recipientKeys.length > 0
        ? { recipient_key: { notIn: recipientKeys } }
        : {}),
    },
    data: {
      status: "SKIPPED",
      last_error: "Recipient is no longer active in this camp",
      claimed_at: null,
    },
  });

  if (recipients.length === 0) return;

  const existing = await prisma.camp_email_reminder.findMany({
    where: {
      camp_camp_id: camp.camp_id,
      reminder_type: reminderType,
      camp_start_date_key: campStartDateKey,
      status: { in: ["PENDING", "FAILED"] },
      recipient_key: { in: recipientKeys },
    },
    select: {
      reminder_id: true,
      recipient_key: true,
      recipient_email: true,
      recipient_name: true,
    },
  });
  const recipientsByKey = new Map(
    recipients.map((recipient) => [recipient.key, recipient]),
  );
  const changed = existing.filter((row) => {
    const recipient = recipientsByKey.get(row.recipient_key);

    return (
      recipient &&
      (recipient.email !== row.recipient_email ||
        recipient.name !== row.recipient_name)
    );
  });

  if (changed.length > 0) {
    await prisma.$transaction(
      changed.map((row) => {
        const recipient = recipientsByKey.get(row.recipient_key)!;

        return prisma.camp_email_reminder.update({
          where: { reminder_id: row.reminder_id },
          data: {
            recipient_email: recipient.email,
            recipient_name: recipient.name,
          },
        });
      }),
    );
  }

  await prisma.camp_email_reminder.createMany({
    data: recipients.map((recipient) => ({
      camp_camp_id: camp.camp_id,
      recipient_key: recipient.key,
      recipient_email: recipient.email,
      recipient_name: recipient.name,
      camp_start_date_key: campStartDateKey,
      reminder_type: reminderType,
    })),
    skipDuplicates: true,
  });
}

async function refreshPendingCampRecipients(
  dateFromKey: string,
  dateToKey: string,
  refreshed = new Set<string>(),
) {
  const pendingKeys = await prisma.camp_email_reminder.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      camp_start_date_key: { gte: dateFromKey, lte: dateToKey },
      camp: { deletedAt: null },
    },
    select: { camp_camp_id: true, reminder_type: true },
  });

  for (const pendingKey of pendingKeys) {
    if (!isReminderType(pendingKey.reminder_type)) continue;

    const key = `${pendingKey.camp_camp_id}:${pendingKey.reminder_type}`;

    if (refreshed.has(key)) continue;
    refreshed.add(key);

    const loaded = await loadCampRecipients(
      pendingKey.camp_camp_id,
      pendingKey.reminder_type,
    );

    if (loaded) {
      await ensureReminderRows(
        loaded.camp,
        loaded.recipients,
        pendingKey.reminder_type,
      );
    }
  }

  return refreshed;
}

async function acquireDailyRunLock(dateKey: string) {
  const lockToken = randomUUID();
  const staleBefore = new Date(
    Date.now() - STALE_RUN_LOCK_MINUTES * 60 * 1_000,
  );

  await prisma.camp_email_daily_run.upsert({
    where: { date_key: dateKey },
    create: { date_key: dateKey },
    update: {},
  });

  const acquired = await prisma.camp_email_daily_run.updateMany({
    where: {
      date_key: dateKey,
      OR: [
        { lock_token: null },
        { locked_at: null },
        { locked_at: { lt: staleBefore } },
      ],
    },
    data: {
      lock_token: lockToken,
      locked_at: new Date(),
      last_started_at: new Date(),
    },
  });

  return acquired.count === 1 ? lockToken : null;
}

async function releaseDailyRunLock(dateKey: string, lockToken: string) {
  await prisma.camp_email_daily_run.updateMany({
    where: { date_key: dateKey, lock_token: lockToken },
    data: {
      lock_token: null,
      locked_at: null,
      last_finished_at: new Date(),
    },
  });
}

async function claimPendingReminders(options: {
  dateFromKey: string;
  dateToKey: string;
  reminderType: ReminderType;
  limit: number;
  dailyDateKey: string;
  dailyLimit: number;
  runLockToken: string;
  excludeReminderIds?: number[];
}) {
  if (options.limit <= 0) return [];

  const claimToken = randomUUID();
  const batchKey = randomUUID();

  return prisma.$transaction(async (tx) => {
    const candidates = await tx.camp_email_reminder.findMany({
      where: {
        reminder_type: options.reminderType,
        status: { in: ["PENDING", "FAILED"] },
        attempts: { lt: MAX_ATTEMPTS },
        camp: { deletedAt: null },
        ...(options.excludeReminderIds?.length
          ? { reminder_id: { notIn: options.excludeReminderIds } }
          : {}),
        camp_start_date_key: {
          gte: options.dateFromKey,
          lte: options.dateToKey,
        },
      },
      orderBy: [
        { camp_start_date_key: "asc" },
        { created_at: "asc" },
        { reminder_id: "asc" },
      ],
      take: options.limit,
      select: { reminder_id: true },
    });

    if (candidates.length === 0) return [];

    const ids = candidates.map((candidate) => candidate.reminder_id);

    await tx.camp_email_reminder.updateMany({
      where: {
        reminder_id: { in: ids },
        status: { in: ["PENDING", "FAILED"] },
      },
      data: {
        status: "SENDING",
        claim_token: claimToken,
        batch_key: batchKey,
        claimed_at: new Date(),
        attempts: { increment: 1 },
      },
    });

    const claimed = await tx.camp_email_reminder.findMany({
      where: { claim_token: claimToken, status: "SENDING" },
      include: {
        camp: {
          select: {
            camp_id: true,
            name: true,
            location: true,
            start_date: true,
          },
        },
      },
    });

    if (claimed.length === 0) return [];

    const reserved = await tx.camp_email_daily_run.updateMany({
      where: {
        date_key: options.dailyDateKey,
        lock_token: options.runLockToken,
        attempted_count: { lte: options.dailyLimit - claimed.length },
      },
      data: { attempted_count: { increment: claimed.length } },
    });

    if (reserved.count !== 1) throw new DailyQuotaUnavailableError();

    return claimed;
  });
}

function applicationUrl(): string {
  const configured =
    process.env.CAMP_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (!configured) return "";

  return /^https?:\/\//i.test(configured)
    ? configured.replace(/\/+$/, "")
    : `https://${configured.replace(/\/+$/, "")}`;
}

function formatThaiDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function messagesFor(
  rows: Awaited<ReturnType<typeof claimPendingReminders>>,
): ResendMessage[] {
  const baseUrl = applicationUrl();

  return rows.map((row) => {
    const isTeacher = row.recipient_key.startsWith("teacher:");
    const campPath = isTeacher
      ? `/headteacher/dashboard/camp/${row.camp.camp_id}`
      : `/student/dashboard/camp/${row.camp.camp_id}`;

    const isJoinReminder = row.reminder_type === JOIN_REMINDER_TYPE;
    const isTomorrowReminder = row.reminder_type === TOMORROW_REMINDER_TYPE;
    const email = createCampReminderEmail({
      recipientName: row.recipient_name,
      campName: row.camp.name,
      campDate: formatThaiDate(row.camp.start_date),
      location: row.camp.location,
      action: isJoinReminder
        ? "กดเข้าร่วมค่ายในระบบ"
        : isTomorrowReminder
          ? "ตรวจสอบรายละเอียดและเตรียมตัวสำหรับวันพรุ่งนี้"
          : "เตรียมตัวเข้าค่าย",
      campUrl: baseUrl ? `${baseUrl}${campPath}` : "",
      kind: isJoinReminder
        ? "join"
        : isTomorrowReminder
          ? "tomorrow"
          : "starting",
    });

    return { to: row.recipient_email, ...email };
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 2000);

  return String(error).slice(0, 2000);
}

async function markBatchSent(
  rows: Awaited<ReturnType<typeof claimPendingReminders>>,
  messageIds: string[],
  dailyDateKey: string,
  runLockToken: string,
) {
  const claimToken = rows[0]?.claim_token;

  if (!claimToken) return 0;

  const sentAt = new Date();

  return prisma.$transaction(async (tx) => {
    // The provider may omit per-recipient IDs for a successful batch. Persist
    // an ID only for a single-message response; SENT is the durable truth.
    const updated = await tx.camp_email_reminder.updateMany({
      where: { claim_token: claimToken, status: "SENDING" },
      data: {
        status: "SENT",
        provider_message_id:
          rows.length === 1 && messageIds.length === 1 ? messageIds[0] : null,
        sent_at: sentAt,
        claimed_at: null,
        claim_token: null,
        last_error: null,
      },
    });

    await tx.camp_email_daily_run.updateMany({
      where: { date_key: dailyDateKey, lock_token: runLockToken },
      data: { sent_count: { increment: updated.count } },
    });

    return updated.count;
  });
}

async function markBatchFailed(
  rows: Awaited<ReturnType<typeof claimPendingReminders>>,
  error: unknown,
  dailyDateKey: string,
  runLockToken: string,
) {
  const claimToken = rows[0]?.claim_token;

  if (!claimToken) return 0;

  return prisma.$transaction(async (tx) => {
    const failed = await tx.camp_email_reminder.updateMany({
      where: {
        claim_token: claimToken,
        status: "SENDING",
        attempts: { lt: MAX_ATTEMPTS },
      },
      data: {
        status: "FAILED",
        claimed_at: null,
        claim_token: null,
        last_error: errorMessage(error),
      },
    });
    const exhausted = await tx.camp_email_reminder.updateMany({
      where: {
        claim_token: claimToken,
        status: "SENDING",
        attempts: { gte: MAX_ATTEMPTS },
      },
      data: {
        status: "EXHAUSTED",
        claimed_at: null,
        claim_token: null,
        last_error: errorMessage(error),
      },
    });
    const count = failed.count + exhausted.count;

    await tx.camp_email_daily_run.updateMany({
      where: { date_key: dailyDateKey, lock_token: runLockToken },
      data: { failed_count: { increment: count } },
    });

    return count;
  });
}

async function markBatchUncertain(
  rows: Awaited<ReturnType<typeof claimPendingReminders>>,
  error: unknown,
  dailyDateKey: string,
  runLockToken: string,
) {
  const claimToken = rows[0]?.claim_token;

  if (!claimToken) return 0;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.camp_email_reminder.updateMany({
      where: { claim_token: claimToken, status: "SENDING" },
      data: {
        status: "UNKNOWN",
        claimed_at: null,
        claim_token: null,
        last_error: `Delivery could not be confirmed; not retrying automatically. ${errorMessage(error)}`,
      },
    });

    await tx.camp_email_daily_run.updateMany({
      where: { date_key: dailyDateKey, lock_token: runLockToken },
      data: { uncertain_count: { increment: updated.count } },
    });

    return updated.count;
  });
}

function isDefiniteResendRejection(error: unknown) {
  return (
    error instanceof ResendApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408
  );
}

async function recoverStaleSendingReminders() {
  const staleBefore = new Date(Date.now() - STALE_SENDING_MINUTES * 60 * 1_000);

  // A process may have stopped after Resend accepted a request but before the
  // database commit. Never retry these automatically after the idempotency TTL.
  await prisma.camp_email_reminder.updateMany({
    where: {
      status: "SENDING",
      claimed_at: { lt: staleBefore },
    },
    data: {
      status: "UNKNOWN",
      claimed_at: null,
      claim_token: null,
      last_error:
        "Previous send attempt ended without confirmation; not retrying automatically",
    },
  });
}

export async function runCampReminderJob() {
  validateResendConfig();

  const todayKey = getBangkokDateKey(new Date());
  const joinTargetKey = addDays(todayKey, JOIN_DAYS_BEFORE);
  const startingTargetKey = addDays(todayKey, STARTING_DAYS_BEFORE);
  const tomorrowTargetKey = addDays(todayKey, TOMORROW_DAYS_BEFORE);
  const windowStartKey = addDays(todayKey, 1);
  const windowEndKey = joinTargetKey;
  const upcomingRange = dateRange(windowStartKey, windowEndKey);
  const runLockToken = await acquireDailyRunLock(todayKey);

  if (!runLockToken) {
    return {
      today: todayKey,
      locked: true,
      message: "Another camp reminder run is already active",
    };
  }

  const startedAt = Date.now();

  try {
    await recoverStaleSendingReminders();

    // A camp may have been edited or cancelled after rows were queued. Do not
    // keep trying to send reminders once its start date has passed.
    await prisma.camp_email_reminder.updateMany({
      where: {
        camp_start_date_key: { lt: todayKey },
        status: { in: ["PENDING", "FAILED"] },
      },
      data: {
        status: "SKIPPED",
        last_error: "Camp start date has passed",
        claimed_at: null,
      },
    });

    await prisma.camp_email_reminder.updateMany({
      where: {
        status: { in: ["PENDING", "FAILED"] },
        camp: { deletedAt: { not: null } },
      },
      data: {
        status: "SKIPPED",
        last_error: "Camp was deleted",
        claimed_at: null,
      },
    });

    // Normalize rows created by an older deployment that had already reached
    // the retry ceiling but still carried the FAILED status.
    await prisma.camp_email_reminder.updateMany({
      where: { status: "FAILED", attempts: { gte: MAX_ATTEMPTS } },
      data: { status: "EXHAUSTED" },
    });

    // Reconcile the entire D+1..D+7 window. This catches up safely if Vercel
    // skipped a daily invocation; the queue's unique key prevents duplicates.
    const upcomingCamps = await prisma.camp.findMany({
      where: {
        deletedAt: null,
        start_date: { gte: upcomingRange.from, lt: upcomingRange.to },
      },
      select: { camp_id: true, start_date: true },
      orderBy: [{ start_date: "asc" }, { camp_id: "asc" }],
    });

    const eligibleRecipients = {
      joinCamp: 0,
      startingSoon: 0,
      startingTomorrow: 0,
    };
    const refreshed = new Set<string>();

    for (const camp of upcomingCamps) {
      const startDateKey = getBangkokDateKey(camp.start_date);
      const reminderTypes = dueReminderTypes(todayKey, startDateKey);

      for (const reminderType of reminderTypes) {
        const loaded = await loadCampRecipients(camp.camp_id, reminderType);

        if (!loaded) continue;

        if (reminderType === JOIN_REMINDER_TYPE) {
          eligibleRecipients.joinCamp += loaded.recipients.length;
        } else if (reminderType === STARTING_REMINDER_TYPE) {
          eligibleRecipients.startingSoon += loaded.recipients.length;
        } else {
          eligibleRecipients.startingTomorrow += loaded.recipients.length;
        }

        await ensureReminderRows(loaded.camp, loaded.recipients, reminderType);
        refreshed.add(`${camp.camp_id}:${reminderType}`);
      }
    }

    // Re-read any rows left from an earlier run so a changed roster or camp date
    // is applied before a delayed retry is sent.
    await refreshPendingCampRecipients(windowStartKey, windowEndKey, refreshed);

    const limit = dailyLimit();
    const dailyRun = await prisma.camp_email_daily_run.findUniqueOrThrow({
      where: { date_key: todayKey },
      select: { attempted_count: true },
    });
    let attempted = dailyRun.attempted_count;
    let sent = 0;
    let failed = 0;
    let uncertain = 0;
    const failedThisRun = new Set<number>();

    while (attempted < limit && Date.now() - startedAt < JOB_TIME_BUDGET_MS) {
      let rows: Awaited<ReturnType<typeof claimPendingReminders>> = [];

      // Starting-soon reminders have the nearer deadline; retry those before
      // the less urgent join-camp reminders when the account quota is tight.
      for (const candidateType of [
        TOMORROW_REMINDER_TYPE,
        STARTING_REMINDER_TYPE,
        JOIN_REMINDER_TYPE,
      ] as const) {
        const candidateRows = await claimPendingReminders({
          dateFromKey: windowStartKey,
          dateToKey: windowEndKey,
          reminderType: candidateType,
          limit: Math.min(BATCH_SIZE, limit - attempted),
          dailyDateKey: todayKey,
          dailyLimit: limit,
          runLockToken,
          excludeReminderIds: Array.from(failedThisRun),
        });

        if (candidateRows.length > 0) {
          rows = candidateRows;
          break;
        }
      }

      if (rows.length === 0) break;
      attempted += rows.length;

      try {
        const result = await sendResendBatch({
          messages: messagesFor(rows),
          idempotencyKey: rows[0].batch_key || randomUUID(),
        });

        sent += await markBatchSent(
          rows,
          result.messageIds,
          todayKey,
          runLockToken,
        );
      } catch (error) {
        if (isDefiniteResendRejection(error)) {
          failed += await markBatchFailed(rows, error, todayKey, runLockToken);
          for (const row of rows) failedThisRun.add(row.reminder_id);
        } else {
          uncertain += await markBatchUncertain(
            rows,
            error,
            todayKey,
            runLockToken,
          );
        }
      }
    }

    const [pending, exhausted, unknown, totals] = await Promise.all([
      prisma.camp_email_reminder.count({
        where: {
          status: { in: ["PENDING", "FAILED"] },
          attempts: { lt: MAX_ATTEMPTS },
          camp_start_date_key: { gte: windowStartKey, lte: windowEndKey },
        },
      }),
      prisma.camp_email_reminder.count({
        where: {
          status: "EXHAUSTED",
          camp_start_date_key: { gte: windowStartKey, lte: windowEndKey },
        },
      }),
      prisma.camp_email_reminder.count({
        where: {
          status: "UNKNOWN",
          camp_start_date_key: { gte: windowStartKey, lte: windowEndKey },
        },
      }),
      prisma.camp_email_daily_run.findUniqueOrThrow({
        where: { date_key: todayKey },
        select: {
          attempted_count: true,
          sent_count: true,
          failed_count: true,
          uncertain_count: true,
        },
      }),
    ]);

    return {
      today: todayKey,
      locked: false,
      targets: {
        joinCamp: joinTargetKey,
        startingSoon: startingTargetKey,
        startingTomorrow: tomorrowTargetKey,
      },
      camps: upcomingCamps.length,
      eligibleRecipients,
      dailyLimit: limit,
      attemptedThisRun: attempted - dailyRun.attempted_count,
      sentThisRun: sent,
      failedThisRun: failed,
      uncertainThisRun: uncertain,
      dailyTotals: totals,
      pending,
      exhausted,
      unknown,
    };
  } finally {
    await releaseDailyRunLock(todayKey, runLockToken);
  }
}
