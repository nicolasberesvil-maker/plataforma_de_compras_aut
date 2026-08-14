-- AlterTable
ALTER TABLE `campanas` ADD COLUMN `formas_pago_ofrecidas` JSON NULL,
    ADD COLUMN `lote_id` INTEGER NULL,
    ADD COLUMN `modalidades_entrega_ofrecidas` JSON NULL;

-- CreateTable
CREATE TABLE `lotes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `creada_por_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `campanas_lote_id_idx` ON `campanas`(`lote_id`);

-- AddForeignKey
ALTER TABLE `campanas` ADD CONSTRAINT `campanas_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `lotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lotes` ADD CONSTRAINT `lotes_creada_por_id_fkey` FOREIGN KEY (`creada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
