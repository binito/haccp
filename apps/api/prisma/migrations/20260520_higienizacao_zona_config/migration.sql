CREATE TABLE `higienizacao_zona_config` (
  `id` VARCHAR(191) NOT NULL,
  `zona` ENUM('COZINHA','PRODUCAO','ARMAZEM','SERVICO') NOT NULL,
  `itens` JSON NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `higienizacao_zona_config_clientId_zona_key` (`clientId`, `zona`),
  CONSTRAINT `higienizacao_zona_config_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
