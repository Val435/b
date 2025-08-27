-- Drop unique index on (userId, index)
DROP INDEX IF EXISTS "Journey_userId_index_key";

-- Remove index column from Journey model
ALTER TABLE "Journey" DROP COLUMN IF EXISTS "index";

