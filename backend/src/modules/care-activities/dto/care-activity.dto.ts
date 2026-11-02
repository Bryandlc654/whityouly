import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CareActivityStatus, CareActivityType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const OUTCOMES = ['better', 'same', 'worse', 'unsure'];

export class CreateCareActivityDto {
  @ApiProperty({ enum: CareActivityType, description: 'Actividad breve realizada.' })
  @IsEnum(CareActivityType)
  activity!: CareActivityType;

  @ApiPropertyOptional({ enum: CareActivityStatus, default: CareActivityStatus.COMPLETED })
  @IsOptional()
  @IsEnum(CareActivityStatus)
  status?: CareActivityStatus;

  @ApiPropertyOptional({ description: 'Reflexion privada opcional.', maxLength: 5000 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'La reflexion no puede superar los 5000 caracteres' })
  reflection?: string;

  @ApiPropertyOptional({ enum: OUTCOMES, description: 'Como te sentiste despues de la actividad.' })
  @Transform(trim)
  @IsOptional()
  @IsIn(OUTCOMES)
  outcome?: string;

  @ApiPropertyOptional({ description: 'Respuestas o contexto de la actividad, solo para uso privado.' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateCareActivityDto {
  @ApiPropertyOptional({ enum: CareActivityStatus })
  @IsOptional()
  @IsEnum(CareActivityStatus)
  status?: CareActivityStatus;

  @ApiPropertyOptional({ description: 'Reflexion privada opcional.', maxLength: 5000 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'La reflexion no puede estar vacia' })
  @MaxLength(5000, { message: 'La reflexion no puede superar los 5000 caracteres' })
  reflection?: string;

  @ApiPropertyOptional({ enum: OUTCOMES })
  @Transform(trim)
  @IsOptional()
  @IsIn(OUTCOMES)
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
