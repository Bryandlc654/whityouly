ALTER TABLE "stories"
ADD COLUMN "contentWarning" TEXT,
ADD COLUMN "musicLabel" TEXT,
ADD COLUMN "externalShare" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "guestReadable" BOOLEAN NOT NULL DEFAULT true;