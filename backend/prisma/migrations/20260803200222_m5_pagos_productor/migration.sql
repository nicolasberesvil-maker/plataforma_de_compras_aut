-- CreateTable
CREATE TABLE `pagos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productor_id` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `monto_total` DECIMAL(14, 2) NOT NULL,
    `estado` ENUM('DECLARADO', 'CONFIRMADO', 'RECHAZADO') NOT NULL DEFAULT 'DECLARADO',
    `observaciones` TEXT NULL,
    `registrado_por_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmado_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pagos_aplicaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pago_id` INTEGER NOT NULL,
    `orden_compra_id` INTEGER NOT NULL,
    `monto_aplicado` DECIMAL(14, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pagos_medios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pago_id` INTEGER NOT NULL,
    `forma_pago` ENUM('TRANSFERENCIA', 'ECHEQ_CORRIENTE', 'ECHEQ_PLAZO', 'TARJETA_AGRO', 'CANJE_CEREAL', 'CUENTA_CORRIENTE', 'EFECTIVO') NOT NULL,
    `monto` DECIMAL(14, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_productor_id_fkey` FOREIGN KEY (`productor_id`) REFERENCES `productores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_registrado_por_id_fkey` FOREIGN KEY (`registrado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagos_aplicaciones` ADD CONSTRAINT `pagos_aplicaciones_pago_id_fkey` FOREIGN KEY (`pago_id`) REFERENCES `pagos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagos_aplicaciones` ADD CONSTRAINT `pagos_aplicaciones_orden_compra_id_fkey` FOREIGN KEY (`orden_compra_id`) REFERENCES `ordenes_compra`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagos_medios` ADD CONSTRAINT `pagos_medios_pago_id_fkey` FOREIGN KEY (`pago_id`) REFERENCES `pagos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

