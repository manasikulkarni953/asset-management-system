-- ===================================================
-- Migration: Fix Existing Blank/Null asset_id Records
-- Database: asset_management
-- ===================================================

USE `asset_management`;

-- Step 1: Update any blank or NULL asset_id based on the existing database id
-- E.g. id = 6 -> AST-000006
UPDATE `assets`
SET `asset_id` = CONCAT('AST-', LPAD(`id`, 6, '0'))
WHERE `asset_id` IS NULL OR TRIM(`asset_id`) = '';

-- Step 2: Verify all records have valid non-empty asset_id
-- and unique constraint uq_assets_asset_id is preserved
ALTER TABLE `assets` MODIFY COLUMN `asset_id` VARCHAR(50) NOT NULL;
