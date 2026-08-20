-- DropTable
DROP TABLE `BalanceSheetLine`;

-- DropTable
DROP TABLE `MonthlyMetric`;

-- CreateTable
CREATE TABLE `Account` (
    `code` INTEGER NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `parentCode` INTEGER NULL,
    `level` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalLine` (
    `id` VARCHAR(191) NOT NULL,
    `entryNumber` INTEGER NOT NULL,
    `entryDate` DATETIME(3) NOT NULL,
    `postingDate` DATETIME(3) NOT NULL,
    `refNumber` VARCHAR(100) NOT NULL,
    `docType` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `accountCode` INTEGER NOT NULL,
    `accountName` VARCHAR(200) NOT NULL,
    `accountType` VARCHAR(20) NOT NULL,
    `costCenter` VARCHAR(200) NOT NULL,
    `debit` DOUBLE NOT NULL,
    `credit` DOUBLE NOT NULL,
    `approvalStatus` VARCHAR(50) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JournalLine_entryDate_idx`(`entryDate`),
    INDEX `JournalLine_accountCode_idx`(`accountCode`),
    INDEX `JournalLine_costCenter_idx`(`costCenter`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
