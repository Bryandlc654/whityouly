import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateCapsuleDto {
  @ApiProperty({ description: 'Mensaje privado para el yo futuro.', maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Escribe un mensaje para tu yo futuro' })
  @MaxLength(5000, { message: 'El mensaje no puede superar los 5000 caracteres' })
  content!: string;

  @ApiPropertyOptional({ description: 'Emoción asociada al momento de crear la cápsula.' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  mood?: string;

  @ApiProperty({ description: 'Fecha ISO en la que la cápsula podrá abrirse.' })
  @IsDateString({}, { message: 'La fecha de apertura no es válida' })
  openAt!: string;
}

export class UpdateCapsuleDto {
  @ApiPropertyOptional({ maxLength: 5000 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Escribe un mensaje para tu yo futuro' })
  @MaxLength(5000, { message: 'El mensaje no puede superar los 5000 caracteres' })
  content?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  mood?: string;

  @ApiPropertyOptional({ description: 'Nueva fecha ISO de apertura.' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de apertura no es válida' })
  openAt?: string;
}
