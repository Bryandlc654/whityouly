import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Fuerza una política de contraseña: mínimo 8, con mayúscula, minúscula y número.
// Se exporta para que el cambio de contraseña desde la configuración de cuenta
// aplique exactamente la misma política que el registro y el restablecimiento.
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
export const PASSWORD_PATTERN_MESSAGE =
  'La contraseña debe incluir al menos una mayúscula, una minúscula y un número';

// bcrypt solo procesa los primeros 72 bytes: limitamos para evitar truncamientos y DoS.
export const MAX_PASSWORD_LENGTH = 72;

export class RegisterDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(254, { message: 'El correo es demasiado largo' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(MAX_PASSWORD_LENGTH, { message: 'La contraseña no puede superar los 72 caracteres' })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_PATTERN_MESSAGE })
  password!: string;
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(254, { message: 'El correo es demasiado largo' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña no puede estar vacía' })
  @MaxLength(MAX_PASSWORD_LENGTH, { message: 'La contraseña no puede superar los 72 caracteres' })
  password!: string;
}

export class ForgotPasswordDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(254, { message: 'El correo es demasiado largo' })
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'El token es requerido' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  @MaxLength(MAX_PASSWORD_LENGTH, { message: 'La contraseña no puede superar los 72 caracteres' })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_PATTERN_MESSAGE })
  newPassword!: string;
}

export class ResendVerificationDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(254, { message: 'El correo es demasiado largo' })
  email!: string;
}
