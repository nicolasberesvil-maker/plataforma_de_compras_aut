-- CreateTable
CREATE TABLE `pagos_proveedor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `proveedor_id` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `monto` DECIMAL(12, 2) NOT NULL,
    `medio_pago` ENUM('TRANSFERENCIA', 'ECHEQ_CORRIENTE', 'ECHEQ_PLAZO', 'TARJETA_AGRO', 'CANJE_CEREAL', 'CUENTA_CORRIENTE', 'EFECTIVO') NOT NULL,
    `adjudicacion_id` INTEGER NULL,
    `observaciones` TEXT NULL,
    `registrado_por_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pagos_proveedor` ADD CONSTRAINT `pagos_proveedor_proveedor_id_fkey` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagos_proveedor` ADD CONSTRAINT `pagos_proveedor_adjudicacion_id_fkey` FOREIGN KEY (`adjudicacion_id`) REFERENCES `adjudicaciones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagos_proveedor` ADD CONSTRAINT `pagos_proveedor_registrado_por_id_fkey` FOREIGN KEY (`registrado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

