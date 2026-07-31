-- CreateTable
CREATE TABLE `facturas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orden_compra_id` INTEGER NOT NULL,
    `tipo` ENUM('A', 'B') NOT NULL,
    `numero` VARCHAR(191) NOT NULL,
    `punto_venta` VARCHAR(191) NOT NULL DEFAULT '0001',
    `subtotal_neto` DECIMAL(14, 2) NOT NULL,
    `iva` DECIMAL(14, 2) NOT NULL,
    `percepciones_iibb` DECIMAL(14, 2) NULL,
    `total` DECIMAL(14, 2) NOT NULL,
    `pdf_url` VARCHAR(191) NULL,
    `emitida_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `facturas_orden_compra_id_key`(`orden_compra_id`),
    UNIQUE INDEX `facturas_numero_key`(`numero`),
    INDEX `facturas_tipo_idx`(`tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items_factura` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `factura_id` INTEGER NOT NULL,
    `producto_id` INTEGER NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `cantidad` DECIMAL(12, 2) NOT NULL,
    `precio_unitario` DECIMAL(12, 4) NOT NULL,
    `alicuota_iva` DECIMAL(5, 2) NOT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `facturas` ADD CONSTRAINT `facturas_orden_compra_id_fkey` FOREIGN KEY (`orden_compra_id`) REFERENCES `ordenes_compra`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items_factura` ADD CONSTRAINT `items_factura_factura_id_fkey` FOREIGN KEY (`factura_id`) REFERENCES `facturas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items_factura` ADD CONSTRAINT `items_factura_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
