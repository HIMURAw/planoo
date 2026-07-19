-- CreateTable
CREATE TABLE `CostEstimateInput` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `presetId` VARCHAR(191) NOT NULL,
    `monthlyActiveUsers` INTEGER NOT NULL DEFAULT 0,
    `avgRequestsPerUser` INTEGER NOT NULL DEFAULT 50,
    `assumedRowsPerTable` INTEGER NOT NULL DEFAULT 10000,
    `manualFileStorageGb` DOUBLE NOT NULL DEFAULT 0,
    `egressGbPerMonth` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CostEstimateInput_projectId_key`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CostEstimateInput` ADD CONSTRAINT `CostEstimateInput_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
