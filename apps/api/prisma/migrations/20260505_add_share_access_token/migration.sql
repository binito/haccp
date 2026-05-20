ALTER TABLE `report_shares`
  ADD COLUMN `accessToken` VARCHAR(191) NULL,
  ADD COLUMN `expiresAt`   DATETIME(3)  NULL;

CREATE UNIQUE INDEX `report_shares_accessToken_key` ON `report_shares`(`accessToken`);
