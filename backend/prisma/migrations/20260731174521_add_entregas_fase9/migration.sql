-- AlterTable
ALTER TABLE `entregas` ADD COLUMN `fecha_disponible_desde` DATETIME(3) NULL,
    ADD COLUMN `fecha_entregada_at` DATETIME(3) NULL,
    ADD COLUMN `observaciones` TEXT NULL,
    ADD COLUMN `recibida_por_dni` VARCHAR(191) NULL,
    ADD COLUMN `recibida_por_nombre` VARCHAR(191) NULL;
