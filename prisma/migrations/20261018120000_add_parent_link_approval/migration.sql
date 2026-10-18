CREATE TABLE `parent_student_link_requests` (
    `request_id` INTEGER NOT NULL AUTO_INCREMENT,
    `parents_id` INTEGER NOT NULL,
    `students_id` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `responded_at` DATETIME(3) NULL,

    UNIQUE INDEX `parent_student_link_requests_parents_id_students_id_key`(`parents_id`, `students_id`),
    INDEX `parent_student_link_requests_status_expires_at_idx`(`status`, `expires_at`),
    INDEX `parent_student_link_requests_students_id_status_expires_at_idx`(`students_id`, `status`, `expires_at`),
    INDEX `parent_student_link_requests_parents_id_status_idx`(`parents_id`, `status`),
    PRIMARY KEY (`request_id`),
    CONSTRAINT `parent_student_link_requests_parents_id_fkey` FOREIGN KEY (`parents_id`) REFERENCES `parents`(`parents_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `parent_student_link_requests_students_id_fkey` FOREIGN KEY (`students_id`) REFERENCES `students`(`students_id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `parent_student_link_events` (
    `event_id` INTEGER NOT NULL AUTO_INCREMENT,
    `parents_id` INTEGER NOT NULL,
    `students_id` INTEGER NOT NULL,
    `action` VARCHAR(30) NOT NULL,
    `actor_type` VARCHAR(20) NOT NULL,
    `actor_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `parent_student_link_events_parents_id_created_at_idx`(`parents_id`, `created_at`),
    INDEX `parent_student_link_events_students_id_created_at_idx`(`students_id`, `created_at`),
    PRIMARY KEY (`event_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
