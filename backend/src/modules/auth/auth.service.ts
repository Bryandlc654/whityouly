import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailerService: MailerService,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.createUser({
      email: registerDto.email,
      passwordHash: registerDto.password,
    });

    // Crear token de verificación
    const token = await this.jwtService.signAsync(
      { sub: user.id, type: 'email-verification' },
      { expiresIn: '24h' }
    );
    const verifyLink = `http://localhost:3001/verify-email?token=${token}`;

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Whityouly - Verifica tu cuenta',
        text: `Bienvenido a Whityouly. Por favor, verifica tu correo en el siguiente enlace: \n\n${verifyLink}`,
        html: `
          <h3>Bienvenido a tu Refugio</h3>
          <p>Solo falta un paso. Por favor, haz clic en el siguiente botón para verificar tu cuenta:</p>
          <a href="${verifyLink}" style="padding: 10px 20px; background-color: #4648d4; color: white; text-decoration: none; border-radius: 5px;">Verificar mi cuenta</a>
        `
      });
    } catch (e) {
      console.error('Error enviando correo de verificación:', e);
    }

    return { message: 'Cuenta creada. Por favor, revisa tu correo electrónico para verificarla.' };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Por favor, verifica tu correo electrónico antes de iniciar sesión');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.generateTokens(user.id, user.email);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      // Por seguridad, devolvemos success incluso si no existe, para no filtrar emails
      return { message: 'Si el correo existe, se ha enviado un enlace de recuperación.' };
    }

    // Creamos un JWT con un secreto único que incluye el hash de la contraseña actual.
    // Si la contraseña cambia, el token automáticamente se invalida.
    const secret = process.env.JWT_SECRET + user.passwordHash;
    const token = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { secret, expiresIn: '15m' }
    );

    const resetLink = `http://localhost:3001/reset-password?token=${token}&id=${user.id}`;

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Whityouly - Recuperación de contraseña',
        text: `Hola, has solicitado restablecer tu contraseña. Ingresa al siguiente enlace (expira en 15 minutos): \n\n${resetLink}\n\nSi no fuiste tú, ignora este correo.`,
        html: `
          <h3>Recuperación de contraseña</h3>
          <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente botón (expira en 15 minutos):</p>
          <a href="${resetLink}" style="padding: 10px 20px; background-color: #4648d4; color: white; text-decoration: none; border-radius: 5px;">Restablecer Contraseña</a>
          <p>O copia este enlace: <br/> ${resetLink}</p>
        `
      });
    } catch (e) {
      console.error('Error enviando correo de recuperación:', e);
      throw new BadRequestException('Error al enviar el correo de recuperación');
    }

    return { message: 'Si el correo existe, se ha enviado un enlace de recuperación.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Decodificar el token sin verificar la firma temporalmente para obtener el ID
    const decoded = this.jwtService.decode(dto.token) as any;
    if (!decoded || !decoded.sub) {
      throw new BadRequestException('Token inválido o corrupto');
    }

    const user = await this.usersService.findById(decoded.sub);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Ahora sí verificamos el token con el secreto compuesto
    const secret = process.env.JWT_SECRET + user.passwordHash;
    try {
      await this.jwtService.verifyAsync(dto.token, { secret });
    } catch (e) {
      throw new BadRequestException('El token es inválido o ya expiró (o la contraseña ya fue cambiada)');
    }

    // Actualizamos la contraseña en la base de datos
    await this.usersService.updatePassword(user.id, dto.newPassword);

    return { message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión.' };
  }

  async verifyEmail(token: string) {
    try {
      const decoded = await this.jwtService.verifyAsync(token);
      if (decoded.type !== 'email-verification') {
        throw new BadRequestException('Token inválido');
      }
      await this.usersService.markEmailAsVerified(decoded.sub);
      return { message: 'Correo verificado exitosamente. Ya puedes iniciar sesión.' };
    } catch (e) {
      throw new BadRequestException('El enlace de verificación es inválido o ha expirado');
    }
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    
    return {
      accessToken: await this.jwtService.signAsync(payload, {
        expiresIn: '15m',
      }),
      refreshToken: await this.jwtService.signAsync(payload, {
        expiresIn: '7d',
      }),
    };
  }
}
