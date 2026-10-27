import {
  fillReminderPlaceholders,
  type ReminderPlaceholderValues,
  type ReminderTemplate,
} from "@/lib/camp-reminder-config";

type CampReminderEmailInput = {
  template: Pick<
    ReminderTemplate,
    "subject" | "heading" | "body" | "action" | "buttonLabel"
  >;
  values: ReminderPlaceholderValues;
  campUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function singleLine(value: string): string {
  return value.replace(/\s*[\r\n]+\s*/g, " ").trim();
}

export function createCampReminderEmail(input: CampReminderEmailInput) {
  const fill = (template: string) =>
    fillReminderPlaceholders(template, input.values);
  const subject = singleLine(fill(input.template.subject));
  const heading = singleLine(fill(input.template.heading));
  const body = fill(input.template.body).trim();
  const action = singleLine(fill(input.template.action));
  const buttonLabel = singleLine(fill(input.template.buttonLabel));
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const safe = {
    name: escapeHtml(input.values.name),
    heading: escapeHtml(heading),
    campName: escapeHtml(input.values.campName),
    campDate: escapeHtml(input.values.campDate),
    location: escapeHtml(input.values.location),
    action: escapeHtml(action),
    url: escapeHtml(input.campUrl),
    buttonLabel: escapeHtml(buttonLabel),
  };
  const bodyHtml = paragraphs
    .map(
      (paragraph) =>
        `<p style="line-height:1.7">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n        ");
  const link = input.campUrl
    ? `<a href="${safe.url}" style="display:inline-block;background:#5f8878;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">${safe.buttonLabel}</a>`
    : "";
  const actionLine = action
    ? `<br>\n          สิ่งที่ต้องทำ: ${safe.action}`
    : "";
  const html = `<!doctype html>
<html lang="th">
  <body style="margin:0;background:#f4f7f5;font-family:Arial,'Noto Sans Thai',sans-serif;color:#1f2937">
    <div style="max-width:600px;margin:0 auto;padding:32px 16px">
      <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb">
        <div style="color:#5f8878;font-size:14px;font-weight:700;margin-bottom:12px">KKS CAMP</div>
        <h1 style="font-size:24px;line-height:1.4;margin:0 0 16px">${safe.heading}</h1>
        <p style="line-height:1.7">สวัสดี ${safe.name}</p>
        ${bodyHtml}
        <div style="background:#f4f7f5;border-radius:12px;padding:18px;margin:24px 0;line-height:1.8">
          <strong>${safe.campName}</strong><br>
          วันที่: ${safe.campDate}<br>
          สถานที่: ${safe.location}${actionLine}
        </div>
        ${link}
        <p style="font-size:12px;color:#6b7280;margin-top:28px">ข้อความนี้ส่งโดยอัตโนมัติจากระบบ KKS Camp</p>
      </div>
    </div>
  </body>
</html>`;
  const text = `${heading}\n\nสวัสดี ${input.values.name}\n${paragraphs.join("\n\n")}\n\nค่าย: ${input.values.campName}\nวันที่: ${input.values.campDate}\nสถานที่: ${input.values.location}${action ? `\nสิ่งที่ต้องทำ: ${action}` : ""}${input.campUrl ? `\n${input.campUrl}` : ""}\n\nข้อความนี้ส่งโดยอัตโนมัติจากระบบ KKS Camp`;

  return { subject, html, text };
}
