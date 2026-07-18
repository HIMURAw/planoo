-- CreateTable
CREATE TABLE `DesignedTable` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DesignedTable_userId_name_key`(`userId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DesignedColumn` (
    `id` VARCHAR(191) NOT NULL,
    `tableId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `dataType` VARCHAR(191) NOT NULL,
    `nullable` BOOLEAN NOT NULL DEFAULT true,
    `isPrimaryKey` BOOLEAN NOT NULL DEFAULT false,
    `isForeignKey` BOOLEAN NOT NULL DEFAULT false,
    `referencesTable` VARCHAR(191) NULL,
    `referencesColumn` VARCHAR(191) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `DesignedColumn_tableId_name_key`(`tableId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DesignedTable` ADD CONSTRAINT `DesignedTable_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DesignedColumn` ADD CONSTRAINT `DesignedColumn_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `DesignedTable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
