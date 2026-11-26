USE dts_recruitment;

SET @skills_requested_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'customer_requirement_intakes'
    AND column_name = 'skills_requested'
);

SET @skills_requested_migration = IF(
  @skills_requested_exists = 0,
  'ALTER TABLE customer_requirement_intakes ADD COLUMN skills_requested JSON NULL AFTER job_title',
  'SELECT 1'
);

PREPARE skills_requested_statement FROM @skills_requested_migration;
EXECUTE skills_requested_statement;
DEALLOCATE PREPARE skills_requested_statement;
