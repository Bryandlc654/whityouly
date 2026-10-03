import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditDetails {
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  deviceInfo?: string | null;
  reason?: string;
}

/**
 * Registro de eventos de autenticación para auditoría y detección de abuso.
 * Reutiliza la tabla `analytics_events` (no requiere migraciones).
 */
@Injectable()
export class AuthAuditService {
  private readonly logger = new Logger(AuthAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  private hashEmail(email?: string | null): string | null {
    if (!email) return null;
    return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  }

  private async record(eventType: string, details: AuditDetails): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          eventType,
          userId: details.userId ?? null,
          entityType: 'auth',
          metadata: {
            ip: details.ip ?? null,
            deviceInfo: details.deviceInfo ?? null,
            reason: details.reason ?? null,
            emailHash: this.hashEmail(details.email),
          },
        },
      });
    } catch (error) {
      // La auditoría nunca debe bloquear el flujo de autenticación.
      this.logger.warn(`No se pudo registrar "${eventType}": ${(error as Error).message}`);
    }
  }

  logLoginSuccess(details: AuditDetails): Promise<void> {
    return this.record('auth.login.success', details);
  }

  logLoginFailure(details: AuditDetails): Promise<void> {
    return this.record('auth.login.failure', details);
  }

  logAccountLocked(details: AuditDetails): Promise<void> {
    return this.record('auth.login.locked', details);
  }

  logPasswordReset(details: AuditDetails): Promise<void> {
    return this.record('auth.password.reset', details);
  }

  logTokenReuse(details: AuditDetails): Promise<void> {
    return this.record('auth.token.reuse_detected', details);
  }

  logSessionRevoked(details: AuditDetails): Promise<void> {
    return this.record('auth.session.revoked', details);
  }
}
