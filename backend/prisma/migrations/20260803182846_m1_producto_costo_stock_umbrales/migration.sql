-- AlterTable
ALTER TABLE `productos` ADD COLUMN `costo_referencia` DECIMAL(12, 4) NULL,
    ADD COLUMN `stock_minimo` DECIMAL(12, 2) NULL,
    ADD COLUMN `stock_seguridad` DECIMAL(12, 2) NULL;

