-- CreateTable
CREATE TABLE `RoadmapColumn` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RoadmapColumn_projectId_order_idx`(`projectId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RoadmapColumn` ADD CONSTRAINT `RoadmapColumn_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: nullable for now — backfilled below, then tightened to NOT NULL
-- once every existing row has a value.
ALTER TABLE `RoadmapItem` ADD COLUMN `columnId` VARCHAR(191) NULL;

-- Data migration: board columns used to be a fixed 3-value `status` enum.
-- Turn that into real, renamable/reorderable RoadmapColumn rows instead of
-- just dropping the distinction — one column per (project, status) pair
-- that actually has at least one item, preserving the existing Turkish
-- labels used in the UI up to this point.
INSERT INTO `RoadmapColumn` (`id`, `projectId`, `name`, `order`, `createdAt`, `updatedAt`)
SELECT UUID(), `projectId`, 'Yapılacaklar', 0, NOW(3), NOW(3)
FROM `RoadmapItem` WHERE `status` = 'todo' GROUP BY `projectId`;

INSERT INTO `RoadmapColumn` (`id`, `projectId`, `name`, `order`, `createdAt`, `updatedAt`)
SELECT UUID(), `projectId`, 'Devam Ediyor', 1, NOW(3), NOW(3)
FROM `RoadmapItem` WHERE `status` = 'in_progress' GROUP BY `projectId`;

INSERT INTO `RoadmapColumn` (`id`, `projectId`, `name`, `order`, `createdAt`, `updatedAt`)
SELECT UUID(), `projectId`, 'Tamamlandı', 2, NOW(3), NOW(3)
FROM `RoadmapItem` WHERE `status` = 'done' GROUP BY `projectId`;

-- Point each existing item at the column matching its old (project, status).
UPDATE `RoadmapItem` ri
JOIN `RoadmapColumn` rc ON rc.`projectId` = ri.`projectId`
  AND rc.`name` = CASE ri.`status`
    WHEN 'todo' THEN 'Yapılacaklar'
    WHEN 'in_progress' THEN 'Devam Ediyor'
    WHEN 'done' THEN 'Tamamlandı'
  END
SET ri.`columnId` = rc.`id`;

-- Every row now has a columnId (there are no other status values), so this
-- is safe.
ALTER TABLE `RoadmapItem` MODIFY COLUMN `columnId` VARCHAR(191) NOT NULL;

-- CreateIndex — created *before* dropping the old status index below: the
-- old index's leading column (projectId) is also relied on by the
-- RoadmapItem_projectId_fkey constraint, so MySQL refuses to drop it until
-- a replacement index covering projectId already exists.
CREATE INDEX `RoadmapItem_projectId_columnId_idx` ON `RoadmapItem`(`projectId`, `columnId`);

-- DropIndex
DROP INDEX `RoadmapItem_projectId_status_idx` ON `RoadmapItem`;

-- AlterTable
ALTER TABLE `RoadmapItem` DROP COLUMN `status`;

-- AddForeignKey
ALTER TABLE `RoadmapItem` ADD CONSTRAINT `RoadmapItem_columnId_fkey` FOREIGN KEY (`columnId`) REFERENCES `RoadmapColumn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
