import assert from "node:assert/strict";
import test from "node:test";

import { createCampReminderEmail } from "../lib/camp-reminder-email";

test("renders the starting reminder with camp details and a link", () => {
  const email = createCampReminderEmail({
    recipientName: "น้องอีฟ",
    campName: "ค่ายวิทยาศาสตร์",
    campDate: "12 กันยายน 2569",
    location: "SC09",
    action: "เตรียมตัวเข้าค่าย",
    campUrl: "https://camp.example/student/dashboard/camp/1",
    kind: "starting",
  });

  assert.match(email.subject, /ใกล้เริ่มแล้ว/);
  assert.match(email.html, /12 กันยายน 2569/);
  assert.match(email.html, /https:\/\/camp\.example/);
  assert.match(email.text, /SC09/);
});

test("renders the final reminder for the day before camp", () => {
  const email = createCampReminderEmail({
    recipientName: "คุณครู",
    campName: "ค่ายวิทยาศาสตร์",
    campDate: "12 กันยายน 2569",
    location: "SC09",
    action: "ตรวจสอบรายละเอียดและเตรียมตัวสำหรับวันพรุ่งนี้",
    campUrl: "https://camp.example/headteacher/dashboard/camp/1",
    kind: "tomorrow",
  });

  assert.match(email.subject, /เริ่มพรุ่งนี้แล้ว/);
  assert.match(email.html, /ค่ายจะเริ่มในวันพรุ่งนี้/);
  assert.match(email.text, /เตรียมตัวสำหรับวันพรุ่งนี้/);
});

test("escapes database content before placing it in HTML", () => {
  const email = createCampReminderEmail({
    recipientName: '<script>alert("x")</script>',
    campName: "Camp & Learn",
    campDate: "12 กันยายน 2569",
    location: "A < B",
    action: "เข้าร่วม",
    campUrl: "",
    kind: "join",
  });

  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /Camp &amp; Learn/);
});
