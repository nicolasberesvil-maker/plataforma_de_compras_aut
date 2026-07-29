-- CreateTable
CREATE TABLE `cotizaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campana_id` INTEGER NOT NULL,
    `proveedor_id` INTEGER NOT NULL,
    `precio_unitario` DECIMAL(12, 4) NOT NULL,
    `moneda_precio` ENUM('ARS', 'USD') NOT NULL DEFAULT 'ARS',
    `plazo_entrega_dias` INTEGER NOT NULL,
    `tasa_interes_mensual` DECIMAL(5, 2) NULL,
    `condiciones_pago` TEXT NOT NULL,
    `observaciones` TEXT NULL,
    `valida_hasta` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cotizaciones_campana_id_proveedor_id_key`(`campana_id`, `proveedor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cotizaciones` ADD CONSTRAINT `cotizaciones_campana_id_fkey` FOREIGN KEY (`campana_id`) REFERENCES `campanas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cotizaciones` ADD CONSTRAINT `cotizaciones_proveedor_id_fkey` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
