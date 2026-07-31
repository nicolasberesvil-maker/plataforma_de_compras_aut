-- CreateTable
CREATE TABLE `depositos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `localidad` VARCHAR(191) NOT NULL,
    `direccion` VARCHAR(191) NOT NULL,
    `responsable` VARCHAR(191) NULL,
    `telefono_contacto` VARCHAR(191) NULL,
    `horario_atencion` VARCHAR(191) NULL,
    `capacidad_maxima` DECIMAL(12, 2) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `depositos_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movimientos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deposito_id` INTEGER NOT NULL,
    `producto_id` INTEGER NOT NULL,
    `tipo` ENUM('INGRESO_PROVEEDOR', 'EGRESO_PRODUCTOR', 'AJUSTE_INVENTARIO_POSITIVO', 'AJUSTE_INVENTARIO_NEGATIVO', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA', 'DEVOLUCION_PROVEEDOR') NOT NULL,
    `cantidad` DECIMAL(12, 2) NOT NULL,
    `signo` INTEGER NOT NULL,
    `entrega_id` INTEGER NULL,
    `proveedor_origen` VARCHAR(191) NULL,
    `observaciones` TEXT NULL,
    `ejecutado_por_id` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_movimientos_deposito_id_producto_id_idx`(`deposito_id`, `producto_id`),
    INDEX `stock_movimientos_fecha_idx`(`fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `entregas` ADD CONSTRAINT `entregas_deposito_id_fkey` FOREIGN KEY (`deposito_id`) REFERENCES `depositos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movimientos` ADD CONSTRAINT `stock_movimientos_deposito_id_fkey` FOREIGN KEY (`deposito_id`) REFERENCES `depositos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movimientos` ADD CONSTRAINT `stock_movimientos_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movimientos` ADD CONSTRAINT `stock_movimientos_entrega_id_fkey` FOREIGN KEY (`entrega_id`) REFERENCES `entregas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movimientos` ADD CONSTRAINT `stock_movimientos_ejecutado_por_id_fkey` FOREIGN KEY (`ejecutado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
