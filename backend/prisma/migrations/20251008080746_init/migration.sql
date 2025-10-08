-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tokenChanges" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_signature_key" ON "Transaction"("signature");
