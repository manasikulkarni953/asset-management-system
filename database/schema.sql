-- ===================================================
-- Asset Management System - MySQL Database Schema
-- Production Ready Direct MySQL Schema
-- ===================================================

CREATE DATABASE IF NOT EXISTS `asset_management` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `asset_management`;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `role` ENUM('super_admin', 'admin', 'it_admin', 'employee') NOT NULL DEFAULT 'employee',
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS `employees` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `department` VARCHAR(100) NOT NULL,
  `designation` VARCHAR(100) NOT NULL,
  `location` VARCHAR(100) NOT NULL DEFAULT 'The Space',
  `workstation` VARCHAR(50) NULL,
  `status` ENUM('active', 'on_leave', 'terminated') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_employees_department` (`department`),
  INDEX `idx_employees_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. ASSETS TABLE
CREATE TABLE IF NOT EXISTS `assets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `asset_id` VARCHAR(50) NOT NULL UNIQUE,
  `asset_number` VARCHAR(50) NOT NULL UNIQUE,
  `category` VARCHAR(50) NOT NULL,
  `brand` VARCHAR(100) NOT NULL,
  `model` VARCHAR(100) NOT NULL,
  `serial_number` VARCHAR(100) NOT NULL UNIQUE,
  `purchase_date` DATE NOT NULL,
  `purchase_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `vendor` VARCHAR(100) NOT NULL,
  `vendor_phone` VARCHAR(50) NULL,
  `vendor_email` VARCHAR(100) NULL,
  `location` VARCHAR(150) NULL DEFAULT 'The Space',
  `warranty_expiry` DATE NULL,
  `status` ENUM('in_stock', 'assigned', 'under_maintenance', 'retired') NOT NULL DEFAULT 'in_stock',
  `current_employee_id` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `uq_assets_asset_id` UNIQUE (`asset_id`),
  CONSTRAINT `fk_assets_employee` FOREIGN KEY (`current_employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  INDEX `idx_assets_category` (`category`),
  INDEX `idx_assets_status` (`status`),
  INDEX `idx_assets_brand` (`brand`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. ASSET ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS `asset_assignments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `asset_id` INT NOT NULL,
  `employee_id` INT NOT NULL,
  `assigned_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `returned_date` TIMESTAMP NULL DEFAULT NULL,
  `status` ENUM('assigned', 'transferred', 'returned') NOT NULL DEFAULT 'assigned',
  `notes` TEXT NULL,
  `assigned_by_user_id` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_assignments_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assignments_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_assignments_user` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_assignments_asset_employee` (`asset_id`, `employee_id`),
  INDEX `idx_assignments_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. ASSET HISTORY TABLE
CREATE TABLE IF NOT EXISTS `asset_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `asset_id` INT NOT NULL,
  `event_type` ENUM('created', 'assigned', 'transferred', 'returned', 'maintenance', 'ticket_raised', 'ticket_resolved', 'status_changed', 'retired') NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `performed_by_user_id` INT NULL,
  `metadata` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_history_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_history_user` FOREIGN KEY (`performed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_history_asset_event` (`asset_id`, `event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. ASSET INSURANCE TABLE
CREATE TABLE IF NOT EXISTS `asset_insurance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `asset_id` INT NOT NULL UNIQUE,
  `provider` VARCHAR(100) NOT NULL,
  `policy_number` VARCHAR(100) NOT NULL UNIQUE,
  `start_date` DATE NOT NULL,
  `expiry_date` DATE NOT NULL,
  `coverage_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `document_url` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `status` ENUM('active', 'expiring', 'expired') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_insurance_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  INDEX `idx_insurance_status` (`status`),
  INDEX `idx_insurance_expiry` (`expiry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. ASSET NETWORK TABLE
CREATE TABLE IF NOT EXISTS `asset_network` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `asset_id` INT NOT NULL UNIQUE,
  `ip_address` VARCHAR(45) NULL,
  `assignment_type` VARCHAR(20) NOT NULL DEFAULT 'Static',
  `subnet_mask` VARCHAR(45) NULL DEFAULT '255.255.255.0',
  `gateway` VARCHAR(45) NULL,
  `dns_server` VARCHAR(100) NULL,
  `mac_address` VARCHAR(20) NULL,
  `hostname` VARCHAR(100) NULL,
  `network_name` VARCHAR(100) NULL,
  `vlan` VARCHAR(50) NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_network_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  INDEX `idx_network_ip` (`ip_address`),
  INDEX `idx_network_mac` (`mac_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. TICKETS TABLE
CREATE TABLE IF NOT EXISTS `tickets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_id` VARCHAR(50) NOT NULL UNIQUE,
  `asset_id` INT NOT NULL,
  `employee_id` INT NOT NULL,
  `issue_category` VARCHAR(100) NOT NULL,
  `issue_description` TEXT NOT NULL,
  `priority` ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  `status` ENUM('new', 'assigned', 'in_progress', 'waiting_for_user', 'resolved', 'closed') NOT NULL DEFAULT 'new',
  `assigned_to_user_id` INT NULL,
  `attachment_url` VARCHAR(255) NULL,
  `resolution` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` TIMESTAMP NULL DEFAULT NULL,
  `closed_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tickets_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tickets_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_tickets_assigned_user` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_tickets_status` (`status`),
  INDEX `idx_tickets_priority` (`priority`),
  INDEX `idx_tickets_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. TICKET HISTORY TABLE
CREATE TABLE IF NOT EXISTS `ticket_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_id` INT NOT NULL,
  `old_status` VARCHAR(50) NULL,
  `new_status` VARCHAR(50) NOT NULL,
  `comment` TEXT NULL,
  `changed_by_user_id` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ticket_history_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ticket_history_user` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_ticket_history_ticket` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================
-- SEED DATA (Default Admin, Sample Employees & Categories)
-- Default Password for admin is 'Admin@123' (bcrypt hashed)
-- ===================================================

INSERT INTO `users` (`username`, `email`, `password_hash`, `full_name`, `role`, `status`)
VALUES 
('admin', 'admin@enterprise.com', '$2b$10$Nq6nkBJUu3zj6atMz0KBiOvZgfnShkhRXyPReEpzd7KfdulrdlZ3y', 'System Administrator', 'super_admin', 'active'),
('itadmin', 'itadmin@enterprise.com', '$2b$10$Nq6nkBJUu3zj6atMz0KBiOvZgfnShkhRXyPReEpzd7KfdulrdlZ3y', 'IT Support Lead', 'it_admin', 'active')
ON DUPLICATE KEY UPDATE `username`=`username`;

INSERT INTO `employees` (`employee_id`, `name`, `email`, `department`, `designation`, `location`, `workstation`, `status`)
VALUES
('TGS-001', 'Alex Johnson', 'alex.j@enterprise.com', 'Engineering', 'Senior Software Engineer', 'The Space', 'WS-05-001', 'active'),
('TGS-002', 'Jhone Doe', 'jhone.doe@enterprise.com', 'Design', 'UI/UX Designer', 'The Space', 'WS-05-002', 'active'),
('TGS-003', 'Michael Scott', 'michael.s@enterprise.com', 'Product Management', 'Product Director', 'The Space', 'WS-05-003', 'active'),
('TGS-004', 'Nakshatra Sulakhe', 'nakshatra.s@enterprise.com', 'DevOps & Cloud', 'DevOps Specialist', 'The Space', 'WS-05-004', 'active'),
('TGS-005', 'Rutika Rathod', 'rutika.r@enterprise.com', 'Engineering', 'Full Stack Developer', 'The Space', 'WS-05-005', 'active'),
('TGS-006', 'Sarah Connor', 'sarah.c@enterprise.com', 'DevOps & Cloud', 'Lead Infrastructure Engineer', 'The Space', 'WS-05-006', 'active')
ON DUPLICATE KEY UPDATE `location`='The Space';
