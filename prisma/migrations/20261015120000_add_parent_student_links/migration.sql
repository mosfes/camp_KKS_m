CREATE TABLE `parent_student_links` (
    `parents_id` INTEGER NOT NULL,
    `students_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `parent_student_links_students_id_idx`(`students_id`),
    PRIMARY KEY (`parents_id`, `students_id`),
    CONSTRAINT `parent_student_links_parents_id_fkey` FOREIGN KEY (`parents_id`) REFERENCES `parents`(`parents_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `parent_student_links_students_id_fkey` FOREIGN KEY (`students_id`) REFERENCES `students`(`students_id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
