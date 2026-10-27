-- Admin-editable send time, schedule, and copy for camp reminder emails.
CREATE TABLE `camp_email_reminder_setting` (
    `setting_id` INTEGER NOT NULL DEFAULT 1,
    `send_hour` INTEGER NOT NULL DEFAULT 7,
    `reminders` JSON NOT NULL,
    `updated_by_teacher_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`setting_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
