INSERT INTO `document_reference_option`
  (`category`, `label`, `indicators`, `is_active`, `sort_order`, `created_at`, `updated_at`)
VALUES
  (
    'STANDARD',
    'มาตรฐานที่ 1 คุณภาพของผู้เรียน',
    JSON_ARRAY(
      JSON_OBJECT('code', '1.1.1', 'label', 'มีความสามารถในการอ่าน การเขียน การสื่อสาร และการคิดคำนวณ', 'clauseCode', '1.1', 'clauseLabel', 'ผลสัมฤทธิ์ทางวิชาการของผู้เรียน'),
      JSON_OBJECT('code', '1.1.2', 'label', 'มีความสามารถในการคิดวิเคราะห์ คิดอย่างมีวิจารณญาณ อภิปรายแลกเปลี่ยนความคิดเห็น และแก้ปัญหา', 'clauseCode', '1.1', 'clauseLabel', 'ผลสัมฤทธิ์ทางวิชาการของผู้เรียน'),
      JSON_OBJECT('code', '1.1.3', 'label', 'มีความสามารถในการสร้างนวัตกรรม', 'clauseCode', '1.1', 'clauseLabel', 'ผลสัมฤทธิ์ทางวิชาการของผู้เรียน'),
      JSON_OBJECT('code', '1.1.4', 'label', 'มีความสามารถในการใช้เทคโนโลยีสารสนเทศและการสื่อสาร', 'clauseCode', '1.1', 'clauseLabel', 'ผลสัมฤทธิ์ทางวิชาการของผู้เรียน'),
      JSON_OBJECT('code', '1.1.5', 'label', 'มีผลสัมฤทธิ์ทางการเรียนตามหลักสูตรสถานศึกษา', 'clauseCode', '1.1', 'clauseLabel', 'ผลสัมฤทธิ์ทางวิชาการของผู้เรียน'),
      JSON_OBJECT('code', '1.1.6', 'label', 'มีความรู้ ทักษะพื้นฐาน และเจตคติที่ดีต่องานอาชีพ', 'clauseCode', '1.1', 'clauseLabel', 'ผลสัมฤทธิ์ทางวิชาการของผู้เรียน'),
      JSON_OBJECT('code', '1.2.1', 'label', 'การมีคุณลักษณะและค่านิยมที่ดีตามที่สถานศึกษากำหนด', 'clauseCode', '1.2', 'clauseLabel', 'คุณลักษณะที่พึงประสงค์ของผู้เรียน'),
      JSON_OBJECT('code', '1.2.2', 'label', 'ความภูมิใจในท้องถิ่นและความเป็นไทย', 'clauseCode', '1.2', 'clauseLabel', 'คุณลักษณะที่พึงประสงค์ของผู้เรียน'),
      JSON_OBJECT('code', '1.2.3', 'label', 'การยอมรับที่จะอยู่ร่วมกันบนความแตกต่างและหลากหลาย', 'clauseCode', '1.2', 'clauseLabel', 'คุณลักษณะที่พึงประสงค์ของผู้เรียน'),
      JSON_OBJECT('code', '1.2.4', 'label', 'สุขภาวะทางร่างกาย และจิตสังคม', 'clauseCode', '1.2', 'clauseLabel', 'คุณลักษณะที่พึงประสงค์ของผู้เรียน')
    ),
    true,
    10,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
  ),
  (
    'STANDARD',
    'มาตรฐานที่ 2 กระบวนการบริหารและการจัดการ',
    JSON_ARRAY(
      JSON_OBJECT('code', '2.1', 'label', 'มีเป้าหมายวิสัยทัศน์และพันธกิจที่สถานศึกษากำหนดชัดเจน', 'clauseCode', '', 'clauseLabel', ''),
      JSON_OBJECT('code', '2.2', 'label', 'มีระบบบริหารจัดการคุณภาพของสถานศึกษา', 'clauseCode', '', 'clauseLabel', ''),
      JSON_OBJECT('code', '2.3', 'label', 'ดำเนินงานพัฒนาวิชาการที่เน้นคุณภาพผู้เรียนรอบด้านตามหลักสูตรสถานศึกษาและทุกกลุ่มเป้าหมาย', 'clauseCode', '', 'clauseLabel', ''),
      JSON_OBJECT('code', '2.4', 'label', 'พัฒนาครูและบุคลากรให้มีความเชี่ยวชาญทางวิชาชีพ', 'clauseCode', '', 'clauseLabel', ''),
      JSON_OBJECT('code', '2.5', 'label', 'จัดสภาพแวดล้อมทางกายภาพและสังคมที่เอื้อต่อการจัดการเรียนรู้อย่างมีคุณภาพ', 'clauseCode', '', 'clauseLabel', ''),
      JSON_OBJECT('code', '2.6', 'label', 'จัดระบบเทคโนโลยีสารสนเทศเพื่อสนับสนุนการบริหารจัดการและการจัดการเรียนรู้', 'clauseCode', '', 'clauseLabel', '')
    ),
    true,
    20,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
  ),
  (
    'STANDARD',
    'มาตรฐานที่ 3 กระบวนการจัดการเรียนการสอนที่เน้นผู้เรียนเป็นสำคัญ',
    JSON_ARRAY(
      JSON_OBJECT('code', '3.1', 'label', 'จัดการเรียนรู้ผ่านกระบวนการคิดและปฏิบัติจริง และสามารถนำไปประยุกต์ใช้ในชีวิตได้', 'clauseCode', '', 'clauseLabel', ''),
      JSON_OBJECT('code', '3.2', 'label', 'ใช้สื่อ เทคโนโลยีสารสนเทศ และแหล่งเรียนรู้ที่เอื้อต่อการเรียนรู้', 'clauseCode', '', 'clauseLabel', ''),
      JSON_OBJECT('code', '3.3', 'label', 'มีการบริหารจัดการชั้นเรียนเชิงบวก', 'clauseCode', '', 'clauseLabel', ''),
      JSON_OBJECT('code', '3.4', 'label', 'ตรวจสอบและประเมินผู้เรียนอย่างเป็นระบบ และนำผลมาพัฒนาผู้เรียน', 'clauseCode', '', 'clauseLabel', ''),
      JSON_OBJECT('code', '3.5', 'label', 'มีการแลกเปลี่ยนเรียนรู้และให้ข้อมูลสะท้อนกลับเพื่อพัฒนาและปรับปรุงการจัดการเรียนรู้', 'clauseCode', '', 'clauseLabel', '')
    ),
    true,
    30,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
  )
ON DUPLICATE KEY UPDATE
  `indicators` = VALUES(`indicators`),
  `is_active` = VALUES(`is_active`),
  `sort_order` = VALUES(`sort_order`),
  `updated_at` = CURRENT_TIMESTAMP(3);

DELETE FROM `document_reference_option`
WHERE `category` = 'STANDARD'
  AND `label` IN (
    '1',
    '2',
    '3',
    'มาตรฐานการศึกษาขั้นพื้นฐานฯ มาตรฐานที่ 1, 3 ข้อที่ 1.1, 3 ตัวชี้วัดที่ 1.1.2, 3.1'
  );
