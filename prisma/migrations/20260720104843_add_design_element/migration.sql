-- CreateTable
CREATE TABLE `DesignElement` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `type` ENUM('rectangle', 'ellipse', 'text') NOT NULL,
    `posX` DOUBLE NOT NULL DEFAULT 0,
    `posY` DOUBLE NOT NULL DEFAULT 0,
    `width` DOUBLE NOT NULL DEFAULT 120,
    `height` DOUBLE NOT NULL DEFAULT 80,
    `fillColor` VARCHAR(191) NOT NULL DEFAULT '#8b5cf6',
    `text` TEXT NULL,
    `fontSize` INTEGER NULL,
    `borderRadius` INTEGER NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DesignElement_projectId_order_idx`(`projectId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DesignElement` ADD CONSTRAINT `DesignElement_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
