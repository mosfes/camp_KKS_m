-- Preserve one membership row per student/classroom before adding database guards.
DELETE duplicate_row
FROM `classroom_students` AS duplicate_row
INNER JOIN `classroom_students` AS keeper
  ON duplicate_row.`classroom_classroom_id` = keeper.`classroom_classroom_id`
  AND duplicate_row.`student_students_id` = keeper.`student_students_id`
  AND duplicate_row.`classroom_students_id` > keeper.`classroom_students_id`;

DELETE duplicate_row
FROM `classroom_teacher` AS duplicate_row
INNER JOIN `classroom_teacher` AS keeper
  ON duplicate_row.`classroom_classroom_id` = keeper.`classroom_classroom_id`
  AND duplicate_row.`teacher_teachers_id` = keeper.`teacher_teachers_id`
  AND duplicate_row.`classroom_teacher_id` > keeper.`classroom_teacher_id`;

CREATE UNIQUE INDEX `classroom_students_room_student_key`
  ON `classroom_students`(`classroom_classroom_id`, `student_students_id`);

CREATE UNIQUE INDEX `classroom_teacher_room_teacher_key`
  ON `classroom_teacher`(`classroom_classroom_id`, `teacher_teachers_id`);

ALTER TABLE `student_enrollment`
  ADD COLUMN `classroom_classroom_id` INTEGER NULL,
  ADD COLUMN `academic_year_snapshot` INTEGER NULL,
  ADD COLUMN `grade_snapshot` ENUM('1', '2', '3', '4', '5', '6') NULL,
  ADD COLUMN `classroom_name_snapshot` VARCHAR(255) NULL,
  ADD COLUMN `student_name_snapshot` VARCHAR(500) NULL;

-- Resolve the classroom that belonged both to the camp and the student.
UPDATE `student_enrollment` AS enrollment
SET enrollment.`classroom_classroom_id` = (
  SELECT MIN(membership.`classroom_classroom_id`)
  FROM `classroom_students` AS membership
  INNER JOIN `camp_classroom` AS camp_room
    ON camp_room.`classroom_classroom_id` = membership.`classroom_classroom_id`
    AND camp_room.`camp_camp_id` = enrollment.`camp_camp_id`
  WHERE membership.`student_students_id` = enrollment.`student_students_id`
);

UPDATE `student_enrollment` AS enrollment
INNER JOIN `students` AS student
  ON student.`students_id` = enrollment.`student_students_id`
LEFT JOIN `classrooms` AS classroom
  ON classroom.`classroom_id` = enrollment.`classroom_classroom_id`
LEFT JOIN `classroom_types` AS classroom_type
  ON classroom_type.`classroom_type_id` = classroom.`type_classroom`
SET enrollment.`student_name_snapshot` = TRIM(CONCAT(
      COALESCE(student.`prefix_name`, ''),
      student.`firstname`,
      ' ',
      student.`lastname`
    )),
    enrollment.`academic_year_snapshot` = classroom.`academic_years_years_id`,
    enrollment.`grade_snapshot` = classroom.`grade`,
    enrollment.`classroom_name_snapshot` = classroom_type.`name`;

CREATE INDEX `student_enrollment_classroom_classroom_id_idx`
  ON `student_enrollment`(`classroom_classroom_id`);

ALTER TABLE `student_enrollment`
  ADD CONSTRAINT `student_enrollment_classroom_classroom_id_fkey`
  FOREIGN KEY (`classroom_classroom_id`) REFERENCES `classrooms`(`classroom_id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `promotion_run` (
  `promotion_run_id` INTEGER NOT NULL AUTO_INCREMENT,
  `from_year` INTEGER NOT NULL,
  `to_year` INTEGER NOT NULL,
  `status` ENUM('COMPLETED') NOT NULL DEFAULT 'COMPLETED',
  `executed_by_id` INTEGER NOT NULL,
  `executed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `promotion_run_from_year_to_year_key`(`from_year`, `to_year`),
  INDEX `promotion_run_executed_by_id_idx`(`executed_by_id`),
  PRIMARY KEY (`promotion_run_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `promotion_item` (
  `promotion_item_id` INTEGER NOT NULL AUTO_INCREMENT,
  `promotion_run_id` INTEGER NOT NULL,
  `student_id` INTEGER NOT NULL,
  `source_classroom_id` INTEGER NOT NULL,
  `target_classroom_id` INTEGER NULL,
  `outcome` ENUM('PROMOTED', 'REPEAT', 'GRADUATED', 'TRANSFERRED', 'WITHDRAWN') NOT NULL,
  `note` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `promotion_item_promotion_run_id_student_id_key`(`promotion_run_id`, `student_id`),
  INDEX `promotion_item_student_id_idx`(`student_id`),
  INDEX `promotion_item_source_classroom_id_idx`(`source_classroom_id`),
  INDEX `promotion_item_target_classroom_id_idx`(`target_classroom_id`),
  PRIMARY KEY (`promotion_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_graduation` (
  `student_graduation_id` INTEGER NOT NULL AUTO_INCREMENT,
  `student_id` INTEGER NOT NULL,
  `academic_year` INTEGER NOT NULL,
  `classroom_id` INTEGER NULL,
  `graduated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `student_graduation_student_id_academic_year_key`(`student_id`, `academic_year`),
  INDEX `student_graduation_academic_year_idx`(`academic_year`),
  INDEX `student_graduation_classroom_id_idx`(`classroom_id`),
  PRIMARY KEY (`student_graduation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `promotion_run`
  ADD CONSTRAINT `promotion_run_from_year_fkey`
    FOREIGN KEY (`from_year`) REFERENCES `academic_years`(`year`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `promotion_run_to_year_fkey`
    FOREIGN KEY (`to_year`) REFERENCES `academic_years`(`year`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `promotion_run_executed_by_id_fkey`
    FOREIGN KEY (`executed_by_id`) REFERENCES `teachers`(`teachers_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `promotion_item`
  ADD CONSTRAINT `promotion_item_promotion_run_id_fkey`
    FOREIGN KEY (`promotion_run_id`) REFERENCES `promotion_run`(`promotion_run_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `promotion_item_student_id_fkey`
    FOREIGN KEY (`student_id`) REFERENCES `students`(`students_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `promotion_item_source_classroom_id_fkey`
    FOREIGN KEY (`source_classroom_id`) REFERENCES `classrooms`(`classroom_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `promotion_item_target_classroom_id_fkey`
    FOREIGN KEY (`target_classroom_id`) REFERENCES `classrooms`(`classroom_id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `student_graduation`
  ADD CONSTRAINT `student_graduation_student_id_fkey`
    FOREIGN KEY (`student_id`) REFERENCES `students`(`students_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `student_graduation_academic_year_fkey`
    FOREIGN KEY (`academic_year`) REFERENCES `academic_years`(`year`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `student_graduation_classroom_id_fkey`
    FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`classroom_id`) ON DELETE SET NULL ON UPDATE CASCADE;
