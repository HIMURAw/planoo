-- AlterTable
ALTER TABLE `user` ADD COLUMN `plan` ENUM('free', 'solo', 'team') NOT NULL DEFAULT 'free';

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `plan` ENUM('free', 'solo', 'team') NOT NULL,
    `status` ENUM('on_trial', 'active', 'paused', 'past_due', 'unpaid', 'cancelled', 'expired') NOT NULL,
    `lemonSqueezySubscriptionId` VARCHAR(191) NOT NULL,
    `lemonSqueezyCustomerId` VARCHAR(191) NOT NULL,
    `lemonSqueezyVariantId` VARCHAR(191) NOT NULL,
    `renewsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subscription_userId_key`(`userId`),
    UNIQUE INDEX `Subscription_lemonSqueezySubscriptionId_key`(`lemonSqueezySubscriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
