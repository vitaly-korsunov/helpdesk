-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('BUG', 'FEATURE', 'QUESTION', 'OTHER');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "category" "TicketCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
