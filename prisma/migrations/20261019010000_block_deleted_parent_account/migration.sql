CREATE TABLE `parent_account_tombstones` (
    `students_id` INTEGER NOT NULL,
    `deleted_parent_id` INTEGER NOT NULL,
    `deleted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`students_id`),
    CONSTRAINT `parent_account_tombstones_students_id_fkey` FOREIGN KEY (`students_id`) REFERENCES `students`(`students_id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
