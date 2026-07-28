-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'GARAGE_MANAGER';
ALTER TYPE "Role" ADD VALUE 'WORKSHOP_SUPERVISOR';
ALTER TYPE "Role" ADD VALUE 'RECEPTION';
ALTER TYPE "Role" ADD VALUE 'TECHNICIAN';
ALTER TYPE "Role" ADD VALUE 'DIAGNOSTIC_TECHNICIAN';
ALTER TYPE "Role" ADD VALUE 'QUALITY_INSPECTOR';
ALTER TYPE "Role" ADD VALUE 'SERVICE_ADVISOR';
