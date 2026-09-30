ALTER TABLE `camp_project_document`
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `finalized_at` DATETIME(3) NULL;

CREATE INDEX `camp_project_document_status_idx`
  ON `camp_project_document`(`status`);
