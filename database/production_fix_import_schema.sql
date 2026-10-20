-- ==============================================================================
-- Production Fix for Hostinger MySQL Database (u449458970_itasset2026)
-- Run this in phpMyAdmin or Hostinger MySQL Query Tool if tables/columns are missing
-- ==============================================================================

-- 1. Create the asset_imports table if it does not already exist
CREATE TABLE IF NOT EXISTS `asset_imports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `filename` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `file_size` INT NOT NULL DEFAULT 0,
  `file_content` MEDIUMTEXT NULL,
  `total_records` INT NOT NULL DEFAULT 0,
  `success_count` INT NOT NULL DEFAULT 0,
  `failed_count` INT NOT NULL DEFAULT 0,
  `status` ENUM('completed', 'failed', 'partial') DEFAULT 'completed',
  `imported_by_user_id` INT NULL,
  `imported_by_name` VARCHAR(100) NULL,
  `error_log` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_imports_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add import_id column to assets table if not present
SET @dbname = DATABASE();
SET @tablename = "assets";
SET @columnname = "import_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE assets ADD COLUMN import_id INT NULL AFTER current_employee_id, ADD INDEX idx_assets_import_id (import_id);"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
