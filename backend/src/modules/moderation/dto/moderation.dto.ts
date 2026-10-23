import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Tipos de contenido que se pueden moderar y, por tanto, apelar. */
export const APPEAL_TARGETS = ['STORY', 'COMMENT'] as const;
export type AppealTarget = (typeof APPEAL_TARGETS)[number];

/** Motivo de la apelación: texto libre acotado. */
export const APPEAL_MESSAGE_MAX_LENGTH = 1000;

export const REPORT_STATUSES = ['PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED'] as const;
export type ReportStatusValue = (typeof REPORT_STATUSES)[number];

export const REPORTED_TYPES = ['USER', 'CHARACTER', 'STORY', 'COMMENT', 'CREATION'] as const;

/** Decisiones que puede tomar una persona moderadora. */
export const MODERATION_DECISIONS = ['DISMISS', 'HIDE', 'SUSPEND'] as const;
export type ModerationDecision = (typeof MODERATION_DECISIONS)[number];

/** Tipos de acción que aparecen en la auditoría. */
export const MODERATION_ACTION_KINDS = ['DISMISS', 'HIDE', 'SUSPEND', 'RESTORE'] as const;

export const MODERATION_REASON_MIN_LENGTH = 5;
export const MODERATION_REASON_MAX_LENGTH = 1000;

export class CreateAppealDto {
  @ApiProperty({ enum: APPEAL_TARGETS, example: 'STORY' })
  @IsIn(APPEAL_TARGETS, { message: 'El tipo de contenido no se puede apelar' })
  targetType!: AppealTarget;

  @ApiProperty({ description: 'Id del relato o comentario moderado.' })
  @IsUUID('4', { message: 'El contenido indicado no es válido' })
  targetId!: string;

  @ApiProperty({
    example: 'El relato no incumple las normas: cuenta mi experiencia personal.',
    description: 'Motivo de la apelación.',
  })
  @Transform(trim)
  @IsString()
  @MinLength(10, { message: 'Cuéntanos con un poco más de detalle por qué apelas' })
  @MaxLength(APPEAL_MESSAGE_MAX_LENGTH, {
    message: `La apelación no puede superar los ${APPEAL_MESSAGE_MAX_LENGTH} caracteres`,
  })
  message!: string;
}

export class ListAppealsQueryDto {
  @ApiPropertyOptional({ description: 'Id de la última apelación recibida; devuelve las siguientes.' })
  @IsOptional()
  @IsUUID(undefined, { message: 'El cursor no es válido' })
  cursor?: string;

  @ApiPropertyOptional({ default: 30, description: 'Entre 1 y 50. El servicio ajusta el tope.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ enum: ['PENDING', 'ACCEPTED', 'REJECTED'] })
  @IsOptional()
  @IsIn(['PENDING', 'ACCEPTED', 'REJECTED'], { message: 'El estado no es válido' })
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export class ListReportsQueryDto {
  @ApiPropertyOptional({ description: 'Id del último reporte recibido; devuelve los siguientes.' })
  @IsOptional()
  @IsUUID(undefined, { message: 'El cursor no es válido' })
  cursor?: string;

  @ApiPropertyOptional({ default: 30, description: 'Entre 1 y 50. El servicio ajusta el tope.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ enum: REPORT_STATUSES })
  @IsOptional()
  @IsIn(REPORT_STATUSES, { message: 'El estado no es válido' })
  status?: ReportStatusValue;

  @ApiPropertyOptional({ enum: REPORTED_TYPES })
  @IsOptional()
  @IsIn(REPORTED_TYPES, { message: 'El tipo reportado no es válido' })
  type?: (typeof REPORTED_TYPES)[number];
}

export class UpdateReportDto {
  @ApiProperty({ enum: REPORT_STATUSES, example: 'IN_REVIEW' })
  @IsIn(REPORT_STATUSES, { message: 'El estado no es válido' })
  status!: ReportStatusValue;
}

export class ModerateContentDto {
  @ApiProperty({ enum: ['HIDE', 'RESTORE'], example: 'HIDE' })
  @IsIn(['HIDE', 'RESTORE'], { message: 'La acción no es válida' })
  action!: 'HIDE' | 'RESTORE';
}

export class CreateModerationDecisionDto {
  @ApiProperty({ enum: MODERATION_DECISIONS, example: 'HIDE' })
  @IsIn(MODERATION_DECISIONS, { message: 'La decisión no es válida' })
  action!: ModerationDecision;

  @ApiProperty({
    example: 'El contenido incumple las normas de la comunidad.',
    description: 'Motivo obligatorio de la decisión; queda en la auditoría.',
  })
  @Transform(trim)
  @IsString()
  @MinLength(MODERATION_REASON_MIN_LENGTH, {
    message: `Explica el motivo de la decisión (mínimo ${MODERATION_REASON_MIN_LENGTH} caracteres)`,
  })
  @MaxLength(MODERATION_REASON_MAX_LENGTH, {
    message: `El motivo no puede superar los ${MODERATION_REASON_MAX_LENGTH} caracteres`,
  })
  reason!: string;
}

export class RevertModerationActionDto {
  @ApiProperty({
    example: 'La revisión mostró que el contenido no incumplía las normas.',
    description: 'Motivo de la reversión; queda en la auditoría.',
  })
  @Transform(trim)
  @IsString()
  @MinLength(MODERATION_REASON_MIN_LENGTH, {
    message: `Explica el motivo de la reversión (mínimo ${MODERATION_REASON_MIN_LENGTH} caracteres)`,
  })
  @MaxLength(MODERATION_REASON_MAX_LENGTH, {
    message: `El motivo no puede superar los ${MODERATION_REASON_MAX_LENGTH} caracteres`,
  })
  reason!: string;
}

export class ListModerationActionsQueryDto {
  @ApiPropertyOptional({ description: 'Id de la última acción recibida; devuelve las siguientes.' })
  @IsOptional()
  @IsUUID(undefined, { message: 'El cursor no es válido' })
  cursor?: string;

  @ApiPropertyOptional({ default: 30, description: 'Entre 1 y 50. El servicio ajusta el tope.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ enum: MODERATION_ACTION_KINDS })
  @IsOptional()
  @IsIn(MODERATION_ACTION_KINDS, { message: 'La acción no es válida' })
  action?: (typeof MODERATION_ACTION_KINDS)[number];

  @ApiPropertyOptional({ description: 'Filtra por reporte.' })
  @IsOptional()
  @IsUUID(undefined, { message: 'El reporte no es válido' })
  reportId?: string;

  @ApiPropertyOptional({ enum: ['ALL', 'ACTIVE', 'REVERTED'], default: 'ALL' })
  @IsOptional()
  @IsIn(['ALL', 'ACTIVE', 'REVERTED'], { message: 'El estado de la auditoría no es válido' })
  status?: 'ALL' | 'ACTIVE' | 'REVERTED';
}

export class ResolveAppealDto {
  @ApiProperty({ enum: ['ACCEPTED', 'REJECTED'], example: 'ACCEPTED' })
  @IsIn(['ACCEPTED', 'REJECTED'], { message: 'La resolución no es válida' })
  status!: 'ACCEPTED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Nota interna o mensaje para la persona que apeló.' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(APPEAL_MESSAGE_MAX_LENGTH, {
    message: `La nota no puede superar los ${APPEAL_MESSAGE_MAX_LENGTH} caracteres`,
  })
  resolutionNote?: string;
}
