-- AlterTable
ALTER TABLE `DesignElement`
  ADD COLUMN `hidden` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `locked` BOOLEAN NOT NULL DEFAULT false;
