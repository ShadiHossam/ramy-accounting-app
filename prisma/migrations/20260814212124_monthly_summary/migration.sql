-- DropTable
DROP TABLE `Transaction`;

-- CreateTable
CREATE TABLE `MonthlyMetric` (
    `id` VARCHAR(191) NOT NULL,
    `sheet` VARCHAR(50) NOT NULL,
    `category` VARCHAR(200) NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MonthlyMetric_year_month_idx`(`year`, `month`),
    UNIQUE INDEX `MonthlyMetric_sheet_category_year_month_key`(`sheet`, `category`, `year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BalanceSheetLine` (
    `id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(300) NOT NULL,
    `code` VARCHAR(50) NULL,
    `section` VARCHAR(20) NOT NULL,
    `isTotal` BOOLEAN NOT NULL DEFAULT false,
    `amount` DOUBLE NOT NULL,
    `asOfDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BalanceSheetLine_asOfDate_idx`(`asOfDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

