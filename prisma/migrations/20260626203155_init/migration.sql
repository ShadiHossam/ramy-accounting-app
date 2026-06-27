-- CreateTable
CREATE TABLE `Transaction` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `account` VARCHAR(500) NOT NULL,
    `subAccount` VARCHAR(500) NOT NULL,
    `analytical` VARCHAR(500) NOT NULL,
    `costCenter` VARCHAR(500) NOT NULL,
    `description` VARCHAR(1000) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Transaction_date_idx`(`date`),
    INDEX `Transaction_account_idx`(`account`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
