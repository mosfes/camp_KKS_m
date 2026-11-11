/**
 * สวิตช์เปิด/ปิดฟีเจอร์ทั้งระบบ
 *
 * LOCATION_TRACKING_ENABLED: ติดตามตำแหน่งนักเรียนด้วย GPS
 * ปิดไว้ = ซ่อนเมนู/แท็บ/แผนที่ติดตามตำแหน่งจากครู นักเรียน และผู้ปกครองทุกคน
 * และ API /api/camps/[id]/location จะตอบ 404 (ไม่รับ/ไม่ส่งพิกัด)
 * เปลี่ยนเป็น true เพื่อเปิดกลับ
 */
export const LOCATION_TRACKING_ENABLED = false;

/**
 * AI_VULGAR_FILTER_ENABLED: ให้ AI (Gemini) ตรวจคำหยาบตอนนักเรียนส่งแบบสอบถาม
 * ปิดไว้เพราะทำให้ส่งแบบสอบถามช้า (ต้องรอ AI ตอบทุกครั้ง)
 * การกรองด้วยรายการคำหยาบในฐานข้อมูลยังทำงานตามปกติ
 */
export const AI_VULGAR_FILTER_ENABLED = false;
