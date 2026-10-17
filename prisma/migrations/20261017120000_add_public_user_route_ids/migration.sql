ALTER TABLE `students` ADD COLUMN `public_id` CHAR(36) NULL;
ALTER TABLE `bus_layout_template` ADD COLUMN `public_id` CHAR(36) NULL;
ALTER TABLE `student_enrollment` ADD COLUMN `public_id` CHAR(36) NULL;

UPDATE `students` SET `public_id` = UUID() WHERE `public_id` IS NULL;
UPDATE `bus_layout_template` SET `public_id` = UUID() WHERE `public_id` IS NULL;
UPDATE `student_enrollment` SET `public_id` = UUID() WHERE `public_id` IS NULL;

ALTER TABLE `students` MODIFY `public_id` CHAR(36) NOT NULL;
ALTER TABLE `bus_layout_template` MODIFY `public_id` CHAR(36) NOT NULL;
ALTER TABLE `student_enrollment` MODIFY `public_id` CHAR(36) NOT NULL;

CREATE UNIQUE INDEX `students_public_id_key` ON `students`(`public_id`);
CREATE UNIQUE INDEX `bus_layout_template_public_id_key` ON `bus_layout_template`(`public_id`);
CREATE UNIQUE INDEX `student_enrollment_public_id_key` ON `student_enrollment`(`public_id`);
