import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SessionsService } from './sessions.service';
import { SessionCleanupService } from './session-cleanup.service';
import { PasswordBreachService } from './password-breach.service';
import { LoginAttemptsService } from './login-attempts.service';
import { AuthAuditService } from './auth-audit.service';
import { CooldownService } from '../../common/cooldown/cooldown.service';
import { env } from '../../config/env';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      global: true,
      secret: env.jwtSecret,
      // Restringimos el algoritmo de firma para evitar confusión de algoritmos.
      signOptions: { algorithm: 'HS256' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsService,
    SessionCleanupService,
    PasswordBreachService,
    LoginAttemptsService,
    AuthAuditService,
    CooldownService,
    JwtStrategy,
  ],
})
export class AuthModule {}
