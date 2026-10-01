CREATE TABLE `student_push_subscription` (
    `subscription_id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_students_id` INTEGER NOT NULL,
    `endpoint_hash` CHAR(64) NOT NULL,
    `endpoint` TEXT NOT NULL,
    `p256dh` VARCHAR(255) NOT NULL,
    `auth` VARCHAR(255) NOT NULL,
    `user_agent` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `student_push_subscription_endpoint_hash_key`(`endpoint_hash`),
    INDEX `student_push_subscription_student_students_id_idx`(`student_students_id`),
    PRIMARY KEY (`subscription_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `student_push_subscription`
    ADD CONSTRAINT `student_push_subscription_student_students_id_fkey`
    FOREIGN KEY (`student_students_id`) REFERENCES `students`(`students_id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
