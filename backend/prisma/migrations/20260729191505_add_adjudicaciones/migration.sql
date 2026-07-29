-- AlterTable
ALTER TABLE `cotizaciones` ADD COLUMN `es_ganadora` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `adjudicaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campana_id` INTEGER NOT NULL,
    `cotizacion_ganadora_id` INTEGER NOT NULL,
    `volumen_total_adjudicado` DECIMAL(12, 2) NOT NULL,
    `precio_final_unitario` DECIMAL(12, 4) NOT NULL,
    `precio_minorista_referencia` DECIMAL(12, 4) NULL,
    `ahorro_estimado_total` DECIMAL(12, 2) NULL,
    `porcentaje_ahorro` DECIMAL(5, 2) NULL,
    `motivoEleccion` TEXT NULL,
    `adjudicada_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `adjudicaciones_campana_id_key`(`campana_id`),
    UNIQUE INDEX `adjudicaciones_cotizacion_ganadora_id_key`(`cotizacion_ganadora_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ordenes_compra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `adjudicacion_id` INTEGER NOT NULL,
    `productor_id` INTEGER NOT NULL,
    `volumen_final` DECIMAL(12, 2) NOT NULL,
    `precio_unitario` DECIMAL(12, 4) NOT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `iva` DECIMAL(14, 2) NOT NULL,
    `total` DECIMAL(14, 2) NOT NULL,
    `ahorro_estimado` DECIMAL(14, 2) NULL,
    `porcentaje_ahorro` DECIMAL(5, 2) NULL,
    `estado_pago` ENUM('PENDIENTE', 'PARCIAL', 'PAGADO', 'VENCIDO', 'CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
    `forma_pago` ENUM('TRANSFERENCIA', 'ECHEQ_CORRIENTE', 'ECHEQ_PLAZO', 'TARJETA_AGRO', 'CANJE_CEREAL', 'CUENTA_CORRIENTE', 'EFECTIVO') NULL,
    `cuotas` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entregas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orden_compra_id` INTEGER NOT NULL,
    `productor_id` INTEGER NOT NULL,
    `modalidad` ENUM('RETIRO_EN_DEPOSITO', 'ENTREGA_EN_CAMPO') NOT NULL,
    `estado` ENUM('PENDIENTE', 'EN_TRANSITO', 'DISPONIBLE_PARA_RETIRO', 'EN_RUTA_A_CAMPO', 'ENTREGADA', 'CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
    `deposito_id` INTEGER NULL,
    `direccion_campo` VARCHAR(191) NULL,
    `fecha_estimada` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `entregas_orden_compra_id_key`(`orden_compra_id`),
    INDEX `entregas_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `adjudicaciones` ADD CONSTRAINT `adjudicaciones_campana_id_fkey` FOREIGN KEY (`campana_id`) REFERENCES `campanas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adjudicaciones` ADD CONSTRAINT `adjudicaciones_cotizacion_ganadora_id_fkey` FOREIGN KEY (`cotizacion_ganadora_id`) REFERENCES `cotizaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordenes_compra` ADD CONSTRAINT `ordenes_compra_adjudicacion_id_fkey` FOREIGN KEY (`adjudicacion_id`) REFERENCES `adjudicaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordenes_compra` ADD CONSTRAINT `ordenes_compra_productor_id_fkey` FOREIGN KEY (`productor_id`) REFERENCES `productores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entregas` ADD CONSTRAINT `entregas_orden_compra_id_fkey` FOREIGN KEY (`orden_compra_id`) REFERENCES `ordenes_compra`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entregas` ADD CONSTRAINT `entregas_productor_id_fkey` FOREIGN KEY (`productor_id`) REFERENCES `productores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
