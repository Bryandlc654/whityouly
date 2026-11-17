import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Global para no tener que importarlo en cada módulo que envía correo
 * (autenticación y cuenta). No depende de ninguna otra pieza de la app.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
