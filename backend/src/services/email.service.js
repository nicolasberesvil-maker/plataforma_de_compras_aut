import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { renderizarPlantilla } from './email-templates.js';

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
    });
  }

  async enviarPlantilla({ to, template, variables }) {
    const { subject, html, text } = await renderizarPlantilla(template, variables);

    try {
      const info = await this.transporter.sendMail({
        from: `"AUT Compras" <${env.SMTP_FROM}>`,
        to,
        subject,
        text,
        html
      });

      logger.info({ messageId: info.messageId, to, template }, 'Email enviado');
      return info;
    } catch (err) {
      logger.error({ err, to, template }, 'Error enviando email');
      throw err;
    }
  }
}

export const emailService = new EmailService();
