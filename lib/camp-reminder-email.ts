type CampReminderEmailInput = {
  recipientName: string;
  campName: string;
  campDate: string;
  location: string;
  action: string;
  campUrl: string;
  kind: "join" | "starting" | "tomorrow";
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function createCampReminderEmail(input: CampReminderEmailInput) {
  const heading =
    input.kind === "join"
      ? `อย่าลืมเข้าร่วมค่าย ${input.campName}`
      : input.kind === "tomorrow"
        ? `ค่าย ${input.campName} เริ่มพรุ่งนี้แล้ว`
        : `ค่าย ${input.campName} ใกล้เริ่มแล้ว`;
  const intro =
    input.kind === "join"
      ? "ขณะนี้คุณยังไม่ได้ยืนยันเข้าร่วมค่าย กรุณาเข้าร่วมผ่านระบบก่อนค่ายเริ่ม"
      : input.kind === "tomorrow"
        ? "ค่ายจะเริ่มในวันพรุ่งนี้ กรุณาตรวจสอบเวลา สถานที่ และสิ่งที่ต้องเตรียมให้เรียบร้อย"
        : "เตรียมตัวให้พร้อมสำหรับค่ายที่กำลังจะเริ่ม และตรวจสอบรายละเอียดล่าสุดได้จากระบบ";
  const buttonLabel =
    input.kind === "join" ? "เข้าร่วมค่าย" : "ดูรายละเอียดค่าย";
  const safe = {
    name: escapeHtml(input.recipientName),
    heading: escapeHtml(heading),
    intro: escapeHtml(intro),
    campName: escapeHtml(input.campName),
    campDate: escapeHtml(input.campDate),
    location: escapeHtml(input.location),
    action: escapeHtml(input.action),
    url: escapeHtml(input.campUrl),
    buttonLabel: escapeHtml(buttonLabel),
  };
  const link = input.campUrl
    ? `<a href="${safe.url}" style="display:inline-block;background:#5f8878;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">${safe.buttonLabel}</a>`
    : "";
  const html = `<!doctype html>
<html lang="th">
  <body style="margin:0;background:#f4f7f5;font-family:Arial,'Noto Sans Thai',sans-serif;color:#1f2937">
    <div style="max-width:600px;margin:0 auto;padding:32px 16px">
      <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb">
        <div style="color:#5f8878;font-size:14px;font-weight:700;margin-bottom:12px">KKS CAMP</div>
        <h1 style="font-size:24px;line-height:1.4;margin:0 0 16px">${safe.heading}</h1>
        <p style="line-height:1.7">สวัสดี ${safe.name}</p>
        <p style="line-height:1.7">${safe.intro}</p>
        <div style="background:#f4f7f5;border-radius:12px;padding:18px;margin:24px 0;line-height:1.8">
          <strong>${safe.campName}</strong><br>
          วันที่: ${safe.campDate}<br>
          สถานที่: ${safe.location}<br>
          สิ่งที่ต้องทำ: ${safe.action}
        </div>
        ${link}
        <p style="font-size:12px;color:#6b7280;margin-top:28px">ข้อความนี้ส่งโดยอัตโนมัติจากระบบ KKS Camp</p>
      </div>
    </div>
  </body>
</html>`;
  const text = `${heading}\n\nสวัสดี ${input.recipientName}\n${intro}\n\nค่าย: ${input.campName}\nวันที่: ${input.campDate}\nสถานที่: ${input.location}\nสิ่งที่ต้องทำ: ${input.action}${input.campUrl ? `\n${input.campUrl}` : ""}\n\nข้อความนี้ส่งโดยอัตโนมัติจากระบบ KKS Camp`;

  return { subject: heading, html, text };
}
