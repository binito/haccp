-- Adicionar zona e clientId a anomaly_reports

ALTER TABLE `anomaly_reports` ADD COLUMN `zona` ENUM('COZINHA','PRODUCAO','ARMAZEM','SERVICO') NULL;
ALTER TABLE `anomaly_reports` ADD COLUMN `client_id` VARCHAR(191) NULL;

-- Popular client_id a partir da área existente
UPDATE `anomaly_reports` ar
JOIN `areas` a ON ar.`areaId` = a.`id`
SET ar.`client_id` = a.`clientId`;

-- Tornar client_id NOT NULL (após populate)
ALTER TABLE `anomaly_reports` MODIFY `client_id` VARCHAR(191) NOT NULL;

-- Tornar areaId nullable
ALTER TABLE `anomaly_reports` MODIFY `areaId` VARCHAR(191) NULL;

-- Índice por clientId
CREATE INDEX `anomaly_reports_client_id_created_at_idx` ON `anomaly_reports`(`client_id`, `createdAt`);

-- Foreign key para clients
ALTER TABLE `anomaly_reports` ADD CONSTRAINT `anomaly_reports_client_id_fkey`
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
