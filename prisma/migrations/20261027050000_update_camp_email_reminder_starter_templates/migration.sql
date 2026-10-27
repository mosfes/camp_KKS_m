-- Starter templates (created by the system, not by an admin) switch to the
-- "ลงทะเบียน" wording and get the new includeTeachers setting. Templates an
-- admin saved are left alone, as are starter templates already deleted.
UPDATE `camp_email_reminder_template`
SET `content` = CAST('{"name":"ชวนเข้าร่วมค่าย","audience":"NOT_JOINED","includeTeachers":false,"daysBefore":7,"subject":"อย่าลืมลงทะเบียนเข้าร่วมค่าย [ชื่อค่าย]","heading":"อย่าลืมลงทะเบียนเข้าร่วมค่าย [ชื่อค่าย]","body":"ขณะนี้คุณยังไม่ได้ลงทะเบียนเข้าร่วมค่าย กรุณาลงทะเบียนผ่านระบบก่อนค่ายเริ่ม","action":"ลงทะเบียนเข้าร่วมค่ายในระบบ","buttonLabel":"ลงทะเบียนเข้าร่วมค่าย"}' AS JSON),
    `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `created_by_teacher_id` IS NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(`content`, '$.name')) = 'ชวนเข้าร่วมค่าย';

UPDATE `camp_email_reminder_template`
SET `content` = CAST('{"name":"ชวนเข้าร่วมครั้งสุดท้าย","audience":"NOT_JOINED","includeTeachers":false,"daysBefore":2,"subject":"เหลือเวลาอีกไม่นาน! [ชื่อค่าย] จะเริ่ม[อีกกี่วัน]","heading":"ยังทันลงทะเบียน [ชื่อค่าย]","body":"ค่ายจะเริ่ม[อีกกี่วัน] แต่คุณยังไม่ได้ลงทะเบียน\\n\\nกรุณาลงทะเบียนผ่านระบบโดยเร็ว เพื่อให้ครูจัดเตรียมรถและที่พักได้ครบ","action":"ลงทะเบียนเข้าร่วมค่ายในระบบ","buttonLabel":"ลงทะเบียนตอนนี้"}' AS JSON),
    `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `created_by_teacher_id` IS NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(`content`, '$.name')) = 'ชวนเข้าร่วมครั้งสุดท้าย';

UPDATE `camp_email_reminder_template`
SET `content` = CAST('{"name":"เตรียมของเข้าค่าย","audience":"PARTICIPANTS","includeTeachers":false,"daysBefore":5,"subject":"เตรียมของให้พร้อมสำหรับ [ชื่อค่าย]","heading":"เตรียมของให้พร้อมสำหรับ [ชื่อค่าย]","body":"อีก [จำนวนวันที่เหลือ] วันจะถึงวันเข้าค่าย ลองเช็กของที่ต้องเตรียมไว้แต่เนิ่น ๆ เช่น เสื้อผ้า ยาประจำตัว และของใช้ส่วนตัว\\n\\nรายละเอียดและสิ่งที่ต้องเตรียมทั้งหมดดูได้ในระบบ","action":"ตรวจสอบรายการของที่ต้องเตรียม","buttonLabel":"ดูรายละเอียดค่าย"}' AS JSON),
    `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `created_by_teacher_id` IS NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(`content`, '$.name')) = 'เตรียมของเข้าค่าย';

UPDATE `camp_email_reminder_template`
SET `content` = CAST('{"name":"เตือนเตรียมตัว","audience":"PARTICIPANTS","includeTeachers":true,"daysBefore":3,"subject":"ค่าย [ชื่อค่าย] ใกล้เริ่มแล้ว","heading":"ค่าย [ชื่อค่าย] ใกล้เริ่มแล้ว","body":"เตรียมตัวให้พร้อมสำหรับค่ายที่กำลังจะเริ่ม และตรวจสอบรายละเอียดล่าสุดได้จากระบบ","action":"เตรียมตัวเข้าค่าย","buttonLabel":"ดูรายละเอียดค่าย"}' AS JSON),
    `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `created_by_teacher_id` IS NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(`content`, '$.name')) = 'เตือนเตรียมตัว';

UPDATE `camp_email_reminder_template`
SET `content` = CAST('{"name":"พรุ่งนี้เข้าค่าย","audience":"PARTICIPANTS","includeTeachers":true,"daysBefore":1,"subject":"พรุ่งนี้แล้ว! [ชื่อค่าย]","heading":"ค่าย [ชื่อค่าย] เริ่มพรุ่งนี้","body":"ค่ายจะเริ่มในวันพรุ่งนี้ ([วันเริ่มค่าย]) ที่ [สถานที่]\\n\\nกรุณาตรวจสอบเวลานัดหมาย จุดขึ้นรถ และของที่ต้องเตรียมให้เรียบร้อย พักผ่อนให้เพียงพอนะ","action":"ตรวจสอบเวลานัดหมายและจุดขึ้นรถ","buttonLabel":"ดูรายละเอียดค่าย"}' AS JSON),
    `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `created_by_teacher_id` IS NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(`content`, '$.name')) = 'พรุ่งนี้เข้าค่าย';
