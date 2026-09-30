# แผนปรับปรุงระบบก่อนรองรับผู้ใช้พร้อมกัน 100 คน

> สถานะจาก audit ล่าสุด: โค้ดอัปโหลดรูปโปรไฟล์/กรอบเกียรติบัตรแบบ direct ไป Cloudinary แล้ว แต่ยังไม่ควรเปิด production สำหรับ 100 concurrent จนกว่าจะปิดงานระยะ 0 ด้านสิทธิ์, session, migration และข้อมูลส่วนบุคคล

## ขอบเขต

แผนนี้ครอบคลุมความเสี่ยงทั้งหมดจากการตรวจระบบ โดยจัดลำดับเป็น P0 (แดง), P1 (เหลือง) และ P2 (ปรับปรุงภายหลัง):

- P0: authentication/session, data leakage, production migration, DB connection, upload proxy และ certificate timeout
- ระยะ Authorization ครบทุก API แยกเป็นเฟส 5 เพื่อไม่เปลี่ยนสิทธิ์ทั้งระบบพร้อมกับงาน performance
- P1: payload, Cloudinary lifecycle, validation, attendance idempotency และ rate limit
- P2: certificate cache, observability, lint และ automated load test

## เป้าหมายรวม

- นักเรียน 100 คนเปิดหน้าและส่งภารกิจพร้อมกันได้ โดยไม่เกิด connection exhaustion หรือ Function timeout
- ลด Vercel Active CPU ของเส้นทางนักเรียนอย่างน้อย 60% เมื่อเทียบกับเวอร์ชันก่อนปรับ
- API หน้า dashboard ไม่ส่งข้อมูล mission questions/answers ที่หน้าไม่ได้ใช้
- การอัปโหลดรูปซ้ำไม่สร้างไฟล์กำพร้าเพิ่มใน Cloudinary
- เกียรติบัตรที่เคยสร้างแล้วดาวน์โหลดซ้ำได้โดยไม่ render ใหม่
- ทุกระยะต้อง deploy และ rollback ได้แยกจากกัน

## ลำดับดำเนินงาน

0. ปิดช่องโหว่ session, ข้อมูลส่วนบุคคล และจุดที่แก้ข้อมูลข้ามค่ายได้ชัดเจน
1. จำกัดและรวมการใช้ Prisma Client
2. ลด payload และแยก API ตามหน้าที่
3. กำหนดวงจรชีวิตไฟล์ Cloudinary
4. ทำ certificate cache และ generation แบบ idempotent
5. ทดสอบ load บน local/staging แล้วทยอยเปิด production
6. ทำ Authorization ครบทุก API เป็นเฟส 5 หลัง flow หลักนิ่งแล้ว

---

## ระยะที่ 0: P0 Security และ Data Integrity

### เป้าหมาย

- ไม่มี endpoint ที่ออก session จากข้อมูลระบุตัวตนเพียงอย่างเดียว
- จุดแดงที่มีโอกาสแก้ข้อมูลหรือเห็นข้อมูลข้ามค่ายต้องตรวจ role/owner ก่อน; Authorization ครบทุก API ทำในระยะ 5
- ไม่มี password hash หรือข้อมูลสุขภาพอยู่ใน response/cache ที่ไม่จำเป็น
- deploy production ไม่แก้ schema ด้วย `db push --accept-data-loss`

### งาน authentication/session

- [ ] ปิดหรือย้าย `app/api/auth/login`, `app/api/auth/student/login` และ parent legacy login ให้ใช้ Clerk/รหัสผ่านจริงเท่านั้น
- [ ] ห้ามออก `student_session` จาก `studentId` ที่ผู้ใช้ส่งมาเอง; session ต้องผูกกับ Clerk user/email ที่ยืนยันแล้วและนักเรียน active คนเดียวเท่านั้น
- [ ] บังคับตรวจผู้ใช้ที่ยัง active กับฐานข้อมูลใน `requireTeacher()` และ `requireStudent()` ทุก request
- [ ] ตรวจ role ปัจจุบันจาก DB ไม่เชื่อ role ใน JWT อย่างเดียว
- [ ] ลดอายุ cookie จาก 7 วัน และเพิ่ม session revocation เมื่อถูกลบ/เปลี่ยน role
- [ ] หลังปิด legacy login ให้ rotate `JWT_SECRET` เพื่อยกเลิก custom session เดิมทั้งหมด; ยอมรับการ logout พร้อมกันได้ โดยต้องแสดงข้อความให้ล็อกอิน Google ใหม่และตรวจทุก flow ก่อนเปิด production
- [ ] เพิ่ม rate limit และ account lockout ชั่วคราวสำหรับ login/รหัสนักเรียน
- [ ] เพิ่ม Origin/CSRF protection ใน mutation ที่ใช้ cookie session

### งาน authorization เฉพาะจุดแดงในระยะ 0

ทำเฉพาะ endpoint ที่ถ้าไม่แก้แล้วผู้ใช้สามารถแก้ข้อมูลหรือเห็นข้อมูลข้ามค่ายได้ทันที ส่วนรายการครบทุก API อยู่ในระยะ 5:

- [ ] attendance ที่รับ `campId` ตรวจ `requireCampTeacher(campId)` ทั้ง GET/POST/DELETE
- [ ] mission/station/template ที่เป็น mutation และ mission QR/PIN/results ตรวจ owner/camp ก่อนอ่านหรือแก้
- [ ] pre/post tests, student list และ certificate status ตรวจ owner/camp ก่อนส่งข้อมูลนักเรียน
- [ ] ปิด `/api/upload` แบบรับไฟล์ผ่าน Vercel หรือจำกัดเฉพาะ flow ครูที่ยังจำเป็นจริง

### งานข้อมูลส่วนบุคคล

- [ ] เปลี่ยน student profile จาก `include: { parents: true }` เป็น `select` และไม่ส่ง `parents.password`
- [ ] เปลี่ยน response รายชื่อนักเรียน/สุขภาพเป็น `private, no-store` ห้ามใช้ `public` cache
- [ ] ตรวจว่าทุก response ส่งเฉพาะ fields ที่หน้า UI ต้องใช้

### งานฐานข้อมูลและ deploy

- [ ] เปลี่ยน production build เป็น `prisma migrate deploy` และลบ `db push --accept-data-loss`
- [x] deploy migration metadata certificate ให้ครบก่อนเปิด UI (ทำแล้ว 2026-08-13)
- [ ] เพิ่ม unique constraint ของ attendance: `(attendance_teacher_session_id, student_students_id)`
- [ ] เพิ่ม unique constraint ของ `mission_result`: `(student_enrollment_id, mission_mission_id)` หลังตรวจ duplicate เดิม
- [ ] ตรวจ unique ของ classroom/camp/teacher membership และทำ data cleanup ก่อนเพิ่ม constraint
- [ ] รวม `new PrismaClient()` ให้เหลือ client กลางใน `lib/db.ts`

### เกณฑ์ผ่าน P0

- [ ] ทดสอบ unauthenticated และ teacher จากค่ายอื่นกับทุก P0 endpoint ต้องได้ 401/403
- [ ] ไม่พบ password/hash ใน response จาก profile endpoints
- [ ] ไม่มี route ที่ใช้ `new PrismaClient()` แยกใน `app/api`
- [ ] Production deploy ใช้ migration เท่านั้น และมี rollback/backup ที่ทดสอบแล้ว

---

## ระยะที่ 0.5: P1 Upload และ Input Validation

**สถานะล่าสุด (2026-08-13): โค้ดเสร็จและ build ผ่าน; การตั้งค่า Cloudinary preset บน Vercel และการทดสอบ upload จริงยังค้าง**

### งานอัปโหลด

- [ ] ตั้ง `CLOUDINARY_UPLOAD_PRESET` บน Vercel ทุก environment *(ต้องทำใน Cloudinary/Vercel)*
- [ ] ตั้ง server-side `max_file_size` ของ shared Cloudinary preset เป็น 20 MB *(ต้องทำใน Cloudinary)*
- [x] เพิ่ม preset/commit verification ให้ mission image; ห้ามพึ่ง browser size check อย่างเดียว
- [x] ตรวจ `public_id`, folder, resource type และ Cloudinary host ก่อนบันทึก URL ลง DB
- [ ] ใช้ temporary public ID สำหรับ profile replacement หรือไม่ทำลายรูปเดิมจนกว่า asset ใหม่จะผ่าน commit
- [ ] จำกัด certificate fallback ให้ JPG/PNG หรือแปลง WEBP/HEIC เป็น JPEG ก่อนสร้าง PDF
- [x] หลัง Cloudinary upload สำเร็จแต่ DB PUT ล้มเหลว flow ใหม่ตรวจ commit ก่อนบันทึก metadata และลบ mission asset ที่ไม่ผ่านการตรวจสอบ

### งาน input และ business rule

- [x] ใช้ Zod ตรวจ body ของ mission submit, profile update และ upload commit ที่แก้ในระยะนี้
- [x] ตรวจว่า `answers` เป็น array, question อยู่ใน mission เดียวกัน, type ตรงกับ question และจำนวน/ความยาวไม่เกินกำหนด
- [x] อนุญาตรูป mission เฉพาะ public ID/URL ที่อยู่ใต้ path ของ student/camp/mission/question
- [x] บังคับช่วงเวลาลงทะเบียน, capacity และสถานะค่ายฝั่ง server; classroom eligibility ของโครงสร้างห้องเรียนยังต้องยืนยันกับกติกาค่ายจริง
- [ ] ใช้ `upsert`/unique constraint สำหรับ attendance และ mission result เพื่อให้ retry ปลอดภัย *(ยังไม่เพิ่ม constraint จนกว่าจะตรวจ duplicate ในฐาน production)*

### เกณฑ์ผ่าน

- [ ] ส่ง request ที่แก้ไขเองด้วย question/URL/ไฟล์ของผู้อื่นแล้วต้องถูกปฏิเสธ
- [ ] ไฟล์เกิน limit ถูกปฏิเสธจาก Cloudinary และ API commit โดยไม่ทำลาย asset เดิม
- [ ] retry เดิมซ้ำไม่สร้าง mission result หรือ attendance ซ้ำ

---

## ระยะที่ 1: Prisma connection pool

**สถานะล่าสุด (2026-08-13): โค้ดรวม client และ build separation เสร็จ; ค่า Vercel/TiDB และ load test ยังต้องทำบน environment จริง**

**Incident note (2026-08-13):** พบ `GET /api/camps` ตอบ 500 หลัง deploy; route เพิ่มการ log error code แล้ว สาเหตุคือ Prisma schema ใหม่กับฐาน production ยังไม่ตรงกัน (`P2022`/unknown column) หลังแยก migration ออกจาก build. แก้แล้วโดยตรวจ schema จริง, สำรอง `mission_result.submitted_at` 11 แถว, resolve เฉพาะ migration NFC ที่คอลัมน์มีอยู่แล้ว และ deploy migration ที่เหลือโดยไม่ลบข้อมูล.

**Resolved (2026-08-13):** local log ยืนยัน `P2022: The column camp_kks.camp.img_certificate_public_id does not exist`; migration `20260813000000_add_certificate_image_metadata` เพิ่มคอลัมน์ nullable ครบ 5 ตัวแล้ว. ตรวจสอบว่า `20260726000000_normalize_mission_submission_times` เลื่อนเวลา 11 แถวจาก backup ลง 7 ชั่วโมงพอดี และ `npx prisma migrate status` รายงาน `Database schema is up to date`.

**Backup note (2026-08-13):** ตาราง `mission_result_submitted_at_backup_20260813` ถูกสร้างไว้ชั่วคราวเพื่อย้อนคืนค่าเวลาได้ หากตรวจพบปัญหาหลังเปิดระบบ; ยังไม่ได้ลบจนกว่าจะยืนยันการใช้งานจริง.

**Production clone baseline (2026-08-13):** หลังเปลี่ยน `.env` ให้ชี้ฐานโฮสต์ `camp_kks_clone` พบว่ามีข้อมูลจริง (นักเรียน 400, `mission_result` 41) แต่ไม่มี `_prisma_migrations`. ตรวจ schema แล้วตรงกับโค้ดเดิม เหลือ metadata กรอบเกียรติบัตร 5 คอลัมน์; สำรองเวลา 41 แถว, ทำ baseline แบบ metadata-only สำหรับ migration เดิมทั้งหมด (รวม migration ปรับเวลา 7 ชั่วโมงโดยตั้งใจไม่รัน SQL ซ้ำ) และ deploy เฉพาะ `20260813000000_add_certificate_image_metadata`. ตรวจแล้วเวลาทั้ง 41 แถวยังเหมือน backup และ `prisma migrate status` รายงาน schema up to date.

**Timezone audit (2026-08-13):** โค้ดบันทึกเวลาปัจจุบันด้วย `new Date()` (absolute instant) และหน้าหลักแสดงผลด้วย `Asia/Bangkok`; ไม่พบการบวก/ลบ 7 ชั่วโมงใน route ปัจจุบัน. ฐาน TiDB ใช้ system timezone UTC ตามแนวทางเก็บเวลาแบบ UTC. ข้อมูล mission เก่าของฐานโฮสต์ยังไม่ได้ normalize 7 ชั่วโมงเพราะยังยืนยันไม่ได้ว่าเคยถูกบวกมาก่อน; ต้องตรวจตัวอย่างธุรกิจจริงก่อนทำ data migration. พบจุดแสดงผล/คำนวณที่ยังไม่ได้ระบุ Bangkok ชัดเจนใน `TrackingModal` ใบรับรองและการคำนวณ `fiscal_year` ของ project document.

### ปัญหาปัจจุบัน

- `lib/db.ts` มี client กลางในแต่ละ module แต่เก็บ global เฉพาะ development; production และ route bundle หลายชุดยังมี pool แยกกันได้
- `DATABASE_URL` ใน local ไม่มี `connection_limit` และยังยืนยันไม่ได้ว่า Vercel Production กำหนดไว้หรือไม่
- บาง route สร้าง `new PrismaClient()` เอง ทำให้การควบคุม pool ไม่เป็นจุดเดียว เช่น:
  - `app/api/surveys/results/route.ts`
  - `app/api/surveys/ai-summary/route.ts`
  - `app/api/missions/route.ts`
  - `app/api/missions/[id]/route.ts`
  - `app/api/camps/[id]/pre-post-tests/route.ts`
- TiDB Cloud Starter จำกัด concurrent connections จึงมีโอกาสชนเพดานเมื่อ Vercel scale หลาย instance/หลาย route พร้อมกัน

### ค่าที่เลือกและการคำนวณ

สำหรับ TiDB Cloud Starter แบบฟรี ให้คิดจากเพดาน 400 concurrent connections และกัน 100 connections ไว้สำหรับงาน admin, migration, monitoring และการพุ่งของ traffic จึงให้ application ใช้ได้ไม่เกิน 300 connections:

```text
ผู้ใช้พร้อมกันสูงสุดที่ออกแบบ = 100 คน
สมมติฐานเผื่อแย่สุด = 100 Vercel function instances
connection_limit ต่อ instance = 2
ความต้องการสูงสุดของ application = 100 × 2 = 200 connections
เผื่อ overhead = 300 - 200 = 100 connections
```

ดังนั้นค่าที่ใช้จริงคือ `connection_limit=2` สำหรับ Production ไม่ใช่ 10 หรือค่าที่ปล่อยให้ Prisma เลือกเอง โดยต้องรวม Prisma Client ให้เหลือจุดเดียวก่อน เพราะถ้า instance เดียวมี pool ซ้ำ 2 ชุด จะกลายเป็น `100 × 2 × 2 = 400` และไม่เหลือพื้นที่ให้ระบบอื่น ส่วน Preview ให้ใช้ `1` เมื่อแชร์ฐานเดียวกัน หรือใช้ `2` ได้เมื่อแยกฐาน Preview ออกไป

ถ้าทดสอบแล้ว application แตะ 300 connections, พบ `P2024` หรือ TiDB แจ้ง connection limit ห้ามเพิ่ม `connection_limit` ทันที ให้ลดจำนวน instance/แก้ query หรือเพิ่ม connection pooler/แพ็กเกจฐานข้อมูลก่อน

### งานที่ต้องทำ

- [x] เปลี่ยนทุก route ให้ import `prisma` จาก `@/lib/db` และห้ามสร้าง `PrismaClient` เอง
- [x] ค้นซ้ำทั้ง repository ให้เหลือ `new PrismaClient()` เฉพาะ `lib/db.ts` และ scripts ที่รันนอกเว็บ
- [ ] Production ใช้ `connection_limit=2` และ `pool_timeout=10`; Preview ใช้ `connection_limit=1` หากใช้ฐานเดียวกับ Production และควรแยกฐาน Preview ออกไป *(ต้องตั้งใน Vercel)*
- [ ] กำหนด `pool_timeout` แบบสั้นพอให้ fail ชัดเจนแทนการรอจน Function timeout โดยเริ่มทดสอบที่ 10 วินาที
- [ ] ตรวจว่า URL เดิมมี query string อยู่แล้ว แล้วต่อ parameter ด้วย `&` โดยไม่เขียนทับค่า SSL
- [x] แยกคำสั่ง schema migration ออกจาก `npm run build`; ไม่ใช้ `prisma db push --accept-data-loss` ทุกครั้งที่ deploy production
- [ ] เพิ่ม structured logging สำหรับ Prisma error, route, duration และ error code โดยไม่ log query parameter หรือข้อมูลส่วนบุคคล

ตัวอย่างรูปแบบ URL เท่านั้น ห้ามใส่ credential จริงลง Git:

```text
mysql://USER:PASSWORD@HOST:4000/DB?sslaccept=strict&connection_limit=2&pool_timeout=10
```

### การทดสอบ

- [x] `rg "new PrismaClient"` ยืนยันว่า route ใช้ client กลางทั้งหมด
- [ ] เปิดหน้า dashboard, หน้าค่าย, หน้าภารกิจ, เช็คชื่อ และ survey ครบทุก flow
- [ ] ยิง read-only flow 100 virtual users บน local/staging โดยใช้ฐานข้อมูลทดสอบ
- [ ] ตรวจค่า connection สูงสุดใน TiDB ระหว่างทดสอบ เป้าหมาย production ไม่เกิน 300 connections
- [ ] ไม่มี `P2024`, connection timeout, connection reset หรือ `Too many connections`

### เกณฑ์เสร็จ

- [ ] Production ใช้ `connection_limit=2`; Preview ใช้ `1` เมื่อแชร์ฐานเดียวกัน หรือใช้ `2` ได้เมื่อแยกฐาน Preview
- [x] ไม่มี route handler สร้าง Prisma Client แยกเอง
- p95 ของ API นักเรียนไม่แย่ลงเกิน 10% หลังลด pool
- ทดสอบ 100 users แล้ว error rate ต่ำกว่า 1%

### Rollback

- คืนค่า `DATABASE_URL` เวอร์ชันก่อนหน้าใน Vercel แล้ว redeploy
- การรวม Prisma import เป็นการเปลี่ยนโค้ดแบบย้อนกลับได้และไม่มี schema change

### ผลทดสอบโค้ดของระยะ 0.5–1

- [x] `npx prisma validate` ผ่าน
- [x] `npx tsc --noEmit --incremental false` ผ่าน
- [x] `npx next build` ผ่านและสร้าง route upload-commit ใหม่ครบ
- [x] ESLint เฉพาะ route/helper ที่แก้ในระยะนี้ไม่พบ error (เหลือ warning รูปแบบ/import และ console เดิม 20 รายการ)
- [x] ตรวจ `rg "new PrismaClient" app/api lib` เหลือเฉพาะ `lib/db.ts`
- [x] `git diff --check` ผ่าน
- [x] `npx prisma migrate status` รายงาน `Database schema is up to date` หลัง deploy migration บนฐานจริง
- [ ] ทดสอบ upload จริงกับ Cloudinary preset ทุก environment
- [ ] ยิง load test 100 users และอ่านค่า connection สูงสุดจาก TiDB

---

## ระยะที่ 2: ลด dashboard overfetch

**สถานะล่าสุด (2026-08-13): แยกการโหลดฝั่งนักเรียนเสร็จในโค้ดและ build ผ่าน; ยังเหลือการวัด payload จริงและ load test 100 users.**

ลำดับการโหลดปัจจุบัน:

- Dashboard เรียก `/api/student/camps` เฉพาะข้อมูลสรุปค่าย
- รายละเอียดค่ายเรียก `/api/student/camps/[id]` เมื่อกดเข้าค่าย โดยมี schedule และ mission progress summary แต่ไม่มี questions/choices/answers
- รายการฐาน/ภารกิจเรียก `/api/student/camps/[id]/missions` เมื่อเปิดหน้าภารกิจ
- คำถาม ตัวเลือก และคำตอบเดิมเรียก `/api/student/camps/[id]/missions/[stationId]` เมื่อเปิดฐานนั้นเท่านั้น

### ปัญหาปัจจุบัน

- `GET /api/student/camps` ยังโหลดข้อมูล station, mission, questions, choices และ mission answers แม้หน้า `student/dashboard` ใช้เพียงข้อมูลสรุปค่าย
- หน้า detail และ mission หลายหน้าร้องขอโครงสร้างค่ายขนาดใหญ่ซ้ำกัน
- payload และเวลาสร้าง JSON จะเพิ่มตามจำนวนค่าย ฐาน ภารกิจ และคำตอบของนักเรียน
- การใช้ `cache: "no-store"` ทุกหน้า ทำให้กลับเข้าหน้าเดิมแล้วต้องดึงข้อมูลทั้งหมดใหม่

### รูปแบบ API เป้าหมาย

#### `GET /api/student/camps`

ใช้สำหรับหน้า dashboard เท่านั้น ส่งเฉพาะ:

- id, title, description แบบย่อ, location
- วันที่ค่ายและวันที่ลงทะเบียน
- isRegistered, hasEnrollment, isEnded, hasSurvey
- academicYear และรูปปก
- ไม่ส่ง station, mission, questions, choices, mission answers และตารางเวลาทั้งชุด

#### `GET /api/student/camps/[id]`

ใช้สำหรับหน้ารายละเอียดค่าย ส่ง metadata, ตารางเวลา, เสื้อ, capacity และ progress summary แต่ไม่ส่งคำตอบเต็มทุกข้อ

#### `GET /api/student/camps/[id]/missions`

ส่งรายการฐาน/ภารกิจและสถานะ completed/pending ของนักเรียน โดยส่งเฉพาะ id/status ไม่ส่ง answer payload

#### `GET /api/student/camps/[id]/missions/[stationId]`

ส่งคำถามของฐานที่เปิดอยู่และคำตอบเดิมของนักเรียนเฉพาะฐานนั้น

### งานที่ต้องทำ

- [ ] สร้าง response types ด้วย TypeScript หรือ Zod สำหรับแต่ละ endpoint
- [x] เปลี่ยน Prisma `include` เป็น `select` และเลือกเฉพาะ field ที่ UI ใช้จริงใน student summary/detail/mission/station routes
- [x] ทำ dashboard query ให้ได้ข้อมูลในจำนวน query คงที่ ไม่วน query ต่อค่าย
- [x] ย้าย progress computation ที่ต้องใช้เพียง count/status ให้ query เฉพาะ `mission_id` และ `status`
- [x] เปลี่ยนหน้า dashboard/detail/missions/station ให้เรียก endpoint ที่ตรงกับหน้าที่
- [x] หลัง submit สำเร็จ update state เฉพาะ mission ที่เปลี่ยน ไม่ refetch โครงสร้างค่ายทั้งหมด
- [ ] ใช้ client cache/SWR สำหรับข้อมูล metadata ที่ไม่เปลี่ยนถี่ และ revalidate เฉพาะ progress
- [ ] ใส่ header ชั่วคราวใน staging เช่น `Server-Timing` และ `X-Response-Bytes` เพื่อวัดก่อน/หลัง แล้วนำออกหรือปิดใน production หากไม่จำเป็น

### งบ payload

- Dashboard summary: ไม่เกิน 50 KB ต่อผู้ใช้ในข้อมูลปัจจุบัน
- Camp detail: ไม่เกิน 100 KB
- Missions list: ไม่เกิน 100 KB
- Station detail: ไม่เกิน 200 KB และต้องไม่โตตามจำนวนนักเรียนคนอื่น
- ทุก response ต้องต่ำกว่า Vercel 4.5 MB อย่างน้อย 10 เท่า

### การทดสอบ

- [x] ตรวจ response shape ของทั้ง 4 endpoints ด้วย typecheck/build และ Prisma relation query บนฐานจริง; ยังไม่มี snapshot อัตโนมัติ
- [ ] ทดสอบนักเรียนที่ยังไม่ลงทะเบียน, ลงทะเบียนแล้ว, มี draft, completed และไม่มีห้องเรียน
- [ ] ทดสอบค่ายที่มีหลายฐาน/หลายภารกิจ/หลาย choice
- [ ] เปรียบเทียบ response bytes และ duration ก่อน/หลัง
- [ ] เปิดหน้าเดียวกันซ้ำและตรวจว่าไม่มี request ที่ดึง answer ของนักเรียนคนอื่น
- [ ] ทดสอบ 100 users เปิด dashboard พร้อมกันและ 100 users เปิด station เดียวกัน

### เกณฑ์เสร็จ

- `/api/student/camps` ไม่มี `mission_answer`, `answer_photo` หรือ `mission_question` ใน response
- response ไม่โตตามจำนวนนักเรียนในค่าย
- Active CPU และ transferred bytes ของ student camp routes ลดอย่างน้อย 60%
- p95 dashboard API ต่ำกว่า 1 วินาทีใน staging ที่ region Singapore

### Rollback

- เก็บ endpoint เดิมไว้ชั่วคราวหนึ่ง deployment หลัง UI ย้ายครบ
- ใช้ feature flag สลับ UI กลับ endpoint เดิมได้ โดยไม่ต้องย้อน schema

---

## ระยะที่ 3: จัดการไฟล์ Cloudinary ไม่ให้ค้าง

### ปัญหาปัจจุบัน

- Cloudinary คืนทั้ง `secure_url` และ `public_id` แต่ฐานข้อมูลเก็บเฉพาะ URL
- upload สำเร็จแต่ผู้ใช้ปิดหน้า/submit ไม่สำเร็จ จะมีไฟล์ที่ไม่มี record ใน DB
- การอัปโหลดรูปใหม่แทนรูปเดิมใช้ public ID ใหม่ จึงทำให้รูปเดิมค้าง
- การลบ mission, camp, student หรือ draft ใน DB ไม่ได้ลบ asset ที่เกี่ยวข้อง

### แนวทางหลัก

ใช้ public ID แบบ deterministic ต่อคำถาม และเก็บ public ID ในฐานข้อมูล:

```text
camp-submissions/{campId}/{missionId}/{studentId}/{questionId}
```

การอัปโหลดคำถามเดิมซ้ำต้องใช้ `overwrite=true` และ `invalidate=true` เพื่อแทนไฟล์เดิมแทนการสร้าง asset ใหม่

### Schema ที่เสนอ

เพิ่มข้อมูลใน `mission_answer_photo`:

```prisma
public_id String? @db.VarChar(255)
bytes     Int?
format    String? @db.VarChar(20)
```

เริ่มเป็น nullable เพื่อรองรับข้อมูลเก่าที่มีเฉพาะ URL

### งานที่ต้องทำ

- [ ] ให้ signature route เป็นผู้กำหนด `public_id`; client ห้ามกำหนด path เอง
- [ ] sign ค่า folder/public_id/transformation/overwrite ที่ต้องใช้ทั้งหมด
- [ ] ส่ง `{ url, publicId, bytes, format }` ไป mission submit API แทน URL string อย่างเดียว
- [ ] ตรวจว่า public ID อยู่ใต้ path ของ camp/mission/student/question ที่ session มีสิทธิ์จริง
- [ ] บันทึก metadata ลง `mission_answer_photo`
- [ ] เมื่อแทนรูป ให้ overwrite public ID เดิม
- [ ] เมื่อยกเลิก draft, ลบ mission/camp หรือยกเลิกนักเรียน ให้ลบ Cloudinary asset หลัง DB transaction commit แล้วเท่านั้น
- [ ] ห้ามเรียก Cloudinary Admin API ภายใน DB transaction เพราะจะทำให้ lock ค้างระหว่างรอ network
- [ ] เพิ่ม cleanup job table หรือ retry mechanism สำหรับกรณี DB สำเร็จแต่ Cloudinary delete ล้มเหลว
- [ ] จำกัดจำนวนการขอ upload signature ต่อ student/mission ในช่วงเวลาสั้น เพื่อป้องกัน retry loop กิน quota

### ทำความสะอาดข้อมูลเดิม

- [ ] เขียน script แบบ dry-run ที่ list asset ใต้ `camp-submissions/`
- [ ] สร้างรายการ public ID ที่ DB ยังอ้างอิงอยู่ โดยแปลงจาก URL เก่าเมื่อทำได้
- [ ] แสดงเฉพาะจำนวน/ขนาด/อายุของ orphan ห้ามลบทันที
- [ ] ลบเฉพาะไฟล์ที่ไม่ถูกอ้างอิงและเก่ากว่า 7 วัน หลังตรวจรายงานและได้รับอนุมัติ
- [ ] เก็บ log ของ public ID ที่ลบเพื่อ audit และกู้คืนจาก backup/revision หากแผนรองรับ

### การทดสอบ

- [ ] อัปโหลดคำถามเดิม 5 ครั้ง จำนวน Cloudinary resources ต้องยังเป็น 1
- [ ] จำลอง upload สำเร็จแต่ปิดหน้า แล้ว cleanup สามารถพบไฟล์ดังกล่าว
- [ ] จำลอง Cloudinary delete ล้มเหลว แล้ว retry ภายหลังได้
- [ ] นักเรียน A ไม่สามารถออก signature ไป path ของนักเรียน B
- [ ] URL เก่าที่ไม่มี `public_id` ยังคงแสดงผลได้

### เกณฑ์เสร็จ

- การแทนรูปไม่เพิ่มจำนวน resources
- asset ใหม่ทุกไฟล์มี owner path ที่ตรวจสอบย้อนกลับได้
- orphan ที่เกิดจาก flow ปกติถูกลบหรือเข้าคิว cleanup ภายใน 24 ชั่วโมง
- ไม่มีการลบ asset ก่อน DB commit สำเร็จ

### Rollback

- field ใหม่เป็น nullable จึง rollback application code ได้โดยไม่ต้องลบ column ทันที
- ปิด cleanup worker ก่อน rollback เพื่อป้องกันการลบจากกฎคนละเวอร์ชัน

---

## ระยะที่ 4: ลด Active CPU ของเกียรติบัตร

### ปัญหาปัจจุบัน

- individual certificate route fetch template, parse image, embed font และสร้าง PDF/PNG ใหม่ทุกครั้ง
- certificate record มี `file_url` แต่ปัจจุบันสร้างด้วยค่าว่างและไม่ได้ใช้เป็น cache จริง
- หากนักเรียน 100 คนดาวน์โหลดพร้อมกัน จะเกิดงาน CPU-heavy พร้อมกัน
- bulk route สร้างเอกสารหลายหน้าทั้งก้อนใน Function เดียว เสี่ยง memory สูงและ timeout

### แนวทางหลัก

สร้างครั้งเดียว เก็บไฟล์ แล้วให้ครั้งต่อไป redirect ไป CDN:

1. ตรวจ certificate cache จาก `certificate_id + certificate_no + render_version + format`
2. ถ้ามีไฟล์ที่ valid ให้ตอบ redirect หรือ signed URL ทันที
3. ถ้ายังไม่มี ให้ล็อกงานของนักเรียนคนนั้น สร้างเพียงหนึ่งครั้ง
4. อัปโหลดผลลัพธ์ไป Cloudinary/Object Storage
5. บันทึก URL, public ID, format, bytes และ render version
6. request ถัดไปไม่เรียก `pdf-lib` หรือ `ImageResponse`

### Schema ที่เสนอ

ประเมินว่าจะขยาย `certificate` หรือแยก `certificate_asset` หากต้องเก็บทั้ง PDF และ PNG:

```prisma
model certificate_asset {
  certificate_asset_id Int @id @default(autoincrement())
  certificate_id       Int
  format               String @db.VarChar(10)
  file_url             String @db.VarChar(500)
  public_id            String @db.VarChar(255)
  render_version       String @db.VarChar(64)
  bytes                Int?
  created_at           DateTime @default(now())

  @@unique([certificate_id, format, render_version])
}
```

`render_version` ควรคำนวณจาก template public ID/version และค่าตำแหน่ง/ขนาด/สี/รูปแบบเลขที่ที่มีผลต่อภาพ เพื่อให้แก้ template แล้ว cache เก่าหมดอายุโดยอัตโนมัติ

### กติกาเมื่อเปลี่ยนเลขที่รัน

- เลขที่ที่ถูก assign ให้ใบรับรองแล้วต้องถือเป็น immutable โดยค่าเริ่มต้น
- การเปลี่ยน `cert_number_start`/`cert_number_end` มีผลกับนักเรียนที่ยังไม่มีเลขเท่านั้น ไม่ควรเปลี่ยนเลขของใบที่ออกไปแล้วโดยอัตโนมัติ
- การเปลี่ยน prefix, ปี, เลขไทย/อารบิก, ตำแหน่ง, ขนาด หรือสี ทำให้ `render_version` ใหม่ แต่ยังใช้ `certificate_no` เดิม แล้วสร้าง asset เวอร์ชันใหม่
- การกด `บันทึกการตั้งค่า` อย่างเดียวห้ามสร้าง asset ใหม่หรือเปลี่ยนไฟล์ของใบที่ออกแล้ว; ค่าที่เปลี่ยนมีผลกับใบที่ยังไม่ออกเท่านั้น
- ใบที่ออกแล้วต้องเก็บ `certificate_no` และ `issued_render_version`/asset ที่ใช้จริงไว้กับใบ ใบเดิมต้องดาวน์โหลดไฟล์เดิมได้เสมอ แม้ภายหลังจะแก้ template หรือรูปแบบเลข
- การสร้างไฟล์ใหม่ให้ใบเดิมต้องเป็นคำสั่งแยกที่ยืนยันชัดเจน ใช้ `certificate_no` เดิมก่อน และเก็บ asset เก่าไว้จนกว่า asset ใหม่จะสร้างและตรวจสอบสำเร็จ เพื่อไม่ให้เลขในฐานข้อมูลกับไฟล์ที่เคยดาวน์โหลดคลาดกัน
- หากต้องการรันเลขใหม่ให้คนที่ออกแล้ว ต้องเป็นคำสั่งแยกชื่อ `Re-number certificates` พร้อมยืนยันซ้ำ ไม่ใช่ผลข้างเคียงจากการแก้ค่าค่าย
- การ re-number ต้อง lock camp, assign เลขใน transaction, เพิ่ม `numbering_version`, เก็บประวัติเลขเดิม และ invalidate asset ที่เกี่ยวข้องก่อนสร้างไฟล์ใหม่
- ห้ามลบ URL/asset เดิมจนกว่าไฟล์เวอร์ชันใหม่จะสร้างและบันทึกสำเร็จ เพื่อให้ rollback ได้
- ต้องกำหนดชัดเจนว่า `cert_number_end` เป็น hard stop หรือเพียงแจ้ง overflow; ถ้าเป็น hard stop ห้าม assign เลขเกินช่วง

ตัวอย่าง cache key:

```text
certificate:{certificateId}:{format}:number-{certificateNo}:render-{renderVersion}
bulk:{campId}:{condition}:numbering-{numberingVersion}:render-{renderVersion}
```

### งานที่ต้องทำ

- [ ] แยก pure render function ออกจาก route handler เพื่อทดสอบได้
- [ ] cache font bytes ระดับ module ไม่อ่าน/เตรียมใหม่ทุก request
- [ ] cache template download ระยะสั้นใน warm instance แต่ยังต้องใช้ persistent generated asset เป็น cache หลัก
- [ ] เพิ่ม unique key ป้องกันสอง request สร้าง certificate เดียวกันพร้อมกัน
- [ ] assign `certificate_no` ก่อน render และใช้เลขเดิมทุก retry ของ enrollment เดิม
- [ ] เพิ่ม `numbering_version` หรือเทียบเท่าเพื่อแยกการเปลี่ยนเลขแบบปกติกับการ re-number ทั้งค่าย
- [ ] ทำ endpoint/หน้าจอ re-number แยก พร้อม preview, confirmation, audit log และ rollback
- [ ] ในหน้าแก้ไขให้แยกปุ่ม `บันทึกการตั้งค่า` (ไม่เปลี่ยนเลขเดิม) กับปุ่มอันตราย `รันเลขใหม่ทั้งค่าย` (เปลี่ยนเลขและสร้างไฟล์ใหม่)
- [ ] ปุ่ม `รันเลขใหม่ทั้งค่าย` ต้องแสดงจำนวนใบที่จะได้รับผลกระทบและต้องยืนยันซ้ำก่อนทำงาน
- [ ] ถ้ามี cache valid ให้ redirect ไป CDN โดยไม่ fetch template
- [ ] อัปโหลด PDF เป็น raw resource และ PNG เป็น image resource หรือเลือก storage ที่รองรับตามแผน
- [ ] เปลี่ยน bulk generation ให้ทำเป็น batch ขนาดเล็ก มี progress และ concurrency จำกัด
- [ ] สร้าง bulk PDF ครั้งเดียวต่อ `campId + render_version` แล้ว cache URL เช่นเดียวกัน
- [ ] invalidate individual/bulk cache เมื่อแก้ template หรือ certificate settings
- [ ] จำกัดสิทธิ์ bulk generation เฉพาะครูที่เกี่ยวข้องกับค่าย

### การทดสอบ

- [ ] request certificate ครั้งแรกสร้างไฟล์และบันทึก cache
- [ ] request ครั้งที่สองไม่เรียก renderer และตอบภายใน 300 ms ไม่รวม CDN download
- [ ] ยิง request certificate คนเดียวกันพร้อมกัน 20 ครั้ง ต้องสร้าง asset เพียง 1 ไฟล์
- [ ] เปลี่ยน font size/template แล้วได้ render version ใหม่
- [ ] เปลี่ยนช่วง start/end แล้วนักเรียนที่มีเลขเดิมยังได้เลขเดิม และนักเรียนใหม่ใช้ช่วงใหม่
- [ ] เปลี่ยน prefix/ปี/รูปแบบเลขแล้วได้ asset ใหม่ แต่ `certificate_no` เดิมไม่เปลี่ยน
- [ ] re-number แบบ explicit เปลี่ยนเลขและ invalidates เฉพาะ asset ที่ได้รับผลกระทบ
- [ ] ทดสอบชื่อไทยยาว, prefix, เลขไทย, ไม่มีเลขที่ และเลขเกินช่วง
- [ ] ทดสอบ bulk 100 คน โดย memory/CPU ไม่เกิน budget ที่กำหนด

### เกณฑ์เสร็จ

- cache hit ของ certificate download สูงกว่า 90% หลังเปิดใช้งานหนึ่งรอบ
- cache hit ใช้ Active CPU ใกล้ศูนย์และไม่โหลด template
- ไม่มี certificate asset ซ้ำสำหรับ key เดียวกัน
- bulk 100 คนสำเร็จโดยไม่เกิน Function duration และไม่เกิน memory limit

### Rollback

- เก็บ renderer เดิมไว้หลัง feature flag หนึ่ง deployment
- ถ้า storage/cache มีปัญหา ให้ปิด cache read/write และกลับไป generate on demand
- ห้ามลบ generated assets ระหว่าง rollback จนกว่าจะยืนยันว่าไม่มี URL ถูกใช้งาน

---

## ระยะที่ 5: Authorization ครบทุก API (เฟสแยก)

เฟสนี้ยังไม่ต้องทำพร้อมกับการลด CPU/เปลี่ยน upload ให้ทำหลัง flow หลักนิ่งและมี test user ครบ โดยตรวจสิทธิ์ใน route handler ด้วย ไม่พึ่ง middleware หรือ role ใน cookie อย่างเดียว

### Helper ที่ต้องใช้ร่วมกัน

- `requireStudentSelf()` — ได้ `studentId` จาก session ที่ยืนยันแล้ว ห้ามรับ `studentId` จาก body/query มาใช้ตรง ๆ
- `requireParentSelf()` — จำกัดข้อมูลเฉพาะบุตรที่ parent คนนั้นมีความสัมพันธ์จริง
- `requireTeacher()` — ตรวจครู active และ role ปัจจุบันจากฐานข้อมูล
- `requireCampTeacher(campId)` — ตรวจว่าครูมี membership/owner ของค่ายนั้นจริง
- `requireAdmin()` — ใช้กับข้อมูลกลางและงานจัดการบัญชี ไม่ใช้เพียง `role` ที่ผู้ใช้ส่งมา
- `requireResourceOwner()` — ตรวจว่า `mission`, `station`, `template`, `survey` หรือเอกสารอยู่ใต้ค่ายที่ผู้ใช้มีสิทธิ์

### 3.1 นักเรียน: ข้อมูลของตัวเองเท่านั้น

- [ ] `GET /api/student/camps` และ `GET /api/student/camps/[id]`
- [ ] `POST/PUT /api/student/enroll` ตรวจ student จาก session และกติกาค่าย
- [ ] `GET/POST /api/student/attendance/checkin` ตรวจ enrollment ของนักเรียนในค่าย
- [ ] `POST /api/student/mission/qr-scan` และ `POST /api/student/mission/submit` ตรวจ mission/camp/enrollment เดียวกัน
- [ ] `POST /api/student/mission/upload-signature` ตรวจ mission ที่นักเรียนมีสิทธิ์ส่ง
- [ ] `GET/PUT /api/student/profile` และ `POST /api/student/profile/upload-*` ตรวจ student จาก session; ห้ามแก้ profile ของคนอื่น
- [ ] `GET/POST /api/student/surveys` ตรวจว่าผู้ตอบอยู่ในค่ายและตอบได้ครั้งเดียวตามสถานะ

### 3.2 ผู้ปกครอง: เฉพาะบัญชีและบุตรที่ผูกไว้

- [ ] `GET /api/parent/camps`
- [ ] `GET/POST /api/parent/profile`
- [ ] `GET /api/auth/parent/me`, `POST /api/auth/parent/logout` ตรวจ parent session
- [ ] ถอด fallback รหัสผ่าน/รหัสนักเรียนที่เดาได้จาก parent login และจำกัดข้อมูลที่ส่งกลับ

### 3.3 ครู/เจ้าของค่าย: เฉพาะค่ายที่เกี่ยวข้อง

- [ ] `GET/POST /api/camps` และ `GET/PUT/DELETE /api/camps/[id]`
- [ ] `/api/camps/[id]/enrollments`, `students`, `students/breakdown`, `tracking`, `shirts`, `location`
- [ ] `/api/camps/[id]/pre-post-tests`, `project-document`, `project-document/pdf`
- [ ] `/api/camps/[id]/certificate`, `certificate-status`, `certificate/bulk`, `certificate/upload-signature`
- [ ] `/api/attendance/[campId]/manual-checkin`, `qr`, `nfc-checkin`, `results` ทั้ง GET/POST/DELETE
- [ ] `/api/missions`, `/api/missions/[id]`, `/api/missions/[id]/qr`, `/api/missions/[id]/results`
- [ ] `/api/stations`, `/api/stations/[id]`, `/api/templates`, `/api/templates/[id]`
- [ ] `/api/surveys`, `/api/surveys/results`, `/api/surveys/ai-summary`, `/api/surveys/templates` ตรวจ owner/camp ตามชนิดข้อมูล
- [ ] `/api/teacher/profile`, `/api/teacher/homeroom` จำกัดข้อมูลของครูที่ล็อกอิน

### 3.4 ผู้ดูแลระบบ: ข้อมูลกลางและการจัดการบัญชี

- [ ] `/api/teachers`, `/api/teachers/admin`, `/api/students`, `/api/students/admin`, `/api/students/promote`
- [ ] `/api/classrooms`, `/api/classrooms/admin`, `/api/classroom-types`, `/api/academic_years`
- [ ] `/api/camps/admin`, `/api/camps/stats`, `/api/overview`
- [ ] `/api/document-personnel`, `/api/document-personnel/[id]`
- [ ] `/api/document-reference-options`, `/api/document-reference-options/[id]`
- [ ] `/api/project-document-templates`, `/api/project-document-templates/[id]`
- [ ] `/api/vulgar-words`, `/api/vulgar-words/[id]`
- [ ] `/api/teacher/profile` และ `/api/parent/profile` ไม่ควรใช้เป็นช่องทางแก้ข้อมูลผู้ใช้อื่น

### 3.5 Auth, upload และ endpoint ที่ต้องกำหนดให้ชัด

- [ ] `/api/auth/login`, `/api/auth/student/login`, `/api/auth/parent/login`, `/api/auth/sync-session` ใช้เฉพาะ flow ที่อนุมัติและมี rate limit
- [ ] `/api/auth/me`, `/api/auth/student/me`, `/api/auth/parent/me` ตรวจ session ที่ยัง active กับฐานข้อมูล
- [ ] `/api/upload` และ `/api/upload/signature` ปิด proxy รับไฟล์ผ่าน Vercel หรือจำกัด role/ขนาด/ชนิดไฟล์ชัดเจน
- [ ] `/api/students/check` และ `/api/teachers/check` ส่งผลตรวจขั้นต่ำ ไม่เปิดเผยข้อมูลค้นหาได้เป็นจำนวนมาก

### เกณฑ์ผ่านเฟส 5

- [ ] สร้าง authorization matrix ครบทุก route และทุก HTTP method
- [ ] unauthenticated ได้ 401, role ผิดได้ 403 และครูค่าย A เข้าข้อมูลค่าย B ไม่ได้
- [ ] ทดสอบ ID เปลี่ยนใน URL/body/query ทุก endpoint ที่มี resource ID
- [ ] ไม่มีข้อมูลสุขภาพ, password hash, survey response หรือ mission answer ของบุคคลอื่นใน response
- [ ] เปิดใช้งานทีละกลุ่ม route พร้อม feature flag/rollback ไม่ deploy ทุก route ใน commit เดียว

---

## การวัดผลและ Load Test

### Metrics ที่ต้องเก็บ

- Vercel Active CPU แยกตาม Function
- Function invocations, duration, memory และ error rate
- response bytes และ p50/p95/p99 ต่อ endpoint
- TiDB connections, RU, query latency และ transaction retry
- Cloudinary resource count, storage, bandwidth และ failed uploads/deletes
- certificate cache hit/miss และ render duration

### Scenario ทดสอบขั้นต่ำ

1. 100 users เปิด student dashboard พร้อมกัน
2. 100 users เปิดค่ายเดียวกันและฐานเดียวกัน
3. 100 users ขอ upload signature แล้วอัปโหลดตรง Cloudinary
4. 100 users submit ภารกิจพร้อมกัน โดยใช้คนละ student
5. 20 repeated submissions ของ student เดียวกัน
6. 100 users เช็คชื่อพร้อมกันเพื่อดูผลกระทบร่วม แม้ไม่แก้ attendance ในแผนนี้
7. 100 users ขอ certificate ที่ยังไม่ cache และทดสอบซ้ำเมื่อ cache แล้ว

ห้ามยิง load test เต็มรูปแบบใส่ production Vercel โดยไม่มีการอนุญาต ควรใช้ local/staging, test database และ Cloudinary test folder ก่อน

## แผน Rollout

### Deployment A — Connection safety

- รวม Prisma Client
- ตั้ง connection limit ใน Preview
- ทดสอบแล้วจึงตั้ง Production

### Deployment B — Read-path optimization

- เปิด endpoint ใหม่หลัง feature flag
- ย้าย UI ทีละหน้า
- เปรียบเทียบ CPU/payload 24 ชั่วโมงก่อนปิด endpoint เดิม

### Deployment C — Cloudinary lifecycle

- deploy nullable schema ก่อน
- เริ่มเขียน public ID สำหรับไฟล์ใหม่
- เปิด overwrite deterministic ID
- เปิด cleanup แบบ dry-run ก่อนเปิด delete จริง

### Deployment D — Certificate cache

- cache individual PDF ก่อน
- เพิ่ม PNG และ bulk ภายหลัง
- เปิดให้ครูกลุ่มเล็กทดสอบก่อนเปิดทั้งระบบ

## Definition of Done รวม

- [ ] TypeScript check และ production build ผ่าน
- [ ] migration มีไฟล์ SQL ชัดเจนและไม่มี `--accept-data-loss`
- [ ] automated tests ครอบคลุม authorization, idempotency และ concurrent requests
- [ ] 100-user staging test ผ่านตาม error/latency budget
- [ ] มี dashboard หรือรายงานก่อน/หลังสำหรับ Active CPU, payload และ DB connections
- [ ] มี feature flag หรือ rollback path สำหรับทุก deployment
- [ ] runbook ระบุวิธีตรวจ Vercel, TiDB และ Cloudinary เมื่อเกิดเหตุ
