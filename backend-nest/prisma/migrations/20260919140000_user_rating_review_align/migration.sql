-- Align copied Prisma User fields that were in schema.prisma but missing
-- from the extracted migration history. Additive only. Isolated butcher DB.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reviewCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "UserReview" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserReview_targetId_idx" ON "UserReview"("targetId");
CREATE INDEX IF NOT EXISTS "UserReview_reviewerId_idx" ON "UserReview"("reviewerId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserReview_targetId_reviewerId_key" ON "UserReview"("targetId", "reviewerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserReview_targetId_fkey'
  ) THEN
    ALTER TABLE "UserReview"
      ADD CONSTRAINT "UserReview_targetId_fkey"
      FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserReview_reviewerId_fkey'
  ) THEN
    ALTER TABLE "UserReview"
      ADD CONSTRAINT "UserReview_reviewerId_fkey"
      FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;
