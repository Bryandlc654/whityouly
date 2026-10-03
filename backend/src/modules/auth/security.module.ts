import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { PasswordBreachService } from './password-breach.service';

/**
 * Servicios de seguridad que usan tanto el módulo de autenticación como el de
 * cuenta. Viven aquí, y no en AuthModule, porque AuthModule importa UsersModule:
 * si UsersModule importara AuthModule para usar estos servicios, la
 * dependencia sería circular y la aplicación no arrancaría.
 */
@Module({
  providers: [SessionsService, PasswordBreachService],
  exports: [SessionsService, PasswordBreachService],
})
export class SecurityModule {}
