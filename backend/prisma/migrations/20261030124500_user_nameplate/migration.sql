ALTER TABLE `users`
  ADD COLUMN `membership` VARCHAR(16) NOT NULL DEFAULT 'member',
  ADD COLUMN `name_frame` VARCHAR(24) NOT NULL DEFAULT 'none',
  ADD COLUMN `name_emblem` VARCHAR(24) NOT NULL DEFAULT 'none',
  ADD COLUMN `name_unlocks` JSON NULL;
