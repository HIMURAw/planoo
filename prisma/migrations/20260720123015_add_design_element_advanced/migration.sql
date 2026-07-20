-- AlterTable: widen the DesignElementType enum (frame/image/path) and add
-- every new per-element field (nesting, appearance, stroke, effects, path
-- data, image data, auto layout).
ALTER TABLE `DesignElement`
  MODIFY COLUMN `type` ENUM('rectangle', 'ellipse', 'text', 'frame', 'image', 'path') NOT NULL,
  ADD COLUMN `parentId` VARCHAR(191) NULL,
  ADD COLUMN `rotation` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN `opacity` DOUBLE NOT NULL DEFAULT 1,
  ADD COLUMN `strokeColor` VARCHAR(191) NULL,
  ADD COLUMN `strokeWidth` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN `strokeStyle` ENUM('solid', 'dashed', 'dotted') NOT NULL DEFAULT 'solid',
  ADD COLUMN `effects` JSON NULL,
  ADD COLUMN `pathData` JSON NULL,
  ADD COLUMN `imageData` LONGTEXT NULL,
  ADD COLUMN `layoutMode` ENUM('none', 'horizontal', 'vertical') NOT NULL DEFAULT 'none',
  ADD COLUMN `layoutGap` DOUBLE NOT NULL DEFAULT 8,
  ADD COLUMN `paddingTop` DOUBLE NOT NULL DEFAULT 16,
  ADD COLUMN `paddingRight` DOUBLE NOT NULL DEFAULT 16,
  ADD COLUMN `paddingBottom` DOUBLE NOT NULL DEFAULT 16,
  ADD COLUMN `paddingLeft` DOUBLE NOT NULL DEFAULT 16,
  ADD COLUMN `layoutAlign` ENUM('start', 'center', 'end') NOT NULL DEFAULT 'start';

-- CreateIndex
CREATE INDEX `DesignElement_parentId_order_idx` ON `DesignElement`(`parentId`, `order`);

-- AddForeignKey (self-referential nesting; deleting a frame cascades to its children)
ALTER TABLE `DesignElement` ADD CONSTRAINT `DesignElement_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `DesignElement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
