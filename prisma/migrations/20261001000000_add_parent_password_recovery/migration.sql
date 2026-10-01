ALTER TABLE `parents`
    ADD COLUMN `email` VARCHAR(255) NULL,
    ADD COLUMN `email_verified_at` DATETIME(3) NULL,
    ADD COLUMN `session_version` INTEGER NOT NULL DEFAULT 0;

CREATE INDEX `parents_email_idx` ON `parents`(`email`);

CREATE TABLE `parent_auth_tokens` (
    `token_id` INTEGER NOT NULL AUTO_INCREMENT,
    `parents_id` INTEGER NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `type` ENUM('PASSWORD_RESET', 'EMAIL_VERIFICATION') NOT NULL,
    `email` VARCHAR(255) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`token_id`),
    UNIQUE INDEX `parent_auth_tokens_token_hash_key`(`token_hash`),
    INDEX `parent_auth_tokens_parents_id_type_used_at_expires_at_idx`(`parents_id`, `type`, `used_at`, `expires_at`),
    CONSTRAINT `parent_auth_tokens_parents_id_fkey` FOREIGN KEY (`parents_id`) REFERENCES `parents`(`parents_id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
