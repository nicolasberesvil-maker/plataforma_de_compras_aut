import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUBJECTS = {
  reset_password: 'Restablecé tu contraseña — AUT Compras'
};

/**
 * Templating mínimo por sustitución {{variable}} — no se agrega una librería
 * de templating para un solo caso de uso (reset de contraseña, Fase 4).
 */
export async function renderizarPlantilla(template, variables = {}) {
  const filePath = path.join(__dirname, 'email-templates', `${template}.html`);
  let html = await fs.readFile(filePath, 'utf-8');

  for (const [clave, valor] of Object.entries(variables)) {
    html = html.replaceAll(`{{${clave}}}`, String(valor));
  }

  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const subject = SUBJECTS[template] ?? 'AUT Compras';

  return { subject, html, text };
}
