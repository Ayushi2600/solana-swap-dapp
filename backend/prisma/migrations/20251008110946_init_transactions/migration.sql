-- DropIndex
DROP INDEX "public"."Transaction_signature_key";

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "fee" DOUBLE PRECISION,
ADD COLUMN     "inputMint" TEXT,
ADD COLUMN     "isRealTransaction" BOOLEAN,
ADD COLUMN     "outputMint" TEXT,
ADD COLUMN     "priceImpact" TEXT;
