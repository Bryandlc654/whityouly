import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Envío de correo transaccional con Nodemailer directo.
 *
 * Antes se usaba `@nestjs-modules/mailer`, que arrastraba `handlebars` (con
 * vulnerabilidades críticas) aunque aquí no se renderizaba ninguna plantilla.
 * Este servicio mantiene la misma interfaz mínima (`sendMail`) sobre el
 * transporte SMTP configurado en `env.mail`.
 *
 * Sin `MAIL_HOST` no hay transporte real: el mensaje se registra en el log,
 * igual que hacía `jsonTransport`, para que el registro y la recuperación
 * sigan funcionando en desarrollo sin servidor de correo.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  constructor() {
    this.transporter = env.mail.host
      ? nodemailer.createTransport({
          host: env.mail.host,
          port: env.mail.port,
          secure: env.mail.secure,
          ...(env.mail.user
            ? { auth: { user: env.mail.user, pass: env.mail.pass } }
            : {}),
        })
      : null;
  }

  async sendMail(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[correo simulado] "${message.subject}" para ${message.to}`);
      return;
    }

    await this.transporter.sendMail({
      from: env.mail.from,
      ...message,
    });
  }
}
