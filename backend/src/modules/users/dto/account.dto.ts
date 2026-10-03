import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  MAX_PASSWORD_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_PATTERN_MESSAGE,
} from '../../auth/dto/auth.dto';

const THEMES = ['light', 'dark', 'system'] as const;
const LANGUAGES = ['es'] as const;

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiPropertyOptional({ enum: THEMES, example: 'dark' })
  @IsOptional()
  @IsIn(THEMES, { message: `El tema debe ser uno de: ${THEMES.join(', ')}` })
  theme?: (typeof THEMES)[number];

  @ApiPropertyOptional({ enum: LANGUAGES, example: 'es' })
  @IsOptional()
  @IsIn(LANGUAGES, { message: `El idioma debe ser uno de: ${LANGUAGES.join(', ')}` })
  language?: (typeof LANGUAGES)[number];
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'MiContraseñaActual1' })
  @IsString()
  @IsNotEmpty({ message: 'Indica tu contraseña actual' })
  @MaxLength(MAX_PASSWORD_LENGTH)
  currentPassword: string;

  @ApiProperty({ example: 'MiNuevaContraseña2' })
  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  @MaxLength(MAX_PASSWORD_LENGTH, { message: 'La contraseña no puede superar los 72 caracteres' })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_PATTERN_MESSAGE })
  newPassword: string;
}

export class RequestEmailChangeDto {
  @ApiProperty({ example: 'nuevo@correo.com' })
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(254)
  newEmail: string;

  @ApiProperty({ description: 'Confirma que eres tú con tu contraseña actual.' })
  @IsString()
  @IsNotEmpty({ message: 'Indica tu contraseña actual' })
  @MaxLength(MAX_PASSWORD_LENGTH)
  currentPassword: string;
}

export class ConfirmEmailChangeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class DeleteAccountDto {
  @ApiProperty({ description: 'Confirma que eres tú con tu contraseña actual.' })
  @IsString()
  @IsNotEmpty({ message: 'Indica tu contraseña actual' })
  @MaxLength(MAX_PASSWORD_LENGTH)
  currentPassword: string;

  @ApiProperty({
    description: 'Escribe ELIMINAR en mayúsculas para confirmar.',
    example: 'ELIMINAR',
  })
  @IsString()
  @Type(() => String)
  @IsNotEmpty()
  confirmation?: string;
}
