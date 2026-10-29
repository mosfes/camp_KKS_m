-- Force parents to choose their own password after an admin reset.
ALTER TABLE `parents` ADD COLUMN `must_change_password` BOOLEAN NOT NULL DEFAULT false;
