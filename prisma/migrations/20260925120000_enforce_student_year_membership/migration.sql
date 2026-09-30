-- Store the academic year on each membership so the database can guarantee
-- that a student belongs to at most one classroom in a given year.
ALTER TABLE `classroom_students`
  ADD COLUMN `academic_year` INTEGER NULL;

UPDATE `classroom_students` AS membership
INNER JOIN `classrooms` AS classroom
  ON classroom.`classroom_id` = membership.`classroom_classroom_id`
SET membership.`academic_year` = classroom.`academic_years_years_id`;

ALTER TABLE `classroom_students`
  MODIFY `academic_year` INTEGER NOT NULL;

CREATE UNIQUE INDEX `classroom_students_student_year_key`
  ON `classroom_students`(`student_students_id`, `academic_year`);

CREATE INDEX `classroom_students_academic_year_idx`
  ON `classroom_students`(`academic_year`);

ALTER TABLE `classroom_students`
  ADD CONSTRAINT `classroom_students_academic_year_fkey`
  FOREIGN KEY (`academic_year`) REFERENCES `academic_years`(`year`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
