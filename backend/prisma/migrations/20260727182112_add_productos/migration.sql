-- CreateTable
CREATE TABLE `productos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `categoria` ENUM('AGROQUIMICO', 'FERTILIZANTE', 'SEMILLA', 'INOCULANTE', 'NUTRICION_ANIMAL', 'SANIDAD_ANIMAL', 'OTRO') NOT NULL,
    `unidad_medida` ENUM('LITRO', 'KILO', 'UNIDAD', 'TONELADA', 'BOLSA') NOT NULL,
    `alicuota_iva` DECIMAL(5, 2) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `productos_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
