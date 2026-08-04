-- AlterTable
ALTER TABLE `productores` DROP COLUMN `aprobado`,
    DROP COLUMN `aprobado_at`;

-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `username` VARCHAR(191) NULL,
    MODIFY `rol` ENUM('PRODUCTOR', 'PROVEEDOR', 'ADMIN', 'OPERADOR_DEPOSITO') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `usuarios_username_key` ON `usuarios`(`username`);

