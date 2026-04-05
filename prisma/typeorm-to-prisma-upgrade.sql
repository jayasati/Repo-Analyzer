-- Apply this ONLY if `users` and `api_keys` already exist from TypeORM
-- and you are adopting Prisma without dropping data.
-- Then mark the init migration as rolled back or skipped and baseline Prisma.
--
-- ALTER "users" / create "repos" to match prisma/schema.prisma

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "githubId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "githubAccessToken" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "users_githubId_key" ON "users"("githubId");

CREATE TABLE IF NOT EXISTS "repos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "private" BOOLEAN NOT NULL,
    "githubRepoId" BIGINT,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "repos_ownerId_fullName_key" ON "repos"("ownerId", "fullName");

ALTER TABLE "repos" DROP CONSTRAINT IF EXISTS "repos_ownerId_fkey";
ALTER TABLE "repos" ADD CONSTRAINT "repos_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
