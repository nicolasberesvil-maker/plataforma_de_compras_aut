-- CreateTable
CREATE TABLE `remitos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campana_id` INTEGER NOT NULL,
    `proveedor_id` INTEGER NOT NULL,
    `deposito_id` INTEGER NOT NULL,
    `numero` VARCHAR(191) NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `cantidad_recibida` DECIMAL(12, 2) NOT NULL,
    `observaciones` TEXT NULL,
    `adjunto_url` VARCHAR(191) NULL,
    `movimiento_stock_id` INTEGER NULL,
    `registrado_por_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `remitos_movimiento_stock_id_key`(`movimiento_stock_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `remitos` ADD CONSTRAINT `remitos_campana_id_fkey` FOREIGN KEY (`campana_id`) REFERENCES `campanas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `remitos` ADD CONSTRAINT `remitos_proveedor_id_fkey` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `remitos` ADD CONSTRAINT `remitos_deposito_id_fkey` FOREIGN KEY (`deposito_id`) REFERENCES `depositos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `remitos` ADD CONSTRAINT `remitos_movimiento_stock_id_fkey` FOREIGN KEY (`movimiento_stock_id`) REFERENCES `stock_movimientos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `remitos` ADD CONSTRAINT `remitos_registrado_por_id_fkey` FOREIGN KEY (`registrado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

