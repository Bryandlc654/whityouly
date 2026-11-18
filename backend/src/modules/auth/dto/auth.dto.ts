import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  Matches,
  IsDateString,
  IsBoolean,
  Equals,
} from 'class-validator';
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

  @IsDateString({}, { message: 'La fecha de nacimiento no es válida' })
  birthDate!: string;

  @IsBoolean()
  @Equals(true, { message: 'Debes aceptar los términos y la política de privacidad' })
  acceptTerms!: boolean;
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

export class VerifyEmailCodeDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(254, { message: 'El correo es demasiado largo' })
  email!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value))
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos' })
  code!: string;
}

export class ResendVerificationDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(254, { message: 'El correo es demasiado largo' })
  email!: string;
}

/** Código TOTP de 6 dígitos o un código de recuperación con formato XXXX-XXXX. */
export class MfaCodeDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : value,
  )
  @IsString()
  @Matches(/^(\d{6}|[A-Z0-9]{4}-[A-Z0-9]{4})$/, {
    message: 'El código no es válido',
  })
  code!: string;
}

export class MfaVerifyLoginDto extends MfaCodeDto {
  @IsString()
  @IsNotEmpty({ message: 'El desafío de verificación es requerido' })
  challengeToken!: string;
}

export class MfaDisableDto extends MfaCodeDto {
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MaxLength(MAX_PASSWORD_LENGTH)
  password!: string;
}
