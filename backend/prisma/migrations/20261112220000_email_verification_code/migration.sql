-- Código de verificación de correo por número (además del enlace).
ALTER TABLE "users"
ADD COLUMN "emailVerificationCodeHash" TEXT,
ADD COLUMN "emailVerificationCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0;
