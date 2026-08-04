-- AlterTable
ALTER TABLE `stock_movimientos` ADD COLUMN `numero_remito` VARCHAR(191) NULL,
    ADD COLUMN `productor_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `stock_movimientos` ADD CONSTRAINT `stock_movimientos_productor_id_fkey` FOREIGN KEY (`productor_id`) REFERENCES `productores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
