-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "from" TEXT,
ADD COLUMN     "to" TEXT,
ADD COLUMN     "value" DOUBLE PRECISION;
