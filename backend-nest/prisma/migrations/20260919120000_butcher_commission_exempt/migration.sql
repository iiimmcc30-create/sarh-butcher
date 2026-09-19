-- Local butcher commission exemption (independent of SARH plans).
ALTER TABLE "Butcher" ADD COLUMN IF NOT EXISTS "commissionExempt" BOOLEAN NOT NULL DEFAULT false;
