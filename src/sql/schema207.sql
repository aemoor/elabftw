-- Schema 207
-- Add hierarchical folders for experiments
CREATE TABLE `experiments_folders` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `team` INT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `parent_id` INT UNSIGNED NULL DEFAULT NULL,
  `userid` INT UNSIGNED NOT NULL,
  `ordering` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`parent_id`) REFERENCES `experiments_folders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`team`) REFERENCES `teams`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`userid`) REFERENCES `users`(`userid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add folder_id column to experiments table
ALTER TABLE `experiments`
  ADD COLUMN `folder_id` INT UNSIGNED NULL DEFAULT NULL,
  ADD CONSTRAINT `fk_experiments_folder_id` FOREIGN KEY (`folder_id`) REFERENCES `experiments_folders`(`id`) ON DELETE SET NULL;

UPDATE config SET conf_value = 207 WHERE conf_name = 'schema';
