-- Drop tables the application never reads or writes.
-- Teacher GPS tracking was never implemented (student_location_update is used instead),
-- and survey AI summaries are stored in survey.ai_summary.
-- No other table references these, and DROP TABLE removes their own foreign keys,
-- so this avoids depending on historical constraint names.
DROP TABLE IF EXISTS `camp_location_update`;

DROP TABLE IF EXISTS `suggestion_analysis_summary`;
