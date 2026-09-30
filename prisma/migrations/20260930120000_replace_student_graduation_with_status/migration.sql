ALTER TABLE `students`
  ADD COLUMN `status` ENUM('ACTIVE', 'GRADUATED', 'TRANSFERRED', 'WITHDRAWN') NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX `students_status_idx` ON `students`(`status`);

-- Derive the current lifecycle status from each student's latest promotion result.
UPDATE `students` AS student
INNER JOIN (
  SELECT item.`student_id`, item.`outcome`
  FROM `promotion_item` AS item
  INNER JOIN (
    SELECT `student_id`, MAX(`promotion_item_id`) AS `latest_item_id`
    FROM `promotion_item`
    GROUP BY `student_id`
  ) AS latest
    ON latest.`latest_item_id` = item.`promotion_item_id`
) AS current_result
  ON current_result.`student_id` = student.`students_id`
SET student.`status` = CASE current_result.`outcome`
  WHEN 'GRADUATED' THEN 'GRADUATED'
  WHEN 'TRANSFERRED' THEN 'TRANSFERRED'
  WHEN 'WITHDRAWN' THEN 'WITHDRAWN'
  ELSE 'ACTIVE'
END;

-- Preserve the current graduated status from the legacy graduation table.
UPDATE `students` AS student
INNER JOIN `student_graduation` AS graduation
  ON graduation.`student_id` = student.`students_id`
SET student.`status` = 'GRADUATED';

DROP TABLE `student_graduation`;
