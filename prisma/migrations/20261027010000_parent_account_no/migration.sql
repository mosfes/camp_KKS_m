-- AddColumn
ALTER TABLE `parents` ADD COLUMN `account_no` INTEGER NOT NULL DEFAULT 1;

-- Number any existing extra accounts of the same student 2, 3, ... so the
-- unique index below can be created.
UPDATE `parents` AS `p`
JOIN (
    SELECT `parents_id`,
           ROW_NUMBER() OVER (PARTITION BY `username_student_id` ORDER BY `parents_id`) AS `rn`
    FROM `parents`
) AS `ranked` ON `ranked`.`parents_id` = `p`.`parents_id`
SET `p`.`account_no` = `ranked`.`rn`
WHERE `ranked`.`rn` > 1;

-- CreateIndex
CREATE UNIQUE INDEX `parents_username_student_id_account_no_key` ON `parents`(`username_student_id`, `account_no`);
