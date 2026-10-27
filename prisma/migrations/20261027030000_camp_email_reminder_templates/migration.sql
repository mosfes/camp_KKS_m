-- Admin-created templates for camp reminder emails.
CREATE TABLE `camp_email_reminder_template` (
    `template_id` INTEGER NOT NULL AUTO_INCREMENT,
    `content` JSON NOT NULL,
    `created_by_teacher_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`template_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
