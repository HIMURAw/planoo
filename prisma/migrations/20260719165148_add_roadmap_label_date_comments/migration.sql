-- AlterTable
ALTER TABLE `roadmapitem` ADD COLUMN `dueDate` DATETIME(3) NULL,
    ADD COLUMN `label` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `RoadmapComment` (
    `id` VARCHAR(191) NOT NULL,
    `roadmapItemId` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RoadmapComment_roadmapItemId_createdAt_idx`(`roadmapItemId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RoadmapComment` ADD CONSTRAINT `RoadmapComment_roadmapItemId_fkey` FOREIGN KEY (`roadmapItemId`) REFERENCES `RoadmapItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
