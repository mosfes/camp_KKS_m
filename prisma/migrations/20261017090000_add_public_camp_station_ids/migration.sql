ALTER TABLE `camp` ADD COLUMN `public_id` CHAR(36) NULL;
ALTER TABLE `station` ADD COLUMN `public_id` CHAR(36) NULL;

UPDATE `camp` SET `public_id` = UUID() WHERE `public_id` IS NULL;
UPDATE `station` SET `public_id` = UUID() WHERE `public_id` IS NULL;

ALTER TABLE `camp` MODIFY `public_id` CHAR(36) NOT NULL;
ALTER TABLE `station` MODIFY `public_id` CHAR(36) NOT NULL;

CREATE UNIQUE INDEX `camp_public_id_key` ON `camp`(`public_id`);
CREATE UNIQUE INDEX `station_public_id_key` ON `station`(`public_id`);
