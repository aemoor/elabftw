-- revert schema 207
ALTER TABLE `experiments` DROP FOREIGN KEY `fk_experiments_folder_id`;
ALTER TABLE `experiments` DROP COLUMN `folder_id`;
DROP TABLE IF EXISTS `experiments_folders`;
UPDATE config SET conf_value = 206 WHERE conf_name = 'schema';
