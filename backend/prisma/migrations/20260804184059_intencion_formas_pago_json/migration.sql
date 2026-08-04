/*
  Warnings:

  - You are about to drop the column `forma_pago_preferida` on the `intenciones_compra` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `intenciones_compra` DROP COLUMN `forma_pago_preferida`,
    ADD COLUMN `formas_pago_preferidas` JSON NULL;
