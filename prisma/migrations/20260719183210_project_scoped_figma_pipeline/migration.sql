-- Backfill: Project.figmaFileKey was introduced by the multi-project
-- restructuring, but the pre-restructuring UI only ever wrote to
-- User.figmaFileKey (single file per account). For any user with exactly
-- one project (true for every account today, since multi-project creation
-- only just shipped), copy their account-level file key onto that project
-- before the column disappears below — otherwise a user who had already
-- connected Figma loses that connection with no way to tell why.
UPDATE `Project` p
JOIN (SELECT `userId` FROM `Project` GROUP BY `userId` HAVING COUNT(*) = 1) single
  ON single.`userId` = p.`userId`
JOIN `User` u ON u.`id` = p.`userId`
SET p.`figmaFileKey` = u.`figmaFileKey`
WHERE p.`figmaFileKey` IS NULL AND u.`figmaFileKey` IS NOT NULL;

-- AlterTable: User.figmaFileKey is fully replaced by Project.figmaFileKey
-- now that every recheck-related read/write is project-scoped (see
-- src/app/api/recheck/route.ts) — drop it instead of leaving a dead column.
ALTER TABLE `User` DROP COLUMN `figmaFileKey`;

-- AlterTable
ALTER TABLE `SchemaSnapshot` ADD COLUMN `projectId` VARCHAR(191) NULL;

-- Backfill: same reasoning as Project.figmaFileKey above — DesignedTable and
-- Link rows created before the restructuring have projectId = NULL. For
-- single-project users, attach them to that one project so getDbColumns()
-- and the matcher don't suddenly stop seeing schema/links that were already
-- working. SchemaSnapshot rows are NOT backfilled the same way: they're
-- read fresh every recheck (never referenced by id from outside their own
-- retention window), so a one-time "isFirstRun re-reports true" on the next
-- post-migration recheck is harmless and self-resolves.
UPDATE `DesignedTable` dt
JOIN (SELECT `userId` FROM `Project` GROUP BY `userId` HAVING COUNT(*) = 1) single
  ON single.`userId` = dt.`userId`
JOIN `Project` p ON p.`userId` = dt.`userId`
SET dt.`projectId` = p.`id`
WHERE dt.`projectId` IS NULL;

UPDATE `Link` l
JOIN (SELECT `userId` FROM `Project` GROUP BY `userId` HAVING COUNT(*) = 1) single
  ON single.`userId` = l.`userId`
JOIN `Project` p ON p.`userId` = l.`userId`
SET l.`projectId` = p.`id`
WHERE l.`projectId` IS NULL;

-- CreateIndex
CREATE INDEX `Link_projectId_idx` ON `Link`(`projectId`);

-- CreateIndex
CREATE INDEX `DesignedTable_projectId_idx` ON `DesignedTable`(`projectId`);

-- CreateIndex — created *before* dropping the old index below: the old
-- index's leading column (userId) is also relied on by the
-- SchemaSnapshot_userId_fkey constraint, so MySQL refuses to drop it until a
-- replacement index covering userId already exists (see the roadmap-columns
-- migration for the same gotcha hit earlier).
CREATE INDEX `SchemaSnapshot_userId_projectId_source_createdAt_idx` ON `SchemaSnapshot`(`userId`, `projectId`, `source`, `createdAt`);

-- DropIndex
DROP INDEX `SchemaSnapshot_userId_source_createdAt_idx` ON `SchemaSnapshot`;

-- AddForeignKey
ALTER TABLE `SchemaSnapshot` ADD CONSTRAINT `SchemaSnapshot_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
