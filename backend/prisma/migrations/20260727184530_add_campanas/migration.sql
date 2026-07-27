-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expira_at` DATETIME(3) NOT NULL,
    `usado_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
    INDEX `password_reset_tokens_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campanas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `producto_id` INTEGER NOT NULL,
    `tipo` ENUM('COLECTIVA', 'DIRECTA', 'CONTINUA') NOT NULL DEFAULT 'COLECTIVA',
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `volumen_minimo` DECIMAL(12, 2) NULL,
    `volumen_maximo` DECIMAL(12, 2) NULL,
    `fecha_apertura` DATETIME(3) NOT NULL,
    `fecha_cierre` DATETIME(3) NULL,
    `fecha_cierre_cotizaciones` DATETIME(3) NULL,
    `fecha_estimada_recepcion` DATETIME(3) NULL,
    `campana_padre_id` INTEGER NULL,
    `horas_lockout_edicion` INTEGER NOT NULL DEFAULT 0,
    `estado` ENUM('BORRADOR', 'ABIERTA', 'EN_LICITACION', 'ADJUDICADA', 'CERRADA', 'CANCELADA') NOT NULL DEFAULT 'BORRADOR',
    `creada_por_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `cancelada_at` DATETIME(3) NULL,
    `motivo_cancelacion` TEXT NULL,

    INDEX `campanas_estado_idx`(`estado`),
    INDEX `campanas_fecha_cierre_idx`(`fecha_cierre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `intenciones_compra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campana_id` INTEGER NULL,
    `productor_id` INTEGER NOT NULL,
    `producto_id` INTEGER NOT NULL,
    `volumen` DECIMAL(12, 2) NOT NULL,
    `observaciones` TEXT NULL,
    `fecha_deseada` DATETIME(3) NULL,
    `modalidad_entrega_preferida` ENUM('RETIRO_EN_DEPOSITO', 'ENTREGA_EN_CAMPO') NULL,
    `direccion_entrega_campo` TEXT NULL,
    `forma_pago_preferida` ENUM('TRANSFERENCIA', 'ECHEQ_CORRIENTE', 'ECHEQ_PLAZO', 'TARJETA_AGRO', 'CANJE_CEREAL', 'CUENTA_CORRIENTE', 'EFECTIVO') NULL,
    `estado` ENUM('PENDIENTE', 'AGRUPADA', 'DESCARTADA') NOT NULL DEFAULT 'PENDIENTE',
    `motivo_descarte` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `intenciones_compra_estado_idx`(`estado`),
    INDEX `intenciones_compra_producto_id_estado_idx`(`producto_id`, `estado`),
    UNIQUE INDEX `intenciones_compra_campana_id_productor_id_key`(`campana_id`, `productor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campanas` ADD CONSTRAINT `campanas_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campanas` ADD CONSTRAINT `campanas_campana_padre_id_fkey` FOREIGN KEY (`campana_padre_id`) REFERENCES `campanas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campanas` ADD CONSTRAINT `campanas_creada_por_id_fkey` FOREIGN KEY (`creada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intenciones_compra` ADD CONSTRAINT `intenciones_compra_campana_id_fkey` FOREIGN KEY (`campana_id`) REFERENCES `campanas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intenciones_compra` ADD CONSTRAINT `intenciones_compra_productor_id_fkey` FOREIGN KEY (`productor_id`) REFERENCES `productores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intenciones_compra` ADD CONSTRAINT `intenciones_compra_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
