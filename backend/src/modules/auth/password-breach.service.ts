import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { env } from '../../config/env';

/**
 * Comprueba si una contraseña aparece en filtraciones conocidas usando la API
 * de Have I Been Pwned con k-anonymity (nunca se envía la contraseña completa).
 * "Falla abierto": si el servicio externo no responde, no bloquea el registro.
 */
@Injectable()
export class PasswordBreachService {
  private readonly logger = new Logger(PasswordBreachService.name);

  async isBreached(password: string): Promise<boolean> {
    if (!env.passwordBreachCheckEnabled || password.length === 0) {
      return false;
    }

    const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true', 'User-Agent': 'Whityouly-Password-Check' },
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        this.logger.warn(`La API de filtraciones respondió ${response.status}`);
        return false;
      }

      const body = await response.text();
      return body
        .split('\n')
        .some((line) => line.split(':')[0]?.trim() === suffix);
    } catch (error) {
      this.logger.warn(
        `No se pudo verificar la contraseña contra filtraciones: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
