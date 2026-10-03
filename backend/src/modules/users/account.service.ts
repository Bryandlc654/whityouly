import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { env } from '../../config/env';
import { UsersService } from './users.service';
import { SessionsService } from '../auth/sessions.service';
import { PasswordBreachService } from '../auth/password-breach.service';
import {
  ChangePasswordDto,
  ConfirmEmailChangeDto,
  DeleteAccountDto,
  RequestEmailChangeDto,
  UpdatePreferencesDto,
} from './dto/account.dto';

interface EmailChangeToken {
  sub?: string;
  email?: string;
  /** Correo que tenía la cuenta cuando se pidió el cambio: ata el token al estado. */
  from?: string;
  type?: string;
}

const CONFIRMATION_WORD = 'ELIMINAR';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly passwordBreachService: PasswordBreachService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}

  /** Estado de la cuenta tal y como lo necesita la pantalla de configuración. */
  async getAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isEmailVerified: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Cuenta no encontrada.');
    }

    const [preferences, characters, mediaCount, activeSessions] = await Promise.all([
      this.prisma.userPreference.findUnique({ where: { userId } }),
      this.prisma.character.count({ where: { userId } }),
      this.prisma.mediaAsset.count({ where: { userId } }),
      this.sessionsService.listActiveForUser(userId),
    ]);

    return {
      ...user,
      preferences: preferences
        ? {
            emailNotifications: preferences.emailNotifications,
            pushNotifications: preferences.pushNotifications,
            theme: preferences.theme,
            language: preferences.language,
          }
        : { emailNotifications: true, pushNotifications: true, theme: 'light', language: 'es' },
      usage: { characters, media: mediaCount },
      activeSessions: activeSessions.length,
    };
  }

  /**
   * Guarda solo los campos enviados. Un `upsert` evita tener que crear la fila de
   * preferencias en el registro: si no existe, nace con los valores por defecto.
   */
  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    await this.assertExists(userId);

    const preferences = await this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...this.definedFields(dto) },
      update: this.definedFields(dto),
      select: {
        emailNotifications: true,
        pushNotifications: true,
        theme: true,
        language: true,
      },
    });

    return preferences;
  }

  /**
   * Cambio de contraseña desde la sesión activa. Se confirma con la contraseña
   * actual para que una sesión robada no pueda dejar la cuenta sin salida, y se
   * cierran todas las sesiones porque el resto de dispositivos tendrían una
   * contraseña que ya no es válida.
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new NotFoundException('Cuenta no encontrada.');
    }

    await this.assertCurrentPassword(user.passwordHash, dto.currentPassword);

    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual.');
    }

    if (await this.passwordBreachService.isBreached(dto.newPassword)) {
      throw new BadRequestException(
        'Esta contraseña apareció en filtraciones de datos conocidas. Por favor, elige una diferente.',
      );
    }

    await this.usersService.updatePassword(user.id, dto.newPassword);
    const revoked = await this.sessionsService.revokeAllForUser(user.id);

    this.dispatchMail(
      {
        to: user.email,
        subject: 'Whityouly - Tu contraseña fue actualizada',
        text: 'La contraseña de tu cuenta se cambió correctamente. Si no fuiste tú, restablece tu contraseña de inmediato y contacta a soporte.',
        html: `
          <h3>Contraseña actualizada</h3>
          <p>La contraseña de tu cuenta se cambió correctamente.</p>
          <p>Si no fuiste tú, restablece tu contraseña de inmediato y contacta a soporte.</p>
        `,
      },
      'notificación de cambio de contraseña',
    );

    return {
      message: 'Contraseña actualizada. Vuelve a iniciar sesión en este dispositivo.',
      revokedSessions: revoked,
    };
  }

  /**
   * Paso 1 del cambio de correo: se manda un enlace al correo nuevo. El token va
   * firmado con un secreto ligado al hash de contraseña, así que queda invalidado
   * si se cambia la contraseña o si se usa dos veces.
   */
  async requestEmailChange(userId: string, dto: RequestEmailChangeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new NotFoundException('Cuenta no encontrada.');
    }

    await this.assertCurrentPassword(user.passwordHash, dto.currentPassword);

    const newEmail = dto.newEmail.trim().toLowerCase();
    if (newEmail === user.email) {
      throw new BadRequestException('El correo nuevo es el mismo que ya usas.');
    }

    const taken = await this.prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException('Ese correo ya está en uso por otra cuenta.');
    }

    const token = await this.jwtService.signAsync(
      { sub: user.id, email: newEmail, from: user.email, type: 'email-change' },
      { secret: this.emailChangeSecret(user.passwordHash), expiresIn: env.jwtEmailChangeExpiresIn },
    );

    const confirmLink = `${env.frontendUrl}/confirm-email?token=${encodeURIComponent(token)}`;

    this.dispatchMail(
      {
        to: newEmail,
        subject: 'Whityouly - Confirma tu nuevo correo',
        text: `Has pedido cambiar el correo de tu cuenta. Confírmalo con este enlace (expira en 1 hora): \n\n${confirmLink}\n\nSi no fuiste tú, ignora este correo y avisa a soporte.`,
        html: `
          <h3>Confirma tu nuevo correo</h3>
          <p>Has pedido cambiar el correo de tu cuenta a <strong>${newEmail}</strong>.</p>
          <a href="${confirmLink}" style="padding: 10px 20px; background-color: #4648d4; color: white; text-decoration: none; border-radius: 5px;">Confirmar cambio de correo</a>
          <p>O copia este enlace: <br/> ${confirmLink}</p>
          <p>Si no fuiste tú, ignora este mensaje: nada cambiará.</p>
        `,
      },
      'confirmación de cambio de correo',
    );

    // Aviso al correo antiguo: es la única señal para la persona titular si alguien
    // intenta quedarse con la cuenta.
    this.dispatchMail(
      {
        to: user.email,
        subject: 'Whityouly - Se ha pedido cambiar el correo de tu cuenta',
        text: `Se ha solicitado cambiar el correo de tu cuenta. Si no fuiste tú, no hagas nada: el cambio solo se aplica al confirmar el enlace enviado al correo nuevo.`,
        html: `
          <h3>Cambio de correo solicitado</h3>
          <p>Se ha solicitado cambiar el correo de tu cuenta. El cambio solo se aplica si alguien confirma el enlace enviado al correo nuevo.</p>
          <p>Si no fuiste tú, ignora este mensaje y consideremos que tu cuenta está a salvo.</p>
        `,
      },
      'aviso de cambio de correo',
    );

    return {
      message: `Te hemos enviado un enlace a ${newEmail}. El cambio se aplica al confirmarlo.`,
    };
  }

  /**
   * Paso 2: se verifica el token y se aplica el cambio. El correo queda
   * verificado porque es el propio usuario quien tiene acceso a esa bandeja. Las
   * sesiones se cierran para que un dispositivo antiguo no siga con el correo
   * anterior.
   */
  async confirmEmailChange(dto: ConfirmEmailChangeDto) {
    const decoded = this.jwtService.decode(dto.token) as EmailChangeToken | null;
    if (!decoded?.sub || decoded.type !== 'email-change' || !decoded.email) {
      throw new BadRequestException('El enlace es inválido o ha expirado.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new BadRequestException('El enlace es inválido o ha expirado.');
    }

    // Uso único sin necesidad de guardar el token: el enlace lleva el correo que
    // tenía la cuenta al pedirlo. Al aplicarse, el correo deja de coincidir y el
    // mismo enlace deja de servir, igual que si se hubiera usado dos veces.
    if (decoded.from !== user.email) {
      throw new BadRequestException('El enlace es inválido, ya se usó o ha expirado.');
    }

    try {
      await this.jwtService.verifyAsync(dto.token, {
        secret: this.emailChangeSecret(user.passwordHash),
        algorithms: ['HS256'],
      });
    } catch {
      throw new BadRequestException('El enlace es inválido, ya se usó o ha expirado.');
    }

    const newEmail = decoded.email.trim().toLowerCase();

    // Si el correo nuevo se ocupó mientras tanto, el cambio no se aplica.
    const taken = await this.prisma.user.findFirst({
      where: { email: newEmail, NOT: { id: user.id } },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException('Ese correo ya está en uso por otra cuenta.');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { email: newEmail, isEmailVerified: true },
      select: { id: true, email: true, isEmailVerified: true },
    });

    await this.sessionsService.revokeAllForUser(user.id);

    return { message: 'Correo actualizado. Vuelve a iniciar sesión.', email: updated.email };
  }

  /**
   * Baja de cuenta. No se borra nada de la base de datos: se marca el estado como
   * DELETED y se cierran las sesiones. El login ya solo admite cuentas ACTIVE, así
   * que la cuenta queda inutilizable de inmediato y sin perder los datos que
   * referencian otros usuarios (relatos, comentarios, música). El borrado
   * definitivo de filas y objetos es una tarea de mantenimiento aparte.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true, role: true },
    });

    if (!user?.passwordHash) {
      throw new NotFoundException('Cuenta no encontrada.');
    }

    await this.assertCurrentPassword(user.passwordHash, dto.currentPassword);

    if (dto.confirmation?.trim().toUpperCase() !== CONFIRMATION_WORD) {
      throw new BadRequestException(`Escribe ${CONFIRMATION_WORD} para confirmar la baja.`);
    }

    if (user.role === 'SUPERADMIN') {
      const otherSuperadmins = await this.prisma.user.count({
        where: { role: 'SUPERADMIN', status: 'ACTIVE', NOT: { id: user.id } },
      });
      if (otherSuperadmins === 0) {
        throw new ConflictException(
          'Eres la última cuenta con permisos de SUPERADMIN. Promociona a otra persona antes de darte de baja.',
        );
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'DELETED' },
    });

    const revoked = await this.sessionsService.revokeAllForUser(user.id);

    this.dispatchMail(
      {
        to: user.email,
        subject: 'Whityouly - Tu cuenta se ha dado de baja',
        text: 'Tu cuenta se ha dado de baja y ya no puedes iniciar sesión. Si no fuiste tú, contacta con soporte cuanto antes.',
        html: `
          <h3>Cuenta dada de baja</h3>
          <p>Tu cuenta se ha dado de baja y ya no puedes iniciar sesión.</p>
          <p>Si no fuiste tú, contacta con soporte cuanto antes.</p>
        `,
      },
      'aviso de baja de cuenta',
    );

    return { message: 'Tu cuenta se ha dado de baja.', revokedSessions: revoked };
  }

  private async assertExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('Cuenta no encontrada.');
    }
  }

  private async assertCurrentPassword(passwordHash: string, currentPassword: string) {
    if (!(await bcrypt.compare(currentPassword, passwordHash))) {
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }
  }

  /**
   * El token queda atado al hash de contraseña: cambiar la contraseña invalida
   * las confirmaciones pendientes, que es justo lo que debe pasar si alguien
   * empezó a cambiar el correo y luego se arrepintió.
   */
  private emailChangeSecret(passwordHash: string): string {
    return `${env.jwtSecret}:email-change:${passwordHash}`;
  }

  /** Solo los campos presentes: `undefined` en un update borra el valor. */
  private definedFields(dto: UpdatePreferencesDto) {
    return {
      ...(dto.emailNotifications === undefined ? {} : { emailNotifications: dto.emailNotifications }),
      ...(dto.pushNotifications === undefined ? {} : { pushNotifications: dto.pushNotifications }),
      ...(dto.theme === undefined ? {} : { theme: dto.theme }),
      ...(dto.language === undefined ? {} : { language: dto.language }),
    };
  }

  private dispatchMail(
    message: { to: string; subject: string; text: string; html: string },
    label: string,
  ): void {
    void this.mailerService.sendMail(message).catch((error: Error) => {
      this.logger.error(`Error enviando ${label}: ${error.message}`);
    });
  }
}
